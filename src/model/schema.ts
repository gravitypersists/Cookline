import { z } from "zod";
import type { Duration, RecipeGraph } from "./types";

// What the model must return (SPEC §4.1). Strict structured outputs need every
// property present, so optional fields are nullable here and become undefined
// in the app's RecipeGraph (fromWire).

const WireDuration = z.strictObject({
  min: z.number(),
  max: z.number().nullable(),
  basis: z.enum(["estimated", "stated", "exact"]),
  quote: z.string().nullable(),
});

const WireIngredient = z.strictObject({
  id: z.string(),
  name: z.string(),
  qty: z.string().nullable(),
  prep: z.strictObject({ verb: z.string(), done: z.string(), duration: WireDuration }).nullable(),
});

const WireStation = z.strictObject({
  id: z.string(),
  title: z.string(),
  attention: z.enum(["active", "tending", "passive"]),
  duration: WireDuration,
  adds: z.array(z.string()),
  merges: z.array(z.string()),
  cue: z.string().nullable(),
  detail: z.string().nullable(),
});

const WireComponent = z.strictObject({
  id: z.string(),
  name: z.string(),
  outputName: z.string().nullable(),
  stations: z.array(WireStation),
});

export const WireRecipe = z.strictObject({
  title: z.string(),
  servings: z.string().nullable(),
  ingredients: z.array(WireIngredient),
  components: z.array(WireComponent),
  trunk: z.string(),
});

export type WireRecipe = z.infer<typeof WireRecipe>;

export function recipeJsonSchema(): Record<string, unknown> {
  const { $schema: _, ...schema } = z.toJSONSchema(WireRecipe) as Record<string, unknown>;
  return schema;
}

const opt = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

function durationFromWire(d: z.infer<typeof WireDuration>): Duration {
  return { min: d.min, max: opt(d.max), basis: d.basis, quote: opt(d.quote) };
}

function durationToWire(d: Duration): z.infer<typeof WireDuration> {
  return { min: d.min, max: d.max ?? null, basis: d.basis, quote: d.quote ?? null };
}

export function fromWire(w: WireRecipe): RecipeGraph {
  return {
    title: w.title,
    servings: opt(w.servings),
    trunk: w.trunk,
    ingredients: w.ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      qty: opt(i.qty),
      prep: i.prep ? { verb: i.prep.verb, done: i.prep.done, duration: durationFromWire(i.prep.duration) } : undefined,
    })),
    components: w.components.map((c) => ({
      id: c.id,
      name: c.name,
      outputName: opt(c.outputName),
      stations: c.stations.map((s) => ({
        id: s.id,
        title: s.title,
        attention: s.attention,
        duration: durationFromWire(s.duration),
        adds: s.adds,
        merges: s.merges,
        cue: opt(s.cue),
        detail: opt(s.detail),
      })),
    })),
  };
}

// For few-shot examples and repair prompts.
export function toWire(g: RecipeGraph): WireRecipe {
  return {
    title: g.title,
    servings: g.servings ?? null,
    ingredients: g.ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      qty: i.qty ?? null,
      prep: i.prep ? { verb: i.prep.verb, done: i.prep.done, duration: durationToWire(i.prep.duration) } : null,
    })),
    components: g.components.map((c) => ({
      id: c.id,
      name: c.name,
      outputName: c.outputName ?? null,
      stations: c.stations.map((s) => ({
        id: s.id,
        title: s.title,
        attention: s.attention,
        duration: durationToWire(s.duration),
        adds: s.adds,
        merges: s.merges,
        cue: s.cue ?? null,
        detail: s.detail ?? null,
      })),
    })),
    trunk: g.trunk,
  };
}
