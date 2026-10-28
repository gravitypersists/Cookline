# Cookline — Spec

Turn a photo of a recipe into a **transit map**: a phone-sized, vertical chart where each component of the dish (rice, eggplant, sauce…) is a colored line, steps are stations in the order you start them, and lines merge where components combine. The point is to see at a glance what runs in parallel, when your hands are free, and what to prep during that downtime, so you don't need full mise en place before you start.

The structural reference is `designs/C · Transit map-html/C-Transit.dc.html` (serve the folder and open it). Take the **layout idea** from it: lanes, stations in start order, merges, solid vs. dashed lines, "Meanwhile" notes. **Do not take its visual styling.** It came from another project's design system. This project's own style system is in §6.

---

## 1. Goals and non-goals

**Goals**
- Capture a recipe from a phone camera, photo library, or pasted text, and render it as a transit map within ~30 s.
- Show, at a glance:
  - which components exist and when they merge
  - which steps need your hands and which are waiting time
  - what small prep fits into each waiting window ("Meanwhile: …")
- Be honest about time. Durations are estimates (`~8m`) unless the recipe truly depends on the clock, and then they are clearly marked exact (§5.1, §6.4).
- Run entirely as a static site / installable PWA on GitHub Pages. **No backend, no subscriptions.** The only cost is per-request model usage on the user's own OpenRouter key.
- Saved recipes work offline.

**Non-goals (v1)**
- Countdown timers, alarms, or step-by-step "cook mode" playback.
- Accounts, sync, sharing a recipe library between devices.
- Scaling servings or converting units.
- Native app store builds.

---

## 2. Constraints and platform

| Concern | Decision |
|---|---|
| Hosting | GitHub Pages, deployed by GitHub Actions (§10). |
| Routing | Hash-based (`#/recipe/:id`), because Pages has no server rewrites. |
| Install | PWA: web manifest + service worker; "Add to Home Screen" on iOS/Android. |
| Model access | Browser calls `https://openrouter.ai/api/v1/chat/completions` directly with the user's key (OpenRouter allows browser CORS). |
| API key | Entered in Settings and stored in `localStorage` on the device. Never committed, never built into the bundle. Recommend the user set a credit limit on the key in OpenRouter. |
| Storage | IndexedDB (`idb-keyval`) for recipes and source images (images downscaled, see §4.1). |
| Viewport | Designed at 390 px wide, must work from 360 px to tablet widths. No horizontal page scroll. |
| Theme | Light and dark (§6.1). Follows the OS setting by default, with an override in Settings. |

**Stack:** Vite + TypeScript + Preact, `vite-plugin-pwa`, `idb-keyval`, `zod` (schemas, with JSON Schema generated for structured output), `html-to-image` (PNG export), Vitest, Playwright.

---

## 3. User flows

1. **First run:** Settings prompts for the OpenRouter key and model (with a default preselected). A "Test key" button checks the key for free.
   Until the Library exists (milestone 4), Home shows **New recipe**, the last recipe read, and the example fixtures.
2. **Capture:** From the Library, tap **New**. Choose:
   - **Camera** (`<input type="file" accept="image/*" capture="environment">`)
   - **Photos** (multi-select, for recipes spread over 2+ pages or screenshots)
   - **Paste text**
3. **Processing:** progress states: *Reading recipe…*, then *Fixing a few problems…* if a repair pass runs. Scheduling and layout are local and instant. You can cancel. Errors show the reason and a **Try again** button. Validation errors also show the list and the raw model output.
4. **Map:** the transit map (§6). Actions: **Edit**, **Share/Export PNG**, **Re-extract**, **Delete**.
5. **Edit:** a form-level editor for the extracted graph (§7). Saving re-runs scheduling and layout locally, with no model call.
6. **Library:** saved recipes, newest first, showing title and `~total`. Works offline.
7. **Settings:** API key, model, and theme (System / Light / Dark).

---

## 4. Extraction pipeline

