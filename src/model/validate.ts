import type { Duration, RecipeGraph } from "./types";

export interface Validation {
  errors: string[]; // block saving; sent back to the model on repair
  warnings: string[]; // shown, not blocking
}

const MAX_MINUTES = 600;
const MAX_TITLE = 40;

// Graph rules from SPEC §5.3. Messages name the offending ids so the model can
// fix them on a repair pass.
export function validate(g: RecipeGraph): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const dupes = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);
  const stations = g.components.flatMap((c) => c.stations.map((s) => ({ s, c })));
  for (const id of new Set(dupes(g.ingredients.map((i) => i.id)))) errors.push(`Ingredient id "${id}" is used more than once.`);
  for (const id of new Set(dupes(g.components.map((c) => c.id)))) errors.push(`Component id "${id}" is used more than once.`);
  for (const id of new Set(dupes(stations.map(({ s }) => s.id)))) errors.push(`Station id "${id}" is used more than once.`);
  for (const { s } of stations) {
    if (s.id.startsWith("prep-")) errors.push(`Station id "${s.id}" must not start with "prep-" (reserved).`);
  }

  const ingredientIds = new Set(g.ingredients.map((i) => i.id));
  const componentIds = new Set(g.components.map((c) => c.id));
  if (!componentIds.has(g.trunk)) errors.push(`trunk "${g.trunk}" is not a component id.`);
  if (g.components.length === 0) errors.push("There are no components.");

  for (const c of g.components) {
    if (c.stations.length === 0) errors.push(`Component "${c.id}" has no stations.`);
  }

  // Ingredients: each added at exactly one station.
  const addedAt = new Map<string, string[]>();
  for (const { s } of stations) {
    for (const id of s.adds) {
      if (!ingredientIds.has(id)) errors.push(`Station "${s.id}" adds unknown ingredient "${id}".`);
      else addedAt.set(id, [...(addedAt.get(id) ?? []), s.id]);
    }
  }
  for (const i of g.ingredients) {
    const at = addedAt.get(i.id) ?? [];
    if (at.length === 0) errors.push(`Ingredient "${i.id}" is not added at any station.`);
    if (at.length > 1) {
      errors.push(
        `Ingredient "${i.id}" is added at ${at.length} stations (${at.join(", ")}); split it into one ingredient per use.`,
      );
    }
  }

  // Merges: every non-trunk component merged exactly once, into another component.
  const mergedAt = new Map<string, { station: string; into: string }[]>();
  for (const { s, c } of stations) {
    for (const id of s.merges) {
      if (!componentIds.has(id)) errors.push(`Station "${s.id}" merges unknown component "${id}".`);
      else if (id === c.id) errors.push(`Station "${s.id}" merges its own component "${id}".`);
      else mergedAt.set(id, [...(mergedAt.get(id) ?? []), { station: s.id, into: c.id }]);
    }
  }
  for (const c of g.components) {
    const at = mergedAt.get(c.id) ?? [];
    if (c.id === g.trunk) {
      if (at.length > 0) errors.push(`The trunk "${c.id}" must not be merged into anything (merged at ${at.map((m) => m.station).join(", ")}).`);
    } else if (at.length === 0) {
      errors.push(`Component "${c.id}" is never merged; add it to the "merges" of the station where it is combined.`);
    } else if (at.length > 1) {
      errors.push(`Component "${c.id}" is merged ${at.length} times (${at.map((m) => m.station).join(", ")}); merge it once.`);
    }
  }

  // The merge graph must be a tree rooted at the trunk.
  if (componentIds.has(g.trunk) && errors.length === 0) {
    const reached = new Set<string>();
    const visit = (id: string) => {
      if (reached.has(id)) return;
      reached.add(id);
      for (const s of g.components.find((c) => c.id === id)!.stations) s.merges.forEach(visit);
    };
    visit(g.trunk);
    for (const c of g.components) {
      if (!reached.has(c.id)) errors.push(`Component "${c.id}" never reaches the trunk "${g.trunk}" (its merges form a loop).`);
    }
  }

  // Durations and titles.
  const checkDuration = (where: string, d: Duration) => {
    const max = d.max ?? d.min;
    if (!(d.min >= 0 && d.min <= max && max <= MAX_MINUTES)) {
      errors.push(`${where}: duration must satisfy 0 ≤ min ≤ max ≤ ${MAX_MINUTES} (got min ${d.min}, max ${d.max ?? "none"}).`);
    }
    if (d.basis === "estimated" && d.quote) errors.push(`${where}: an "estimated" duration must not have a quote.`);
    if (d.basis !== "estimated" && !d.quote) errors.push(`${where}: a "${d.basis}" duration needs the recipe's time phrase as "quote".`);
    if (d.basis === "exact" && max - d.min > 1) errors.push(`${where}: an "exact" duration can't be a range wider than 1 minute.`);
  };
  for (const { s } of stations) {
    checkDuration(`Station "${s.id}"`, s.duration);
    if (s.title.length > MAX_TITLE) errors.push(`Station "${s.id}": title is longer than ${MAX_TITLE} characters.`);
  }
  for (const i of g.ingredients) if (i.prep) checkDuration(`Prep for "${i.id}"`, i.prep.duration);

  // Warnings.
  for (const c of g.components) {
    if (c.stations.length === 1 && g.components.length > 1) warnings.push(`"${c.name}" has only one step.`);
  }
  if (g.components.length > 4) warnings.push(`${g.components.length} lines may be crowded on a phone; consider merging some.`);
  const exact = stations.filter(({ s }) => s.duration.basis === "exact").length;
  if (exact > 2) warnings.push(`${exact} steps are marked exact; usually only one or two times really are.`);

  return { errors, warnings };
}
