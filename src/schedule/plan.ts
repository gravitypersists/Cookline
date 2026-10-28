import type { Duration, RecipeGraph, Schedule, Station } from "../model/types";
import { plannedMinutes } from "../format/time";
import { scheduleStations, type Timed } from "./schedule";
import { placePreps, type PlacedPrep } from "./prep";

export interface Plan {
  graph: RecipeGraph; // the input plus any inserted prep stations
  schedule: Schedule;
  preps: PlacedPrep[]; // where each meanwhile prep was fitted, for checking
}

// Schedule a recipe end to end (SPEC §5.4). Prep that fits no downtime window
// becomes its own active station just before the step that needs it, and the
// whole schedule is recomputed, since that station takes the cook's time.
export function plan(input: RecipeGraph): Plan {
  let graph = input;
  for (;;) {
    const timed = scheduleStations(graph);
    const { placed, unplaced } = placePreps(graph, timed);
    if (unplaced.length === 0) return { graph, schedule: toSchedule(graph, timed, placed), preps: placed };
    graph = insertPrepStations(graph, unplaced);
  }
}

function toSchedule(
  graph: RecipeGraph,
  timed: Map<string, Timed>,
  placed: PlacedPrep[],
): Schedule {
  const firsts = new Set(graph.components.map((c) => c.stations[0]!.id));
  // Rows: by start time; continuing lines before new ones; then dispatch order.
  const rows = [...timed.values()].sort(
    (a, b) =>
      a.start - b.start ||
      Number(firsts.has(a.station.id)) - Number(firsts.has(b.station.id)) ||
      a.dispatch - b.dispatch,
  );

  const stations: Schedule["stations"] = {};
  rows.forEach((t, order) => (stations[t.station.id] = { start: t.start, end: t.end, order }));

  const meanwhile: Schedule["meanwhile"] = {};
  for (const p of [...placed].sort((a, b) => a.start - b.start)) {
    (meanwhile[p.hostId] ??= { prepIds: [] }).prepIds.push(p.ingredientId);
  }
  for (const [hostId, m] of Object.entries(meanwhile)) {
    const host = timed.get(hostId)!;
    if (host.station.attention !== "passive") continue;
    const used = placed.filter((p) => p.hostId === hostId).reduce((n, p) => n + p.end - p.start, 0);
    m.freeMinutes = host.end - host.start - used;
  }

  const total = Math.max(...rows.map((t) => t.end));
  return { stations, meanwhile, waits: findWaits(rows, placed), total };
}

// Hands-free stretches of at least LONG_WAIT minutes between consecutive rows.
// Tending counts as busy: you can't walk away from a pan that's searing.
export const LONG_WAIT = 30;

function findWaits(rows: Timed[], placed: PlacedPrep[]): Schedule["waits"] {
  const busy = [
    ...rows.filter((t) => t.station.attention !== "passive"),
    ...placed,
  ].filter((b) => b.end > b.start);

  const waits: Schedule["waits"] = [];
  for (let i = 0; i + 1 < rows.length; i++) {
    const from = rows[i]!.start;
    const to = rows[i + 1]!.start;
    // Walk the span, skipping past busy intervals, and keep the longest free run.
    let best = { start: from, minutes: 0 };
    let t = from;
    while (t < to) {
      const blocking = busy.filter((b) => b.start <= t && b.end > t);
      if (blocking.length) {
        t = Math.max(...blocking.map((b) => b.end));
        continue;
      }
      const freeEnd = Math.min(to, ...busy.filter((b) => b.start > t).map((b) => b.start));
      if (freeEnd - t > best.minutes) best = { start: t, minutes: freeEnd - t };
      t = freeEnd;
    }
    if (best.minutes >= LONG_WAIT) waits.push({ after: rows[i]!.station.id, ...best });
  }
  return waits;
}

function insertPrepStations(
  graph: RecipeGraph,
  unplaced: { ingredientId: string; consumerId: string }[],
): RecipeGraph {
  const byConsumer = new Map<string, string[]>();
  for (const u of unplaced) byConsumer.set(u.consumerId, [...(byConsumer.get(u.consumerId) ?? []), u.ingredientId]);
  const ingredients = new Map(graph.ingredients.map((i) => [i.id, i]));

  const order = (id: string) => graph.ingredients.findIndex((i) => i.id === id);
  const prepStation = (consumerId: string, ids: string[]): Station => {
    ids = [...ids].sort((a, b) => order(a) - order(b)); // recipe order
    const preps = ids.map((id) => ingredients.get(id)!);
    const only = preps.length === 1 ? preps[0]! : undefined;
    const minutes = preps.reduce((n, i) => n + plannedMinutes(i.prep!.duration), 0);
    const duration: Duration = { min: minutes, basis: "estimated" };
    return {
      id: `prep-${consumerId}`,
      title: only ? capitalize(`${only.prep!.verb} ${only.name}`) : "Prep",
      attention: "active",
      duration,
      adds: [],
      merges: [],
      prepFor: ids,
    };
  };

  return {
    ...graph,
    components: graph.components.map((c) => ({
      ...c,
      stations: c.stations.flatMap((s) => {
        if (s.prepFor) return []; // rebuilt below with any new items
        const ids = byConsumer.get(s.id);
        const existing = c.stations.find((x) => x.id === `prep-${s.id}`)?.prepFor ?? [];
        if (!ids && existing.length === 0) return [s];
        return [prepStation(s.id, [...existing, ...(ids ?? [])]), s];
      }),
    })),
  };
}

const capitalize = (s: string) => s[0]!.toUpperCase() + s.slice(1);
