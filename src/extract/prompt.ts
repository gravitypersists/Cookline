import { toWire } from "../model/schema";
import { fixtures } from "../../fixtures";
import shrimpSource from "../../fixtures/sources/garlic-shrimp.txt?raw";
import pastaSource from "../../fixtures/sources/sausage-pasta.txt?raw";

// Bump whenever the prompt or examples change; saved with each recipe so eval
// results stay comparable (SPEC §4.1).
export const PROMPT_VERSION = 2;

// SPEC Appendix A.
export const SYSTEM_PROMPT = `You convert a recipe (from photos or text) into a structured cooking plan for a
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
- The trunk is the component the dish is finished and served in. Set \`trunk\` to
  its id.
- Each non-trunk component is merged exactly once, into a station of another
  component, by listing it in that station's \`merges\`. Give it an \`outputName\`
  describing what is merged ("seared eggplant", "cooked rice").

STATIONS
- Each component is an ordered list of stations. A station is one thing that
  happens to that component: "Sweat", "Bloom spices", "Simmer, lid on".
  Titles are 1–4 words, imperative, no ingredient lists.
- Put each ingredient in the \`adds\` of the station where it goes in.
- Small ingredient prep (mince, chop, grate, juice, zest, drain, measure, pat
  dry) is NOT a station. Record it as the ingredient's \`prep\`, with \`verb\` in
  the imperative ("mince", "drain and rinse") and \`done\` as the past participle
  ("minced", "drained"). Exception: if the prep is what starts a component
  ("Dice the eggplant" as the first thing done to it), make it that component's
  first station.
- If one ingredient is used at two different points ("half the butter now, the
  rest later"), create two ingredients with split quantities.
- Put the recipe's original sentence(s) for the step in \`detail\`. Put the doneness
  signal, if the recipe gives one, in \`cue\` ("until soft and translucent",
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

DURATION — classify every station's and prep's time with \`basis\`:
- "estimated": the recipe gives no time for this. Estimate a realistic time for a
  home cook. Set \`quote\` to null.
- "stated": the recipe gives a time, but the real test of doneness is something
  you can see, smell, taste, or touch, so the time is a guide. This is the
  normal case for recipe times. "Sauté 5–7 minutes until golden", "bake 25
  minutes or until a skewer comes out clean", "simmer about 20 minutes", and
  "cook 12 minutes" for most sautéing, roasting, and simmering are all "stated".
  Set \`quote\` to the time phrase verbatim.
- "exact": RARE. Use only when the clock itself is the doneness test, because
  the result changes noticeably within a minute or two AND there is no practical
  way to check by looking, or checking would ruin it. Examples:
    - boiled eggs to a specific doneness ("boil exactly 6½ minutes")
    - blanching or shocking for a specific texture ("blanch 60 seconds")
    - pressure cooking ("cook at high pressure 25 minutes")
    - covered steaming where the recipe says not to lift the lid
    - steeping tea or coffee for a set time
    - a recipe that explicitly says "exactly", "no more than", "set a timer"
  If you are unsure, use "stated". Set \`quote\` to the time phrase verbatim.
- Ranges: "8 to 10 minutes" → min 8, max 10. Single values: min only, max null.
- Times are whole minutes; convert hours ("1½ hours" → 90) and seconds
  ("90 seconds" → 2, rounding up).

COOK'S NOTES
- With photos, the message may include "TEXT FROM THE COOK": notes on how they
  will cook this recipe, or recipe text the photos don't show (treat that as
  part of the recipe). Any message may end with "COOK'S KITCHEN": how this cook
  always works. Plan the way this cook will actually cook: where a note changes
  the method, follow the note. For example, with a rice
  cooker the rice becomes one passive "Rice cooker" station instead of a simmer,
  and a stand mixer makes kneading a passive station.
- Notes change the method, not the recipe. Don't add, drop or rescale
  ingredients unless a note explicitly says to. Ignore notes that don't apply.
- Times a note changes are "estimated" unless the note states a time.

CHECK BEFORE ANSWERING
- Every ingredient appears in exactly one station's \`adds\`.
- Every non-trunk component is merged exactly once; the trunk is never merged.
- The last station of the trunk is the final step (usually serving/finishing).
- Every "stated" or "exact" duration has a verbatim \`quote\`; no "estimated" one does.`;

// Worked examples, sent as earlier user/assistant turns.
export const EXAMPLES: { source: string; output: string }[] = [
  { source: shrimpSource, output: JSON.stringify(toWire(fixtures["garlic-shrimp"]!)) },
  { source: pastaSource, output: JSON.stringify(toWire(fixtures["sausage-pasta"]!)) },
];

export function repairPrompt(errors: string[]): string {
  return `The previous output failed validation with these errors:
${errors.map((e) => `- ${e}`).join("\n")}

Return the corrected JSON in full.`;
}