```
image(s) / text
   │  downscale (long edge 1600 px, JPEG q≈0.8)
   ▼
[A] Model call: transcribe + structure → RecipeGraph JSON (structured output)
   ▼
[B] Validate (zod + graph rules, §5.3)
   │  invalid → one repair call: original input + JSON + error list → corrected JSON
   ▼
[C] Schedule (§5.4)  — deterministic, local
   ▼
[D] Layout (§6.3)    — deterministic, local
   ▼
render + save
```

### 4.1 Model call
- One request, with the image(s) as `image_url` data URLs, plus the system prompt in **Appendix A**. Use `response_format: { type: "json_schema", strict: true }` and `provider: { require_parameters: true }`, so OpenRouter only routes to providers that honor the schema.
- **Wire format** (`src/model/schema.ts`): strict mode needs every property present, so the schema the model fills in is the §5.1 types with optional fields made **nullable** instead of omitted. `fromWire` turns nulls into missing fields. The JSON Schema is generated from zod.
- The model is configurable in Settings. The picker lists only models from OpenRouter's `/models` that take image input and support `structured_outputs` (excluding batch-only and router models), sorted by price. The default is `anthropic/claude-haiku-5.5` ($0.10 / $0.50 per M tokens, roughly 0.2¢ per recipe); the eval in §9 revisits it.
- **Test key** uses `GET /api/v1/key`, which costs nothing and reports the remaining credit.
- The prompt lives in `src/extract/prompt.ts` as a versioned constant. Each saved recipe records `promptVersion` and `model` so eval results stay comparable.

### 4.2 Repair
If validation fails, make **one** repair attempt. If it still fails, show the errors and open the Edit screen with whatever parsed, so the user can fix it by hand.

---

## 5. Data model and scheduling

### 5.1 Types

```ts
type Attention =
  | "active"    // hands busy; excludes other active work (dicing, flipping, stirring constantly)
  | "tending"   // on the heat, stay nearby; small prep can happen alongside (sweat, cook down, sear)
  | "passive";  // walk-away time (rest, simmer lid on, bake, marinate)

// How much the clock matters for this step.
type TimeBasis =
  | "estimated" // the recipe gives no time; the model estimated it          → shown "~6m"
  | "stated"    // the recipe gives a time, but doneness is judged by a cue    → shown "~6m"
  | "exact";    // the clock IS the doneness test (rare)                       → shown "⏱ 6m"

interface Duration {
  min: number;        // minutes
  max?: number;       // for ranges: "8–10 minutes" → min 8, max 10
  basis: TimeBasis;
  quote?: string;     // the time phrase verbatim from the recipe: "8 to 10 minutes".
                      // Required for "stated" and "exact"; forbidden for "estimated".
}

interface RecipeGraph {
  title: string;
  servings?: string;
  ingredients: Ingredient[];
  components: Component[];
  trunk: string;               // component id the final station belongs to
}

interface Ingredient {
  id: string;
  name: string;                // "garlic"
  qty?: string;                // "4 cloves" — as printed, units may be abbreviated
  prep?: { verb: string;       // "mince" — imperative, for "Meanwhile: mince garlic"
           done: string;       // "minced" — past participle, for the chip
           duration: Duration };
}

interface Component {
  id: string;
  name: string;                // "Sauce" — legend and line label
  outputName?: string;         // "seared eggplant" — chip label when merged into another line
  stations: Station[];         // in order
}

interface Station {
  id: string;
  title: string;               // "Simmer, lid on"
  attention: Attention;
  duration: Duration;
  adds: string[];              // ingredient ids added at this station
  merges: string[];            // component ids whose final state is combined in here
  cue?: string;                // "until thickened" — the doneness signal, when the recipe gives one
  detail?: string;             // original instruction text
}
```

Scheduling uses the midpoint of `min` and `max` (rounded up to whole minutes). Display uses the range.

### 5.2 Derived (not stored from the model)

```ts
interface Schedule {
  stations: Record<StationId, { start: number; end: number; order: number }>;
  meanwhile: Record<StationId, { prepIds: string[]; freeMinutes?: number }>;
  waits: { after: StationId; start: number; minutes: number }[]; // long hands-free stretches (§5.4 step 8)
  total: number;               // minutes, end of terminal station
}
```

