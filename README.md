# Cookline

Photograph a recipe and get a **transit map** of it: a phone-sized chart where each part of the dish is a colored line, steps are stations in the order you start them, and lines merge where parts combine. At a glance you can see what runs in parallel, when your hands are free, and what to prep during that downtime, so you don't need full mise en place before you start.

<p align="center">
  <img src="docs/transit-map.png" alt="Transit map of an eggplant and chickpea curry in light and dark mode: rice, eggplant and sauce lines run down the page, merging into the sauce line, with Meanwhile notes for prep during downtime" width="800">
</p>

## Reading the map

- **Lines** are the parts of the dish (rice, eggplant, sauce). The rightmost line is the one the dish is finished in. The legend stays at the top of the screen; tap an entry to highlight its line.
- **Solid** means hands on or tending the pan. **Dashed** means waiting: simmering covered, resting, rising.
- **Meanwhile** notes are small prep (mince, grate, juice) fitted into the downtime before it's needed.
- **Times are estimates** (`~8m`), because 12 minutes is hardly ever 12 minutes. The doneness cue ("until translucent") is one tap away. The rare time that really matters, like soft-boiled eggs, is marked exact (`⏱ 7m`).
- **A broken line** (`//`) marks a long wait with nothing for you to do, like a dough rise.

## How it works

```
photo(s) or text ──► vision model via OpenRouter ──► recipe graph (JSON, schema-checked)
                                                          │  invalid → one repair pass
                                                          ▼
                       transit map ◄── layout ◄── single-cook scheduler
```

The model only extracts the recipe's structure: the parts, the steps, what's added where, how much attention each step needs, and time estimates. Everything else is plain, tested code: the scheduler (one pair of hands, long waits started early, food finished just in time, prep slotted into downtime) and the layout. Edits re-render instantly without another model call.

## Running it

```sh
npm install
npm run dev      # http://localhost:5173
npm test
npm run build    # static site in dist/
```

Open **Settings** and paste an [OpenRouter](https://openrouter.ai) API key, then tap **New recipe**. The example recipes on the home screen work without a key. On a phone, use **Add to Home Screen** to install it; saved recipes work offline.

## Costs and privacy

- **No server and no subscription.** It's a static site, and the browser calls OpenRouter directly.
- **You pay OpenRouter per recipe read.** The recommended model, Claude Haiku 5.5, costs about an eighth of a cent per recipe. Settings lists other models with an estimated cost per recipe for each.
- **Your key stays on your device** (in `localStorage`) and is only sent to openrouter.ai. Settings can clear it.
- **Sharing:** Settings can make a one-time link that sets Cookline up on someone else's phone, with your key or one made for them. The key is encrypted on your device and stored on [PrivateBin](https://privatebin.net), which can't read it and deletes it the moment the link is opened. Unused links expire after a day.

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes to GitHub Pages. To set it up once, open the repo's **Settings → Pages** and set **Source** to **GitHub Actions**.

## Project layout

```
src/model/     recipe types, wire schema (zod), validation
src/extract/   OpenRouter client, extraction prompt, repair pass, photo downscaling
src/schedule/  single-cook scheduler and prep placement
src/layout/    lanes and rows for the map (pure functions)
src/share/     one-time encrypted share links via PrivateBin
src/store/     saved recipes (IndexedDB) and settings (localStorage)
src/ui/        Preact screens and the transit map
fixtures/      hand-written recipes covering the main shapes
SPEC.md        the full spec: data model, scheduling rules, style system, prompt
```

## Status

Done:
- Milestone 1: the renderer
- Milestone 2: the scheduler
- Milestone 3: extraction (not yet tried with a real OpenRouter key)
- Milestone 4: the recipe library (saved on the phone, works offline), installing as an app, sharing a map as an image

Next:
- an edit screen
- a model eval

See `SPEC.md` §11.
