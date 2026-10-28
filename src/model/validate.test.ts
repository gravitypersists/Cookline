import { describe, expect, it } from "vitest";
import { fixtures } from "../../fixtures";
import type { RecipeGraph } from "./types";
import { validate } from "./validate";

const clone = (g: RecipeGraph): RecipeGraph => structuredClone(g);
const curry = () => clone(fixtures.curry!);
const station = (g: RecipeGraph, id: string) => g.components.flatMap((c) => c.stations).find((s) => s.id === id)!;

describe("validate", () => {
  it.each(Object.entries(fixtures))("accepts %s", (_, g) => {
    expect(validate(g).errors).toEqual([]);
  });

  it("rejects an ingredient that is never added", () => {
    const g = curry();
    station(g, "finish").adds = ["lime"];
    expect(validate(g).errors).toContain('Ingredient "cilantro" is not added at any station.');
  });

  it("rejects an ingredient added twice", () => {
    const g = curry();
    station(g, "finish").adds.push("onion");
    expect(validate(g).errors.join()).toMatch(/"onion" is added at 2 stations/);
  });

  it("rejects unknown references", () => {
    const g = curry();
    station(g, "combine").merges.push("tofu");
    station(g, "combine").adds.push("paneer");
    g.trunk = "gravy";
    const errors = validate(g).errors.join("\n");
    expect(errors).toMatch(/merges unknown component "tofu"/);
    expect(errors).toMatch(/adds unknown ingredient "paneer"/);
    expect(errors).toMatch(/trunk "gravy" is not a component id/);
  });

  it("requires every side line to merge exactly once, and the trunk never", () => {
    const g = curry();
    station(g, "serve").merges = [];
    expect(validate(g).errors).toContain(
      'Component "rice" is never merged; add it to the "merges" of the station where it is combined.',
    );
    const h = curry();
    station(h, "rest-rice").merges.push("sauce");
    expect(validate(h).errors.join()).toMatch(/trunk "sauce" must not be merged/);
  });

  it("rejects merge loops that never reach the trunk", () => {
    const g = curry();
    station(g, "combine").merges = [];
    station(g, "rest-rice").merges = ["eggplant"];
    station(g, "serve").merges = [];
    station(g, "sear-eggplant").merges = ["rice"];
    expect(validate(g).errors.join()).toMatch(/never reaches the trunk/);
  });

  it("enforces the duration and quote rules", () => {
    const g = curry();
    station(g, "dice-onion").duration = { min: 4, basis: "estimated", quote: "4 minutes" };
    station(g, "sweat").duration = { min: 6, max: 8, basis: "stated" };
    station(g, "simmer-rice").duration = { min: 15, max: 20, basis: "exact", quote: "15 to 20 minutes" };
    station(g, "bloom").duration = { min: 5, max: 2, basis: "estimated" };
    const errors = validate(g).errors.join("\n");
    expect(errors).toMatch(/"dice-onion": an "estimated" duration must not have a quote/);
    expect(errors).toMatch(/"sweat": a "stated" duration needs the recipe's time phrase/);
    expect(errors).toMatch(/"simmer-rice": an "exact" duration can't be a range/);
    expect(errors).toMatch(/"bloom": duration must satisfy/);
  });

  it("warns about likely over-use of exact times", () => {
    const g = curry();
    for (const id of ["sweat", "cook-down", "simmer-sauce"]) {
      station(g, id).duration = { min: 8, basis: "exact", quote: "8 minutes" };
    }
    expect(validate(g).warnings.join()).toMatch(/4 steps are marked exact/);
  });
});