Persist `RecipeGraph` plus user edits, `model`, and `promptVersion`. Always recompute `Schedule` and layout, so that improvements to the algorithm apply to saved recipes.

### 5.3 Validation rules
- IDs are unique; every reference resolves.
- Every component except the trunk is merged exactly once, into a station of another component.
- The merge graph is a tree rooted at the trunk (no cycles, and nothing unreachable from the trunk).
- The trunk's last station is the **terminal station**. Nothing comes after it.
- Every ingredient is added at exactly one station. If a recipe uses an ingredient twice ("½ the butter now, ½ later"), the model must split it into two ingredients.
- Durations:
  - `0 ≤ min ≤ max ≤ 600`
  - `quote` is present if and only if `basis` ≠ `"estimated"`
  - `"exact"` must not have a range wider than 1 minute, because an exact range is a contradiction.
- A station needs a title of 40 characters or fewer.
- Warnings (shown in Edit, not blocking): a component with only one station, more than 4 lanes live at once, more than 2 `exact` stations (likely over-classification), or a total over 6 h.

### 5.4 Scheduling (single cook)

The model is one cook. Components run in parallel, but **active** stations and prep tasks need the cook's hands and cannot overlap each other. **Tending** and **passive** stations don't occupy the cook.

1. **Dependencies:** a station can start once:
   - the previous station in its component has ended, **and**
   - every component it `merges` has finished its last station.
2. **List scheduling:** walk forward in time. Whenever the cook is free, start the ready station with the highest priority, where:
   - priority = the longest remaining path to the end of the terminal station (critical path, in minutes)
   - **plus a bonus for unlocking waiting time:** if the station's next station is passive, add that passive duration to the priority. This makes the scheduler get long walk-away steps going early (rinse the rice so it can simmer while you dice), which is how a cook would order them.
   - Remaining ties go to component order.

   Tending and passive stations start as soon as they are ready, highest priority first. Integer minutes throughout.
3. **Just in time:** food that is done early gets cold or soggy (warmed tortillas, toast, seared meat). After the forward pass, walk stations from latest to earliest and push each **active or tending** station as late as its successor allows, without overlapping the cook's other active work. **Passive** stations stay put, because resting, steeping and marinating hold fine, **unless** their line would otherwise finish more than 15 minutes (`LONG_HOLD`) before the station that merges it. Then the whole line slides later, walk-away steps included. A short hold is fine (the curry's rice rests 11 minutes and stays early), but garlic oil made two hours ahead of the focaccia reads as a mistake. This never extends the total. (In the pasta recipe, the sauce slides later so it finishes with the pasta.)
4. **Prep placement:** for each ingredient with `prep`, its deadline is the start of the station that adds it. Place the prep in the **latest** window before that deadline when the cook is free, i.e. not running an active station or another prep. Pack greedily, latest deadline first.
   Ties on deadline go in recipe order, so "Meanwhile" lists read in recipe order.
5. **Prep that fits no window becomes a station.** It is an implicit active station ("Mince garlic") on the consuming component, just before its consumer. The whole schedule is then recomputed, since the new station takes the cook's time, and this repeats until every prep is placed. If it's needed right away, it naturally becomes the first station of the map. Several preps for the same consumer are combined into one station titled "Prep", with each item as a chip. These stations carry `prepFor` (ingredient ids) and are never produced by the model.
6. **Meanwhile attribution:** each placed prep is attached to a tending or passive station that is running when the prep starts. Prefer one on the line that will use the prep, then the most recently started. For **passive** hosts, also compute `freeMinutes` = host duration − placed prep minutes. Show it only if it is ≥ 5.
7. **Row order:** stations sorted by `start`. Ties: stations continuing an existing line come before stations starting a new line, then by dispatch order.
8. **Waits:** between each pair of consecutive rows, find the longest stretch when nothing needs the cook: no active or tending station and no prep. Tending counts as busy, because you can't walk away from a pan that's searing. A stretch of 30 minutes or more (`LONG_WAIT`) is recorded as a wait after the earlier row and drawn as a broken line (§6.3).

