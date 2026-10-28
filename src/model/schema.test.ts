import { describe, expect, it } from "vitest";
import { fixtures } from "../../fixtures";
import { WireRecipe, fromWire, recipeJsonSchema, toWire } from "./schema";

describe("wire schema", () => {
  it.each(Object.entries(fixtures))("round-trips %s", (_, g) => {
    const wire = WireRecipe.parse(JSON.parse(JSON.stringify(toWire(g))));
    expect(fromWire(wire)).toEqual(JSON.parse(JSON.stringify(g)));
  });

  it("is strict-mode compatible: every object lists all its properties as required", () => {
    const walk = (node: any): void => {
      if (!node || typeof node !== "object") return;
      if (node.type === "object") {
        expect(node.additionalProperties).toBe(false);
        expect([...node.required].sort()).toEqual(Object.keys(node.properties).sort());
      }
      Object.values(node).forEach(walk);
    };
    const schema = recipeJsonSchema();
    expect(schema.$schema).toBeUndefined();
    walk(schema);
  });
});
