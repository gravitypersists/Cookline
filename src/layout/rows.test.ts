import { describe, expect, it } from "vitest";
import { fixtures } from "../../fixtures";
import { plan } from "../schedule/plan";
import { buildMap, type RowModel } from "./rows";

const { graph, schedule } = plan(fixtures.curry!);
const map = buildMap(graph, schedule);
const row = (id: string) => map.rows.find((r) => r.station.id === id)!;
// Style of each lane from this row on (the lower half).
const styles = (r: RowModel) =>
  Object.fromEntries(r.segments.filter((s) => s.to === "bottom").map((s) => [s.lane, s.style]));
// Style of each lane in the run-up to this row (the upper half).
const runUp = (r: RowModel) =>
  Object.fromEntries(r.segments.filter((s) => s.from === "top").map((s) => [s.lane, s.style]));

// Lane indices for the curry: 0 rice, 1 eggplant, 2 sauce.
describe("curry transit map", () => {
  it("puts the trunk rightmost and the earliest merge next to it", () => {
    expect(map.lanes.map((l) => [l.componentId, l.slot])).toEqual([
      ["rice", 3],
      ["eggplant", 2],
      ["sauce", 1],
    ]);
  });

  it("orders rows by the schedule", () => {
    expect(map.rows.map((r) => r.station.id).slice(0, 5)).toEqual([
      "dice-eggplant",
      "salt-eggplant",
      "rinse-rice",
      "simmer-rice",
      "dice-onion",
    ]);
  });

  it("starts a line at its first station's dot", () => {
    expect(row("rinse-rice").segments).toContainEqual({ lane: 0, from: "dot", to: "bottom", style: "solid" });
    // Rice isn't live before its first station.
    expect(new Set(row("salt-eggplant").segments.map((s) => s.lane))).toEqual(new Set([1]));
  });

  it("draws hands-on lines solid and waiting lines dashed", () => {
    expect(styles(row("sear-eggplant"))).toEqual({ 0: "dashed", 1: "solid", 2: "solid" });
    expect(styles(row("simmer-sauce"))).toEqual({ 0: "dashed", 2: "dashed" });
    expect(styles(row("salt-eggplant"))).toEqual({ 1: "dashed" });
  });

  it("draws the run-up to a station in the state before it", () => {
    // Combine is hands-on, but the sauce line leading into Simmer comes from it.
    expect(runUp(row("simmer-sauce"))[2]).toBe("solid");
    expect(styles(row("simmer-sauce"))[2]).toBe("dashed");
  });

  it("ends merged lines at the dot with a bar into the target lane", () => {
    const combine = row("combine");
    expect(combine.segments).toContainEqual({ lane: 1, from: "top", to: "dot", style: "solid" });
    expect(combine.mergeBars).toEqual([{ from: 1, to: 2 }]);

    const serve = row("serve");
    expect(serve.terminal).toBe(true);
    expect(serve.segments.every((s) => s.to === "dot")).toBe(true);
    expect(runUp(serve)).toEqual({ 0: "dashed", 2: "solid" });
    expect(serve.mergeBars).toEqual([{ from: 0, to: 2 }]);
  });

  it("labels chips and omits the plus on a line's first station", () => {
    expect(row("dice-eggplant").chips).toEqual([{ label: "eggplant", secondary: "1 large", plus: false }]);
    expect(row("combine").chips.map((c) => [c.label, c.secondary])).toEqual([
      ["seared eggplant", undefined],
      ["chickpeas", "15 oz can, drained"],
      ["coconut milk", "13.5 oz"],
    ]);
    expect(row("serve").chips).toEqual([]);
  });

  it("lists meanwhile prep, with free minutes when there are enough", () => {
    expect(row("sweat").meanwhile).toEqual({ items: ["mince garlic", "grate ginger"], freeMinutes: undefined });
    expect(row("simmer-sauce").meanwhile).toEqual({ items: ["juice lime", "chop cilantro"], freeMinutes: 11 });
  });
});