**Acceptance:**
- The schedule is valid: all dependencies honored, and no overlap between active stations and preps.
- `total` is within 15% of the lower bound: the larger of the longest dependency chain and the total hands-on time (active stations plus prep).
- On the curry fixture, it reproduces the mockup's station order.

---

## 6. Style system: "Mise"

The map is used propped up on a counter, read at arm's length, in a bright kitchen, by someone with messy hands. That drives the decisions:
- larger type than a typical app
- warm paper-like light mode as an equal citizen alongside dark
- color reserved for the lines, the only data
- line identity carried by the sticky legend (tap to highlight) rather than labels on the map
- big tap targets

### 6.1 Tokens

Define all tokens on `:root` in `src/styles/tokens.css`:
- Light values are the default.
- Dark values are set under `@media (prefers-color-scheme: dark)`, guarded with `:root:not([data-theme="light"])`.
- Dark values are set again under `:root[data-theme="dark"]` for the Settings override.

**Surfaces and ink**

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#f8f4ec` | `#1a1815` | page background |
| `--paper-raised` | `#fffdf8` | `#24211d` | chips, meanwhile callouts, cards |
| `--rule` | `#e2dacb` | `#3a3631` | borders, dividers |
| `--ink-1` | `#22201c` (14.8:1) | `#f0ebe0` (14.9:1) | primary text |
| `--ink-2` | `#5c564c` (6.6:1) | `#b5ad9f` (8.0:1) | secondary text, quantities, timecodes |
| `--ink-3` | `#8a8377` | `#857e72` | non-text decoration only (icons beside text, dash gaps) |

Contrast ratios are measured against `--paper`. `--ink-2` also passes on `--paper-raised` (7.2:1 light / 7.2:1 dark).

**Line colors.** These were validated with the dataviz palette checker against both surfaces, all pairs (every pair of lines can be on screen at once). Lightness, chroma, CVD separation, normal-vision separation, and 3:1 contrast all pass.

| Slot | Name | Light | Dark |
|---|---|---|---|
| 1 (trunk) | tomato | `#d4471f` | `#e8643a` |
| 2 | blueberry | `#2a6fc4` | `#4a8fe0` |
| 3 | herb | `#1a8f5c` | `#2c9e6c` |
| 4 | cast iron (neutral) | `#6b655c` | `#a39c8d` |

- Worst all-pairs CVD ΔE is 8.7 in light mode and 8.5 in dark (the target is ≥ 8).
- A 4th *chromatic* hue (saffron, plum, etc.) failed: saffron is too close to tomato under deuteranopia, and plum is too close to blueberry. So slot 4 is a deliberate neutral, which differs from the other three by chroma.
- A 5th concurrent lane is a validation warning. It reuses slot 4 with a dotted pattern.
- Slots are assigned **from the trunk outward**: the trunk gets tomato, the lane next to it blueberry, and so on.
- Line colors are never used for text or UI chrome.

**Type.** Load from Google Fonts with `display=swap` and system fallbacks.

| Token | Spec | Use |
|---|---|---|
| `--font-ui` | Atkinson Hyperlegible Next, `system-ui` | everything by default |
| `--font-num` | Atkinson Hyperlegible Mono, `ui-monospace` | timecodes, durations |
| `--font-title` | Fraunces (opsz axis), `Georgia` | recipe title only |
| `--text-title` | 600 28/32 `--font-title` | recipe title |
| `--text-station` | 700 17/24 | station title |
| `--text-body` | 400 16/24 | body, meanwhile |
| `--text-chip` | 400 14/20 | ingredient chips |
| `--text-num` | 500 13/20 `--font-num`, `tabular-nums` | timecode, duration |
| `--text-label` | 700 11/16, letter-spacing 0.06em, uppercase | eyebrow, legend |

Atkinson Hyperlegible is designed for legibility at low vision, distance and glance, which is the kitchen use case. Fraunces gives the title some cookbook warmth and appears nowhere else.

