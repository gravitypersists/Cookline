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

// Prices are always in cents, and fractions of a cent are written as fractions:
// "0.44¢" reads as 44¢ at a glance, "half a cent" can't. Costs snap to the
// nearest familiar fraction (nearest on a log scale, so a tenth and an eighth
// stay distinct) and to whole cents from 1¢ up.
const FRACTIONS: { cents: number; glyph: string; words: string }[] = [
  { cents: 0.1, glyph: "⅒", words: "a tenth of a cent" },
  { cents: 0.125, glyph: "⅛", words: "an eighth of a cent" },
  { cents: 0.2, glyph: "⅕", words: "a fifth of a cent" },
  { cents: 0.25, glyph: "¼", words: "a quarter of a cent" },
  { cents: 1 / 3, glyph: "⅓", words: "a third of a cent" },
  { cents: 0.5, glyph: "½", words: "half a cent" },
  { cents: 2 / 3, glyph: "⅔", words: "two-thirds of a cent" },
  { cents: 0.75, glyph: "¾", words: "three-quarters of a cent" },
];
const UNDER_A_TENTH = 0.075; // closer to nothing than to a tenth

type Rounded = { kind: "free" } | { kind: "tiny" } | { kind: "fraction"; glyph: string; words: string } | { kind: "cents"; n: number };

function roundCost(usd: number): Rounded {
  if (usd <= 0) return { kind: "free" };
  const cents = usd * 100;
  if (cents < UNDER_A_TENTH) return { kind: "tiny" };
  const candidates = [...FRACTIONS, { cents: 1, glyph: "", words: "" }];
  const nearest = candidates.reduce((a, b) =>
    Math.abs(Math.log(cents / b.cents)) < Math.abs(Math.log(cents / a.cents)) ? b : a,
  );
  if (cents < 1 && nearest.cents < 1) return { kind: "fraction", glyph: nearest.glyph, words: nearest.words };
  return { kind: "cents", n: Math.max(1, Math.round(cents)) };
}

const cents = (n: number) => `${n.toLocaleString("en-US")}¢`;

// Compact, for the model picker: "free", "<⅒¢", "⅛¢", "½¢", "2¢".
export function formatCostShort(usd: number): string {
  const r = roundCost(usd);
  if (r.kind === "free") return "free";
  if (r.kind === "tiny") return "<⅒¢";
  return r.kind === "fraction" ? `${r.glyph}¢` : cents(r.n);
}

// In words, for sentences: "free", "less than a tenth of a cent", "half a cent", "2¢".
export function formatCostWords(usd: number): string {
  const r = roundCost(usd);
  if (r.kind === "free") return "free";
  if (r.kind === "tiny") return "less than a tenth of a cent";
  return r.kind === "fraction" ? r.words : cents(r.n);
}

// For the picker: one figure when text and photo round the same.
export function costLabel(e: CostEstimate): string {
  const text = formatCostShort(e.text);
  const photo = formatCostShort(e.photo);
  if (text === photo) return text === "free" ? "free" : `~${text}`;
  return `~${text} text · ${photo} photo`;
}

// For under the picker.
export function costSentence(e: CostEstimate): string {
  const text = formatCostWords(e.text);
  const photo = formatCostWords(e.photo);
  if (text === "free" && photo === "free") return "Free to use.";
  return text === photo
    ? `About ${text} per recipe, from text or a photo.`
    : `About ${text} per recipe from text, ${photo} from a photo.`;
}
