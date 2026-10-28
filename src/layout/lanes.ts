import type { RecipeGraph, Schedule } from "../model/types";

export interface Lane {
  componentId: string;
  name: string;
  index: number; // 0 = leftmost
  slot: 1 | 2 | 3 | 4; // line color, counted from the trunk outward (SPEC §6.1)
  alt: boolean; // 5th+ lane: reuses slot 4 with a dotted pattern
}

export interface MergeTarget {
  componentId: string; // the component merged into
  stationId: string; // the station that merges it
}

// For every non-trunk component, the station that merges it.
export function mergeTargets(graph: RecipeGraph): Map<string, MergeTarget> {
  const targets = new Map<string, MergeTarget>();
  for (const c of graph.components) {
    for (const s of c.stations) {
      for (const m of s.merges) targets.set(m, { componentId: c.id, stationId: s.id });
    }
  }
  return targets;
}

// Lane order (SPEC §6.3): the trunk is rightmost; each component's children sit
// immediately to its left, the earliest merge nearest. A merged line therefore
// only ever crosses lanes that have already ended.
export function assignLanes(graph: RecipeGraph, schedule: Schedule): Lane[] {
  const targets = mergeTargets(graph);
  const children = new Map<string, string[]>();
  for (const [child, t] of targets) {
    children.set(t.componentId, [...(children.get(t.componentId) ?? []), child]);
  }
  const mergeStart = (id: string) => schedule.stations[targets.get(id)!.stationId]!.start;

  const order = (id: string): string[] => {
    const kids = [...(children.get(id) ?? [])].sort((a, b) => mergeStart(b) - mergeStart(a));
    return [...kids.flatMap(order), id];
  };

  const ids = order(graph.trunk);
  const byId = new Map(graph.components.map((c) => [c.id, c]));
  return ids.map((id, index) => {
    const fromTrunk = ids.length - 1 - index;
    return {
      componentId: id,
      name: byId.get(id)!.name,
      index,
      slot: Math.min(fromTrunk + 1, 4) as Lane["slot"],
      alt: fromTrunk >= 4,
    };
  });
}
