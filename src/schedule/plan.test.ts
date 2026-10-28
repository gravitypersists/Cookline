import { describe, expect, it } from "vitest";
import { fixtures } from "../../fixtures";
import type { RecipeGraph } from "../model/types";
import { plannedMinutes } from "../format/time";
import { mergeTargets } from "../layout/lanes";
import { plan } from "./plan";

// Longest dependency chain and total hands-on time: no single cook can beat either.
function lowerBound(graph: RecipeGraph): number {
  const targets = mergeTargets(graph);
  const byId = new Map(graph.components.map((c) => [c.id, c]));
  const finish = new Map<string, number>();
  const finishOf = (id: string): number => {
    if (!finish.has(id)) {
      let t = 0;
      for (const s of byId.get(id)!.stations) {
        t = Math.max(t, ...s.merges.map(finishOf)) + plannedMinutes(s.duration);
      }
      finish.set(id, t);
    }
    return finish.get(id)!;
  };
  const critical = finishOf(graph.trunk);
  const handsOn =
    graph.components.flatMap((c) => c.stations).filter((s) => s.attention === "active")
      .reduce((n, s) => n + plannedMinutes(s.duration), 0) +
    graph.ingredients.reduce((n, i) => n + (i.prep ? plannedMinutes(i.prep.duration) : 0), 0);
  return Math.max(critical, handsOn);
}

describe.each(Object.entries(fixtures))("%s", (_, input) => {
  const { graph, schedule, preps } = plan(input);
  const at = (id: string) => schedule.stations[id]!;
  const stations = graph.components.flatMap((c) => c.stations);

  it("schedules every station once, in row order", () => {
    expect(Object.keys(schedule.stations).sort()).toEqual(stations.map((s) => s.id).sort());
    const orders = Object.values(schedule.stations).map((s) => s.order).sort((a, b) => a - b);
    expect(orders).toEqual(stations.map((_, i) => i));
  });

  it("honors line order and merges", () => {
    const targets = mergeTargets(graph);
    for (const c of graph.components) {
      c.stations.forEach((s, i) => {
        if (i > 0) expect(at(s.id).start).toBeGreaterThanOrEqual(at(c.stations[i - 1]!.id).end);
      });
      const t = targets.get(c.id);
      if (t) expect(at(t.stationId).start).toBeGreaterThanOrEqual(at(c.stations.at(-1)!.id).end);
    }
  });

  it("never asks for two hands-on things at once", () => {
    const busy = [
      ...stations.filter((s) => s.attention === "active").map((s) => at(s.id)),
      ...preps,
    ].filter((b) => b.end > b.start).sort((a, b) => a.start - b.start);
    for (let i = 1; i < busy.length; i++) expect(busy[i]!.start).toBeGreaterThanOrEqual(busy[i - 1]!.end);
  });

  it("does every prep, during downtime or as its own station", () => {
    const viaMeanwhile = Object.values(schedule.meanwhile).flatMap((m) => m.prepIds);
    const viaStation = stations.flatMap((s) => s.prepFor ?? []);
    const expected = graph.ingredients.filter((i) => i.prep).map((i) => i.id);
    expect([...viaMeanwhile, ...viaStation].sort()).toEqual(expected.sort());
    // Meanwhile hosts are never hands-on stations.
    for (const host of Object.keys(schedule.meanwhile)) {
      expect(stations.find((s) => s.id === host)!.attention).not.toBe("active");
    }
  });

  it("finishes within 15% of the best possible time", () => {
    expect(schedule.total).toBeLessThanOrEqual(Math.ceil(lowerBound(graph) * 1.15));
  });
});

describe("scheduling choices", () => {
  const rowsOf = (id: string) => {
    const { graph, schedule } = plan(fixtures[id]!);
    const title = new Map(graph.components.flatMap((c) => c.stations).map((s) => [s.id, s.title]));
    return Object.entries(schedule.stations)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([id, s]) => ({ id, title: title.get(id)!, ...s }));
  };

  it("reproduces the mockup's station order for the curry", () => {
    expect(rowsOf("curry").map((r) => r.id)).toEqual([
      "dice-eggplant", "salt-eggplant", "rinse-rice", "simmer-rice", "dice-onion", "sweat",
      "aromatics", "bloom", "cook-down", "sear-eggplant", "rest-rice", "combine",
      "simmer-sauce", "finish", "serve",
    ]);
  });

  it("gets long walk-away steps going early", () => {
    const rows = rowsOf("curry");
    const start = (id: string) => rows.find((r) => r.id === id)!.start;
    expect(start("rinse-rice")).toBeLessThan(start("dice-onion"));
  });

  it("finishes hold-sensitive food just in time", () => {
    const tacos = rowsOf("chicken-tacos");
    const t = (id: string) => tacos.find((r) => r.id === id)!;
    expect(t("warm").end).toBe(t("assemble").start);

    const eggs = rowsOf("jammy-eggs");
    const e = (id: string) => eggs.find((r) => r.id === id)!;
    expect(e("toast").start).toBeGreaterThanOrEqual(e("boil-eggs").start);
  });

  it("makes a side line that would sit for a long time finish near when it's needed", () => {
    const rows = rowsOf("focaccia");
    const r = (id: string) => rows.find((x) => x.id === id)!;
    expect(r("steep").end).toBe(r("dimple").start);
    expect(r("warm-oil").start).toBeGreaterThan(r("proof").start);
    // Its prep now fits into the second rise instead of needing its own station.
    expect(rows.some((x) => x.title === "Prep")).toBe(false);
  });

  it("marks long hands-free stretches as waits", () => {
    const { schedule } = plan(fixtures.focaccia!);
    expect(schedule.waits).toContainEqual({ after: "rise", start: 5, minutes: 105 });
    expect(plan(fixtures.curry!).schedule.waits).toEqual([]);
  });

  it("turns prep with no downtime before it into the first station", () => {
    const rows = rowsOf("garlic-shrimp");
    expect(rows.slice(0, 3).map((r) => r.title)).toEqual(["Prep", "Sizzle garlic", "Pat dry shrimp"]);
  });

  it("groups several unplaceable preps for one step into a Prep station", () => {
    const { graph } = plan(fixtures["garlic-shrimp"]!);
    const [prep, single] = graph.components.flatMap((c) => c.stations).filter((s) => s.prepFor);
    expect(prep).toMatchObject({ title: "Prep", prepFor: ["garlic", "shallot"] });
    expect(single).toMatchObject({ title: "Pat dry shrimp", prepFor: ["shrimp"] });
  });

  it("keeps meanwhile lists in recipe order and counts free minutes", () => {
    const { schedule } = plan(fixtures.curry!);
    expect(schedule.meanwhile.sweat).toEqual({ prepIds: ["garlic", "ginger"] });
    expect(schedule.meanwhile["simmer-sauce"]).toEqual({ prepIds: ["lime", "cilantro"], freeMinutes: 11 });
  });
});
