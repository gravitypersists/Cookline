import type { Component, RecipeGraph, Schedule, Station } from "../model/types";
import { assignLanes, mergeTargets, type Lane } from "./lanes";

export type LineStyle = "solid" | "dashed";

export interface Segment {
  lane: number;
  from: "top" | "dot";
  to: "bottom" | "dot";
  style: LineStyle;
}

export interface MergeBar {
  from: number; // source lane
  to: number; // target lane
}

export interface Chip {
  label: string;
  secondary?: string;
  plus: boolean;
}

export interface RowModel {
  station: Station;
  componentId: string;
  lane: number;
  start: number;
  terminal: boolean;
  segments: Segment[];
  mergeBars: MergeBar[];
  chips: Chip[];
  meanwhile?: { items: string[]; freeMinutes?: number };
}

export interface MapModel {
  title: string;
  servings?: string;
  total: number;
  lanes: Lane[];
  rows: RowModel[];
}

// Pure: (graph, schedule) → everything the view draws. No geometry decisions
// are left to the UI (SPEC §8).
export function buildMap(graph: RecipeGraph, schedule: Schedule): MapModel {
  const lanes = assignLanes(graph, schedule);
  const laneOf = new Map(lanes.map((l) => [l.componentId, l.index]));
  const targets = mergeTargets(graph);
  const ingredients = new Map(graph.ingredients.map((i) => [i.id, i]));
  const components = new Map(graph.components.map((c) => [c.id, c]));
  const at = (id: string) => schedule.stations[id]!;

  const ordered = graph.components
    .flatMap((c) => c.stations.map((s) => ({ s, c })))
    .sort((a, b) => at(a.s.id).order - at(b.s.id).order);
  const rowOf = new Map(ordered.map(({ s }, i) => [s.id, i]));
  const terminalId = components.get(graph.trunk)!.stations.at(-1)!.id;

  // Each lane is live from its first station's row through the row it merges in
  // (or the terminal row, for the trunk).
  const span = new Map(
    graph.components.map((c) => {
      const end = targets.get(c.id)?.stationId ?? terminalId;
      return [c.id, { first: rowOf.get(c.stations[0]!.id)!, end: rowOf.get(end)! }];
    }),
  );

  // Solid while the component is hands-on or being tended at time t, dashed while
  // it waits (passive step or idle).
  const styleAt = (c: Component, t: number): LineStyle =>
    c.stations.some((s) => s.attention !== "passive" && at(s.id).start <= t && t < at(s.id).end)
      ? "solid"
      : "dashed";

  const rows = ordered.map(({ s, c }, row): RowModel => {
    const t = at(s.id).start;
    const segments: Segment[] = [];
    const mergeBars: MergeBar[] = [];

    for (const comp of graph.components) {
      const { first, end } = span.get(comp.id)!;
      if (row < first || row > end) continue;
      const lane = laneOf.get(comp.id)!;
      const target = targets.get(comp.id);
      if (row === end && target) mergeBars.push({ from: lane, to: laneOf.get(target.componentId)! });
      if (first === end) continue;
      const from = row === first ? "dot" : "top";
      const to = row === end ? "dot" : "bottom";
      // The top half of an ending row continues the line from the row above.
      const tStyle = to === "dot" ? at(ordered[row - 1]!.s.id).start : t;
      segments.push({ lane, from, to, style: styleAt(comp, tStyle) });
    }

    const terminal = s.id === terminalId;
    const isFirst = c.stations[0]!.id === s.id;
    const chips: Chip[] = [
      ...(terminal ? [] : s.merges).map((m) => {
        const mc = components.get(m)!;
        return { label: mc.outputName ?? mc.name, plus: true };
      }),
      ...s.adds.map((id) => {
        const ing = ingredients.get(id)!;
        const secondary = [ing.qty, ing.prep?.done].filter(Boolean).join(", ");
        return { label: ing.name, secondary: secondary || undefined, plus: !isFirst };
      }),
    ];

    const mw = schedule.meanwhile[s.id];
    const meanwhile = mw && {
      items: mw.prepIds.map((id) => {
        const ing = ingredients.get(id)!;
        return `${ing.prep!.verb} ${ing.name}`;
      }),
      freeMinutes: mw.freeMinutes !== undefined && mw.freeMinutes >= 5 ? mw.freeMinutes : undefined,
    };

    return {
      station: s,
      componentId: c.id,
      lane: laneOf.get(c.id)!,
      start: t,
      terminal,
      segments,
      mergeBars,
      chips,
      meanwhile,
    };
  });

  return { title: graph.title, servings: graph.servings, total: schedule.total, lanes, rows };
}
