import type { RecipeGraph } from "../model/types";
import { plannedMinutes } from "../format/time";
import type { Timed } from "./schedule";

export interface PlacedPrep {
  ingredientId: string;
  start: number;
  end: number;
  hostId: string; // the tending/passive station it happens alongside
}

export interface PrepResult {
  placed: PlacedPrep[];
  unplaced: { ingredientId: string; consumerId: string }[];
}

interface Interval {
  start: number;
  end: number;
}

// SPEC §5.4 steps 3 and 5: fit each ingredient's prep into the latest stretch
// before it is needed when the cook's hands are free, and attach it to the
// station that is cooking at that moment.
export function placePreps(graph: RecipeGraph, timed: Map<string, Timed>): PrepResult {
  const consumer = new Map<string, string>();
  const asStation = new Set<string>(); // prep already turned into a station
  for (const c of graph.components) {
    for (const s of c.stations) {
      for (const id of s.adds) consumer.set(id, s.id);
      for (const id of s.prepFor ?? []) asStation.add(id);
    }
  }

  const busy: Interval[] = [...timed.values()]
    .filter((t) => t.station.attention === "active" && t.end > t.start)
    .map(({ start, end }) => ({ start, end }));

  const preps = graph.ingredients
    .filter((i) => i.prep && !asStation.has(i.id))
    .map((i) => ({
      id: i.id,
      index: graph.ingredients.indexOf(i),
      minutes: plannedMinutes(i.prep!.duration),
      consumerId: consumer.get(i.id)!,
      deadline: timed.get(consumer.get(i.id)!)!.start,
    }))
    // Latest deadline first, so earlier preps fill in behind them; on a tie the
    // later ingredient goes last, keeping "Meanwhile" lists in recipe order.
    .sort((a, b) => b.deadline - a.deadline || b.index - a.index);

  const placed: PlacedPrep[] = [];
  const unplaced: PrepResult["unplaced"] = [];

  for (const p of preps) {
    const slot = latestFreeSlot(busy, p.deadline, p.minutes);
    const host = slot && hostAt(timed, slot.start, timed.get(p.consumerId)!.componentId);
    if (!slot || !host) {
      unplaced.push({ ingredientId: p.id, consumerId: p.consumerId });
      continue;
    }
    busy.push(slot);
    placed.push({ ingredientId: p.id, ...slot, hostId: host });
  }

  return { placed, unplaced };
}

function latestFreeSlot(busy: Interval[], deadline: number, minutes: number): Interval | null {
  const sorted = busy.filter((b) => b.start < deadline).sort((a, b) => b.end - a.end || b.start - a.start);
  let end = deadline;
  for (const b of sorted) {
    if (b.end <= end - minutes) break; // the gap between b and `end` fits
    end = Math.min(end, b.start);
  }
  const start = end - minutes;
  return start >= 0 ? { start, end } : null;
}

// The tending/passive station running at time t: prefer the line the prep is for,
// then the most recently started.
function hostAt(timed: Map<string, Timed>, t: number, componentId: string): string | null {
  const running = [...timed.values()]
    .filter((x) => x.station.attention !== "active" && x.start <= t && t < x.end)
    .sort(
      (a, b) =>
        Number(b.componentId === componentId) - Number(a.componentId === componentId) || b.start - a.start,
    );
  return running[0]?.station.id ?? null;
}
