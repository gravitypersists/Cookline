import { WireRecipe, fromWire, recipeJsonSchema } from "../model/schema";
import type { RecipeGraph } from "../model/types";
import { validate } from "../model/validate";
import { complete, type Content, type Message } from "./openrouter";
import { EXAMPLES, PROMPT_VERSION, SYSTEM_PROMPT, repairPrompt } from "./prompt";

export type ExtractInput = { kind: "text"; text: string } | { kind: "images"; images: string[] }; // data URLs

export type Stage = "reading" | "repairing";

export interface Extraction {
  graph: RecipeGraph;
  warnings: string[];
  model: string;
  promptVersion: number;
  cost?: number;
  repaired: boolean;
}

// Validation still failed after the repair pass. Carries what parsed, so the
// user can fix it by hand (Edit, milestone 5).
export class ExtractionError extends Error {
  constructor(
    readonly errors: string[],
    readonly raw: string,
    readonly graph?: RecipeGraph,
  ) {
    super("The recipe couldn't be turned into a valid map.");
  }
}

function userContent(input: ExtractInput): Content {
  if (input.kind === "text") return input.text;
  return [
    { type: "text", text: `Here ${input.images.length === 1 ? "is the recipe" : `are ${input.images.length} photos of the recipe, in order`}.` },
    ...input.images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];
}

type Checked = { graph?: RecipeGraph; errors: string[]; warnings: string[] };

function check(raw: string): Checked {
  let json: unknown;
  try {
    // Some models wrap JSON in a code fence despite structured output.
    json = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return { errors: ["The output was not valid JSON."], warnings: [] };
  }
  const parsed = WireRecipe.safeParse(json);
  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map((i) => `At ${i.path.join(".") || "top level"}: ${i.message}`),
      warnings: [],
    };
  }
  const graph = fromWire(parsed.data);
  return { graph, ...validate(graph) };
}

// SPEC §4: one call, validate, at most one repair call.
export async function extractRecipe(opts: {
  input: ExtractInput;
  apiKey: string;
  model: string;
  signal?: AbortSignal;
  onStage?: (stage: Stage) => void;
}): Promise<Extraction> {
  const schema = recipeJsonSchema();
  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...EXAMPLES.flatMap((e): Message[] => [
      { role: "user", content: e.source },
      { role: "assistant", content: e.output },
    ]),
    { role: "user", content: userContent(opts.input) },
  ];
  const call = (msgs: Message[]) =>
    complete({ apiKey: opts.apiKey, model: opts.model, messages: msgs, schema, signal: opts.signal });

  opts.onStage?.("reading");
  const first = await call(messages);
  let cost = first.cost;
  let raw = first.content;
  let result = check(raw);
  let repaired = false;

  if (result.errors.length > 0) {
    opts.onStage?.("repairing");
    const second = await call([
      ...messages,
      { role: "assistant", content: raw },
      { role: "user", content: repairPrompt(result.errors) },
    ]);
    cost = cost !== undefined && second.cost !== undefined ? cost + second.cost : undefined;
    raw = second.content;
    const retry = check(raw);
    // Keep the first parse if the repair didn't even parse, so there's something to edit.
    result = retry.graph || !result.graph ? retry : { ...retry, graph: result.graph };
    repaired = true;
  }

  if (result.errors.length > 0 || !result.graph) throw new ExtractionError(result.errors, raw, result.graph);
  return { graph: result.graph, warnings: result.warnings, model: opts.model, promptVersion: PROMPT_VERSION, cost, repaired };
}