**Spacing, shape, controls**
- Spacing scale: 4, 8, 12, 16, 24, 32, 48 (`--space-1`…`--space-7`).
- Radii: `--radius-chip` 6px, `--radius-card` 12px.
- Every tap target is at least 44×44 px.
- Primary button: `--ink-1` background with `--paper` text. Secondary button: 1px `--rule` outline.
- Focus ring: 2px `--ink-1` outline at a 2px offset.

### 6.2 Page structure (top to bottom)

Page: padding `24px 16px`, vertical gap `16px`, background `--paper`, text `--ink-1`.

1. **Header** (vertical, gap 4px):
   - **Eyebrow** (`--text-label`, `--ink-2`): `~{total} MIN · SERVES {servings}`. The servings part is omitted if unknown.
   - **Title** (`--text-title`).
2. **Legend:**
   - **Sticky** to the top of the screen (`position: sticky; top: 0`) on a `--paper` background, full-bleed to the page edges, with `env(safe-area-inset-top)` added to its top padding. It stays visible while you scroll so you can always tell the lines apart.
   - Flex-wrap, gap `8px 16px`, `--text-label`, `--ink-2`, padding 12px, bottom border 1px `--rule`.
   - One entry per component, leftmost lane first: a 4×16 px line sample in the line color, then the name.
   - Then one key entry, **WAITING**: a dashed sample in `--ink-3`. (`~` and `⏱` are self-explanatory and have no legend entry.)
   - Tapping a component entry highlights its line (§6.5).
3. **Map:** one row per station (§6.3).

### 6.3 Map rows and geometry

Each row is `display:flex; min-height:64px` with two parts:

- **Gutter:** `position:relative; flex:none`. Width = `28 × lanes + 8` px (92 px for 3 lanes).
- **Content:** `flex:1; min-width:0; padding:12px 0 16px; display:flex; flex-direction:column; gap:8px`.

**Lanes**
- Lane *i* (0 = leftmost) is centered at `x = 14 + 28i`.
- Each line segment is a 4 px wide absolutely positioned element at `left: x − 2`.
- The trunk is the rightmost lane.
- The other components sit to its left, ordered by **merge time**: the one that merges earliest is nearest its target. This keeps merge bars from crossing live lines.
- A component that merges into a non-trunk line goes immediately left of that line's lane.
- Lanes are reused once their component has merged, if a later component fits.

**Line segments.** For each lane that is live during a row, draw two half-segments that meet at the dot center (24 px):
- **Above the dot** is the run-up to this row. It is styled by the component's state at the **previous** row's start time.
- **Below the dot** is what happens from this row on. It is styled by the state at **this** row's start time.
- **Solid** (`background: <line color>`) if the component has an active or tending station running at that time.
- **Dashed** otherwise: a passive station is running, or the component is idle waiting for its next step.
  - Pattern: `repeating-linear-gradient(to bottom, <line color> 0 6px, transparent 6px 11px)`.
  - The 5th-lane dotted variant uses `0 3px, transparent 3px 7px`.
- **First station of a component:** only the lower half is drawn.
- **Merge row** (the row of the station that merges the component): only the upper half is drawn. A horizontal **merge bar** in the source line's color is drawn at `top:22px; height:4px`, spanning from the source x to the target x. The source lane ends there.

