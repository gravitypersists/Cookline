import type { RecipeGraph, Station } from "../model/types";
import { plannedMinutes } from "../format/time";
import { mergeTargets } from "../layout/lanes";

export interface Timed {
  station: Station;
  componentId: string;
  start: number;
  end: number;
  dispatch: number; // order the scheduler started it in, for tie-breaking rows
}

// Single-cook list scheduling (SPEC §5.4 steps 1–2). Active stations need the
// cook's hands and never overlap; tending and passive stations start as soon as
// they are ready. Assumes a validated graph.
export function scheduleStations(graph: RecipeGraph): Map<string, Timed> {
  const targets = mergeTargets(graph);
  const comps = graph.components;
  const byId = new Map(comps.map((c) => [c.id, c]));
  const dur = (s: Station) => plannedMinutes(s.duration);

  // Successor of each station: the next one on its line, or for a line's last
  // station, the station that merges the line.
  const next = new Map<string, Station | undefined>();
  for (const c of comps) {
    c.stations.forEach((s, i) => {
      const t = targets.get(c.id);
      const merge = t && byId.get(t.componentId)!.stations.find((m) => m.id === t.stationId);
      next.set(s.id, c.stations[i + 1] ?? merge);
    });
  }

  // Longest remaining path to the end of the terminal station.
  const tail = new Map<string, number>();
  const tailOf = (s: Station): number => {
    let v = tail.get(s.id);
    if (v === undefined) {
      const n = next.get(s.id);
      v = dur(s) + (n ? tailOf(n) : 0);
      tail.set(s.id, v);
    }
    return v;
  };

  // Priority: critical path, plus a bonus for getting walk-away time going early.
  const priority = (c: (typeof comps)[number], i: number) => {
    const s = c.stations[i]!;
    const n = c.stations[i + 1];
    return tailOf(s) + (n?.attention === "passive" ? dur(n) : 0);
  };

  const nextIndex = new Map(comps.map((c) => [c.id, 0]));
  const lineFree = new Map(comps.map((c) => [c.id, 0])); // when the line's previous station ends
  const done = new Map<string, number>(); // component id → end of its last station
  const timed = new Map<string, Timed>();
  const total = comps.reduce((n, c) => n + c.stations.length, 0);
  let cookFree = 0;
  let t = 0;
  let dispatch = 0;

  const ready = (t: number) =>
    comps
      .filter((c) => {
        const i = nextIndex.get(c.id)!;
        const s = c.stations[i];
        return (
          s !== undefined &&
          lineFree.get(c.id)! <= t &&
          s.merges.every((m) => done.has(m) && done.get(m)! <= t)
        );
      })
      .map((c) => ({ c, i: nextIndex.get(c.id)!, p: priority(c, nextIndex.get(c.id)!) }))
      .sort((a, b) => b.p - a.p || comps.indexOf(a.c) - comps.indexOf(b.c));

  const start = (c: (typeof comps)[number], i: number, at: number) => {
    const s = c.stations[i]!;
    const end = at + dur(s);
    timed.set(s.id, { station: s, componentId: c.id, start: at, end, dispatch: dispatch++ });
    nextIndex.set(c.id, i + 1);
    lineFree.set(c.id, end);
    if (i === c.stations.length - 1) done.set(c.id, end);
    if (s.attention === "active") cookFree = end;
  };

  while (timed.size < total) {
    // Start everything that can start now, highest priority first. An active
    // start occupies the cook, which may block lower-priority actives.
    let started = true;
    while (started) {
      started = false;
      for (const { c, i } of ready(t)) {
        const active = c.stations[i]!.attention === "active";
        if (active && cookFree > t) continue;
        start(c, i, t);
        started = true;
        break;
      }
    }
    if (timed.size === total) break;

    // Advance to the next moment something frees up.
    const events = [cookFree, ...lineFree.values()].filter((e) => e > t);
    if (events.length === 0) throw new Error("Schedule is stuck: check merges for cycles");
    t = Math.min(...events);
  }

  finishJustInTime(timed, next);
  return timed;
}

// A side line finishing more than this long before it is needed slides later as
// a whole, walk-away steps included: a short hold is fine, but garlic oil made
// two hours ahead of the focaccia reads as a mistake.
export const LONG_HOLD = 15;

// Food that is done early gets cold or soggy: warmed tortillas, toast, seared
// meat. Push each hands-on or tending station as late as its successor allows
// (without overlapping the cook's other active work). Passive stations stay put,
// since resting, steeping and marinating hold fine, unless their line would
// otherwise sit around for longer than LONG_HOLD. Never extends the total.
function finishJustInTime(timed: Map<string, Timed>, next: Map<string, Station | undefined>) {
  const lastOfLine = new Map<string, Timed>();
  for (const t of timed.values()) {
    const prev = lastOfLine.get(t.componentId);
    if (!prev || t.end > prev.end) lastOfLine.set(t.componentId, t);
  }
  const deferred = new Set(
    [...lastOfLine.values()]
      .filter((last) => {
        const merge = next.get(last.station.id);
        return merge && timed.get(merge.id)!.start - last.end > LONG_HOLD;
      })
      .map((last) => last.componentId),
  );

  const byStartDesc = [...timed.values()].sort((a, b) => b.start - a.start || b.dispatch - a.dispatch);
  for (const t of byStartDesc) {
    const succ = next.get(t.station.id);
    if (!succ) continue;
    if (t.station.attention === "passive" && !deferred.has(t.componentId)) continue;
    let end = timed.get(succ.id)!.start;
    if (t.station.attention === "active") {
      const others = [...timed.values()]
        .filter((o) => o !== t && o.station.attention === "active" && o.end > o.start)
        .sort((a, b) => b.end - a.end);
      for (const o of others) {
        if (o.start >= end || o.end <= end - (t.end - t.start)) continue;
        end = o.start; // overlaps: slide in front of it and keep checking
      }
    }
    const shift = end - t.end;
    if (shift > 0) {
      t.start += shift;
      t.end += shift;
    }
  }
}
