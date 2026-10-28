import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixtures } from "../../fixtures";
import type { Extraction } from "../extract/extract";

// Fresh in-memory IndexedDB and localStorage for each test.
beforeEach(async () => {
  vi.resetModules();
  const { IDBFactory } = await import("fake-indexeddb");
  globalThis.indexedDB = new IDBFactory();
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

const extraction = (id: keyof typeof fixtures, cost = 0.001): Extraction => ({
  graph: fixtures[id]!,
  warnings: [],
  model: "anthropic/claude-haiku-5.5",
  promptVersion: 1,
  cost,
  repaired: false,
});

describe("recipe library", () => {
  it("saves recipes with their source and lists them newest first", async () => {
    const r = await import("./recipes");
    const soup = await r.saveExtraction(extraction("tomato-soup"), { kind: "text", text: "Soup…" });
    await new Promise((ok) => setTimeout(ok, 2));
    const curry = await r.saveExtraction(extraction("curry"), { kind: "images", images: ["data:image/jpeg;base64,AAA"] });

    expect((await r.listRecipes()).map((x) => x.graph.title)).toEqual([curry.graph.title, soup.graph.title]);
    expect(await r.getSource(curry.id)).toEqual({ kind: "images", images: ["data:image/jpeg;base64,AAA"] });
    expect((await r.getRecipe(soup.id))?.sourceKind).toBe("text");
  });

  it("replaces a recipe's graph when it's read again, keeping its id and date", async () => {
    const r = await import("./recipes");
    const saved = await r.saveExtraction(extraction("tomato-soup"), { kind: "text", text: "Soup…" });
    const again = await r.replaceExtraction(saved.id, { ...extraction("curry", 0.002), repaired: true });
    expect(again).toMatchObject({ id: saved.id, createdAt: saved.createdAt, cost: 0.002, repaired: true });
    expect((await r.getRecipe(saved.id))?.graph.title).toBe(fixtures.curry!.title);
  });

  it("deletes a recipe and its source", async () => {
    const r = await import("./recipes");
    const saved = await r.saveExtraction(extraction("curry"), { kind: "text", text: "x" });
    await r.deleteRecipe(saved.id);
    expect(await r.getRecipe(saved.id)).toBeUndefined();
    expect(await r.getSource(saved.id)).toBeUndefined();
    expect(await r.listRecipes()).toEqual([]);
  });

  it("moves the milestone 3 'last extraction' into the library once", async () => {
    localStorage.setItem("cookline.lastExtraction", JSON.stringify(extraction("curry")));
    const r = await import("./recipes");
    const first = await r.listRecipes();
    expect(first.map((x) => x.graph.title)).toEqual([fixtures.curry!.title]);
    expect(first[0]!.id).toMatch(/^[0-9a-f]{8}$/);
    expect(localStorage.getItem("cookline.lastExtraction")).toBeNull();
    expect(await r.listRecipes()).toHaveLength(1);
  });
});