**Station dot** (on the station's own lane):
- 16×16 circle at `top:16px; left:x−8`
- `border: 3px solid <line color>; background: --paper`
- **Terminal station:** a 22×22 circle filled with the trunk color, with a 3px `--paper` inner ring (`box-shadow: inset 0 0 0 3px var(--paper)`), at `top:13px; left:x−11`. Every lane ends at 24 px in this row.

**Wait (broken line).** A wait (§5.4 step 8) is drawn as its own row after the row it follows, like an axis break on a chart: time is compressed here.
- The row has `min-height: 44px`, content vertically centered.
- Each live lane draws a segment from 0 to 14 px, a gap, then a segment from 30 px to the bottom. Both are in the lane's style at the wait's start (normally dashed).
- Two slashes sit in the gap, 14×3 px each, rotated −30°, in the lane color, centered on the lane at `top: 16px` and `top: 23px`.
- Label: `Wait ~1h 45m` in `--text-num`, `--ink-2`.

**Content**
1. **Heading line** (flex, gap 8px, baseline, wraps):
   - **Timecode:** elapsed `h:mm` (`0:20`, `1:05`), `--text-num`, `--ink-2`. Timecodes are sums of estimates and are always approximate. The `~` in the eyebrow covers them, so they don't repeat `~` on every row.
   - **Station title:** `--text-station`.
   - **Duration** (§6.4). Omitted on the terminal station.
2. **Chips** (flex-wrap, gap 6px), one per added ingredient and per merged component:
   - Style: `--text-chip`, background `--paper-raised`, 1px `--rule` border, `--radius-chip`, padding `2px 8px`.
   - Ingredient: `{name}` in `--ink-1`, then ` {qty}{, prep}` in `--ink-2`, e.g. `garlic 4 cloves, minced`.
   - Merged component: `+ {outputName ?? name}`.
   - The `+ ` prefix is used on every station except a component's first, where the ingredients *start* the line.
   - The terminal station shows no merge chips.
3. **Meanwhile callout** (when the station hosts prep):
   - Container: `--paper-raised` background, `--radius-card`, padding `8px 12px`, and a 3px left border in `--ink-3`.
   - Text (`--text-body`): **Meanwhile** in bold, followed by `: mince garlic, grate ginger`.
   - With free time: **Meanwhile** · 11 free min: juice lime, chop cilantro.
   - Prep items are lowercase action + name.

### 6.4 Duration display

| Basis | Display | Style |
|---|---|---|
| `estimated`, `stated` | `~8m`, `~8–10m` | `--text-num`, `--ink-2` |
| `exact` | `⏱ 6m` | 16px stopwatch icon (inline SVG, `currentColor`) + `--text-num` at weight 700, `--ink-1` |

- `aria-label` reads "about 8 minutes" or "exactly 6 minutes".
- When a station is expanded (§6.5), it shows the source line:
  - *Recipe says "8 to 10 minutes"* (from `quote`), or *Estimated*
  - then the `cue` if there is one: *until soft and translucent*.

  The cue is the real doneness signal and is never hidden behind the number.

### 6.5 Interaction (v1)
- **Tap a station:** it expands in place to show the time source, `cue`, and `detail`. Tap again to collapse. The whole row is the tap target.
- **Tap a legend entry:** highlights that line. Other lines and their dots drop to 25% opacity. Tap again to clear.
- **Export:** renders the map container to PNG at 2× via `html-to-image`, then opens the Web Share API (falls back to a download). The export uses the current theme.

---

## 7. Edit screen

A list grouped by component (with line color and name), where you can:
- rename stations, and change attention and duration (min/max/basis)
- move an ingredient to another station, and edit its qty and prep
- change which station a component merges into, and reorder stations within a component
- add or delete stations, ingredients and components
- set the trunk

Validation runs live, and errors block saving. The map preview below the form updates on every change. A raw JSON view is available for power users.

Capture, Processing, Edit, Library and Settings are built from the §6 tokens and components (buttons, cards, chips). They don't need separate mockups for v1.

---

## 8. Project layout

```
.github/workflows/deploy.yml
src/
  model/       schema.ts (zod types + JSON Schema export), validate.ts
  extract/     openrouter.ts, prompt.ts (Appendix A, versioned), repair.ts, image.ts (downscale)
  schedule/    schedule.ts, prep.ts
  layout/      lanes.ts, rows.ts            → pure: (graph, schedule) → RowModel[]
  ui/          TransitMap.tsx, Legend.tsx, Library.tsx, Capture.tsx, Edit.tsx, Settings.tsx
  store/       recipes.ts (idb), settings.ts (localStorage)
  styles/      tokens.css, base.css, transit.css
fixtures/      curry.json, …
designs/       reference mockups (not shipped)
```

Scheduling and layout are **pure functions** with no DOM. The UI renders `RowModel[]` and does no geometry decisions of its own.

---

## 9. Testing and evaluation

- **Fixtures:** recipe graphs written by hand.
  - `curry`: the mockup recipe; the scheduler must reproduce its station order.
  - a one-pot dish (single lane)
  - a two-vessel pasta dinner
  - a bake with long passive stretches
  - a nested merge (a component merging into a non-trunk line)
  - soft-boiled eggs on toast: an `exact` step
  - a recipe whose first step needs prep (a fallback "Prep" station)
- **Unit tests (Vitest):**
  - validation rules, including the duration and quote rules
  - scheduler invariants: dependencies honored, no overlap between active stations and preps, every prep placed or turned into a station, makespan bound
  - lane assignment and segment styles
  - duration formatting
- **Visual tests (Playwright, 390 px, light and dark):** screenshot baselines for each fixture, reviewed by eye once and then diffed.
- **Model eval:** a local script runs a folder of real recipe photos (10–20, your own) through candidate models and scores them against hand-corrected graphs on:
  - ingredient recall and precision
  - qty accuracy
  - component count
  - attention agreement
  - **time basis agreement**, especially false `exact` classifications
  - validation pass rate before and after repair
  - cost per recipe

  It picks the default model. The eval runs locally with your key, not in CI.

---

## 10. Deployment (GitHub Pages)

- `vite.config.ts` sets `base` from `process.env.VITE_BASE ?? "/"`. The workflow sets it to `/<repo-name>/`, so the site works under `https://<user>.github.io/<repo-name>/`.
- `vite-plugin-pwa` uses the same base for the manifest `start_url`/`scope` and the service worker scope.
- Hash routing (§2) means no `404.html` fallback is needed.
- `.github/workflows/deploy.yml`:
  - **Trigger:** push to `main`, plus `workflow_dispatch`.
  - **Permissions:** `contents: read`, `pages: write`, `id-token: write`.
  - **Build job:** `actions/checkout`, `actions/setup-node` (LTS, npm cache), `npm ci`, `npm test`, `npm run build` with `VITE_BASE=/${{ github.event.repository.name }}/`, then `actions/upload-pages-artifact` with `path: dist`.
  - **Deploy job:** `actions/deploy-pages`, `environment: github-pages`.
- **One-time repo setup (manual):** Settings → Pages → Source: **GitHub Actions**.
- No secrets are needed. The OpenRouter key never touches the repo or CI.

---

## 11. Milestones

1. **Renderer and deploy:**
   - tokens (light and dark)
   - the curry fixture rendered as a transit map with hand-pinned times
   - the Pages workflow, so it's viewable on a phone immediately
2. **Scheduler:** scheduling and prep placement; all fixtures render from computed schedules.
3. **Extraction:** Settings (key, model), the OpenRouter call with the Appendix A prompt, validation, repair; text input first, then images.
4. **App shell:** Library, Capture, Processing, IndexedDB, PWA install and offline use, PNG export/share.
5. **Edit screen.**
6. **Quality:** the eval set, prompt tuning, choosing the default model.

---

## 12. Open questions

1. **Timecodes without `~`.** Timecodes are always estimates, but the spec marks that once (eyebrow + legend) rather than on every row, to keep the rows clean. Alternative: drop timecodes entirely and rely on order plus durations.
2. **Fonts.** Atkinson Hyperlegible Next/Mono and Fraunces need to be checked on a phone in milestone 1. If Fraunces feels off, the title falls back to `--font-ui` at weight 800.

---

## Appendix A — Extraction prompt (v1)

System prompt, sent with the JSON schema. `src/extract/prompt.ts` is the source of truth; this copy is v1. Two worked examples follow it as earlier user/assistant turns: the source texts in `fixtures/sources/` paired with the `garlic-shrimp` and `sausage-pasta` fixtures in wire format.

```text
You convert a recipe (from photos or text) into a structured cooking plan for a
single home cook. Output JSON matching the provided schema exactly. Do not add
commentary. Use null for optional fields you have nothing for.

READ
- Transcribe the recipe faithfully, across all images in order. If something is
  illegible, leave it out rather than guess.
- Never invent ingredients, quantities, or times. Use null for a quantity you
  cannot read.

COMPONENTS
- Split the dish into components: things prepared separately and later combined
  (e.g. "Rice", "Eggplant", "Sauce"). Many recipes have only one.
- The trunk is the component the dish is finished and served in. Set `trunk` to
  its id.
- Each non-trunk component is merged exactly once, into a station of another
  component, by listing it in that station's `merges`. Give it an `outputName`
  describing what is merged ("seared eggplant", "cooked rice").

STATIONS
- Each component is an ordered list of stations. A station is one thing that
  happens to that component: "Sweat", "Bloom spices", "Simmer, lid on".
  Titles are 1–4 words, imperative, no ingredient lists.
- Put each ingredient in the `adds` of the station where it goes in.
- Small ingredient prep (mince, chop, grate, juice, zest, drain, measure, pat
  dry) is NOT a station. Record it as the ingredient's `prep`, with `verb` in
  the imperative ("mince", "drain and rinse") and `done` as the past participle
  ("minced", "drained"). Exception: if the prep is what starts a component
  ("Dice the eggplant" as the first thing done to it), make it that component's
  first station.
- If one ingredient is used at two different points ("half the butter now, the
  rest later"), create two ingredients with split quantities.
- Put the recipe's original sentence(s) for the step in `detail`. Put the doneness
  signal, if the recipe gives one, in `cue` ("until soft and translucent",
  "until a skewer comes out clean", "until doubled").
- Ids are short lowercase slugs ("dice-onion"), unique across the recipe. Do not
  start a station id with "prep-".

ATTENTION
- "active": the cook's hands are busy the whole time (chopping, kneading,
  whisking, stirring constantly, flipping pancakes).
- "tending": on the heat or in progress, cook stays nearby and checks or stirs
  occasionally, but could do small prep at the same time (sweating onions,
  searing, cooking down a sauce, boiling pasta).
- "passive": the cook can walk away (resting, marinating, simmering covered,
  baking, chilling, rising, salting eggplant to draw out water).

DURATION — classify every station's and prep's time with `basis`:
- "estimated": the recipe gives no time for this. Estimate a realistic time for a
  home cook. Set `quote` to null.
- "stated": the recipe gives a time, but the real test of doneness is something
  you can see, smell, taste, or touch, so the time is a guide. This is the
  normal case for recipe times. "Sauté 5–7 minutes until golden", "bake 25
  minutes or until a skewer comes out clean", "simmer about 20 minutes", and
  "cook 12 minutes" for most sautéing, roasting, and simmering are all "stated".
  Set `quote` to the time phrase verbatim.
- "exact": RARE. Use only when the clock itself is the doneness test, because
  the result changes noticeably within a minute or two AND there is no practical
  way to check by looking, or checking would ruin it. Examples:
    - boiled eggs to a specific doneness ("boil exactly 6½ minutes")
    - blanching or shocking for a specific texture ("blanch 60 seconds")
    - pressure cooking ("cook at high pressure 25 minutes")
    - covered steaming where the recipe says not to lift the lid
    - steeping tea or coffee for a set time
    - a recipe that explicitly says "exactly", "no more than", "set a timer"
  If you are unsure, use "stated". Set `quote` to the time phrase verbatim.
- Ranges: "8 to 10 minutes" → min 8, max 10. Single values: min only, max null.
- Times are whole minutes; convert hours ("1½ hours" → 90) and seconds
  ("90 seconds" → 2, rounding up).

CHECK BEFORE ANSWERING
- Every ingredient appears in exactly one station's `adds`.
- Every non-trunk component is merged exactly once; the trunk is never merged.
- The last station of the trunk is the final step (usually serving/finishing).
- Every "stated" or "exact" duration has a verbatim `quote\
```

The repair call reuses this prompt and adds: "The previous output failed validation with these errors: {errors}. Return the corrected JSON in full."
