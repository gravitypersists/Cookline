import { recipeJsonSchema } from "../model/schema";
import type { ModelInfo } from "./openrouter";
import { EXAMPLES, SYSTEM_PROMPT } from "./prompt";

// Rough per-recipe cost estimates for the model picker. Real costs vary with
// the recipe's length, and a repair pass (when needed) roughly doubles them.

const CHARS_PER_TOKEN = 3.6; // between prose (~4) and JSON (~3.3)
const tokens = (chars: number) => Math.ceil(chars / CHARS_PER_TOKEN);

// Sent with every request: instructions, worked examples, and the JSON schema.
const PROMPT_TOKENS = tokens(
  SYSTEM_PROMPT.length +
    EXAMPLES.reduce((n, e) => n + e.source.length + e.output.length, 0) +
    JSON.stringify(recipeJsonSchema()).length,
);
const RECIPE_TEXT_TOKENS = 450; // a typical pasted recipe, ~1,600 characters
const OUTPUT_TOKENS = 1500; // a detailed graph like the curry fixture, ~5,800 characters

// Tokens for one photo after downscaling to 1600×1200. Each family counts images
// differently, and OpenRouter's metadata doesn't say, so these are rough.
function photoTokens(modelId: string): number {
  if (modelId.startsWith("anthropic/")) return 2460; // (w×h)/750 after fitting 1568 px
  if (modelId.startsWith("openai/")) return 765; // high detail: four 512 px tiles + base
  if (modelId.startsWith("google/")) return 1300;
  return 1500;
}

export interface CostEstimate {
  text: number; // USD per recipe read from pasted text
  photo: number; // USD per recipe read from one photo
}

export function estimateCost(m: ModelInfo): CostEstimate {
  const perIn = m.promptPerM / 1e6;
  const perImage = (m.imagePerM ?? m.promptPerM) / 1e6;
  const base = PROMPT_TOKENS * perIn + OUTPUT_TOKENS * (m.completionPerM / 1e6);
  return { text: base + RECIPE_TEXT_TOKENS * perIn, photo: base + photoTokens(m.id) * perImage };
}

// "0.11¢", "2.3¢", "$0.12", "free". Two significant figures, so a photo's
// small surcharge over text still shows.
export function formatCost(usd: number): string {
  if (usd <= 0) return "free";
  const cents = usd * 100;
  if (cents < 10) return `${Number(cents.toPrecision(2))}¢`;
  return `$${usd.toFixed(2)}`;
}

// Short form for the picker: one number when text and photo round the same.
export function costLabel(e: CostEstimate): string {
  const text = formatCost(e.text);
  const photo = formatCost(e.photo);
  if (text === photo) return text === "free" ? "free" : `~${text}`;
  return `~${text} text · ${photo} photo`;
}

// Sentence form for under the picker.
export function costSentence(e: CostEstimate): string {
  const text = formatCost(e.text);
  const photo = formatCost(e.photo);
  if (text === "free" && photo === "free") return "Free to use.";
  return text === photo
    ? `About ${text} per recipe, from text or a photo.`
    : `About ${text} per recipe from text, ${photo} from a photo.`;
}
