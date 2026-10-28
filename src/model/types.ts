// Recipe graph as extracted by the model (SPEC §5.1). Zod schemas replace
// these hand-written types in milestone 3.

export type Attention = "active" | "tending" | "passive";

export type TimeBasis = "estimated" | "stated" | "exact";

export interface Duration {
  min: number;
  max?: number;
  basis: TimeBasis;
  quote?: string;
}

export interface Prep {
  verb: string; // imperative, for "Meanwhile: mince garlic"
  done: string; // past participle, for the chip: "garlic 4 cloves, minced"
  duration: Duration;
}

export interface Ingredient {
  id: string;
  name: string;
  qty?: string;
  prep?: Prep;
}

export interface Station {
  id: string;
  title: string;
  attention: Attention;
  duration: Duration;
  adds: string[];
  merges: string[];
  cue?: string;
  detail?: string;
  // Set only on stations the scheduler inserts for prep that fit no downtime
  // window (SPEC §5.4 step 4); never produced by the model.
  prepFor?: string[];
}

export interface Component {
  id: string;
  name: string;
  outputName?: string;
  stations: Station[];
}

export interface RecipeGraph {
  title: string;
  servings?: string;
  ingredients: Ingredient[];
  components: Component[];
  trunk: string;
}

// Derived by the scheduler (SPEC §5.2).
export interface Schedule {
  stations: Record<string, { start: number; end: number; order: number }>;
  meanwhile: Record<string, { prepIds: string[]; freeMinutes?: number }>;
  // Long stretches with nothing needing you, drawn as a broken line after the row
  // they follow (SPEC §6.3).
  waits: { after: string; start: number; minutes: number }[];
  total: number;
}
