import { createStore, del, entries, get, set } from "idb-keyval";
import type { ExtractInput, Extraction } from "../extract/extract";
import type { RecipeGraph } from "../model/types";
import { loadLast, clearLast } from "./last";

// Saved recipes in IndexedDB (SPEC §2). Source photos live in their own
// database so listing the library never loads them.

export interface RecipeRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  graph: RecipeGraph;
  model: string;
  promptVersion: number;
  cost?: number; // USD for the extraction that produced this graph
  warnings: string[];
  repaired: boolean;
  universalPrompt?: string; // the Settings notes in effect when it was read
  sourceKind: SourceKind;
}

export type SourceKind = "images" | "text"; // what the recipe was read from, for display

const kindOf = (s: ExtractInput): SourceKind => (s.images.length > 0 ? "images" : "text");

// Before photos and text were one input, sources were stored as
// { kind: "text", text } or { kind: "images", images }.
type LegacySource = { kind: "text"; text: string } | { kind: "images"; images: string[] };
function normalizeSource(s: ExtractInput | LegacySource | undefined): ExtractInput | undefined {
  if (!s || !("kind" in s)) return s;
  return s.kind === "text" ? { images: [], text: s.text } : { images: s.images, text: "" };
}

const recipes = createStore("cookline-recipes", "recipes");
const sources = createStore("cookline-sources", "sources");

const newId = () => crypto.randomUUID().slice(0, 8);

function fromExtraction(e: Extraction, sourceKind: SourceKind) {
  return {
    graph: e.graph,
    model: e.model,
    promptVersion: e.promptVersion,
    cost: e.cost,
    warnings: e.warnings,
    repaired: e.repaired,
    universalPrompt: e.universalPrompt,
    sourceKind,
  };
}

// Ask the browser not to evict saved recipes under storage pressure (iOS in
// particular clears site data for sites it thinks are unused).
function persist() {
  navigator.storage?.persist?.().catch(() => {});
}

export async function saveExtraction(e: Extraction, source: ExtractInput): Promise<RecipeRecord> {
  const now = Date.now();
  const record: RecipeRecord = { id: newId(), createdAt: now, updatedAt: now, ...fromExtraction(e, kindOf(source)) };
  await set(record.id, source, sources);
  await set(record.id, record, recipes);
  persist();
  return record;
}

// Replace a recipe's graph with a fresh extraction of the same source.
export async function replaceExtraction(id: string, e: Extraction): Promise<RecipeRecord> {
  const old = await getRecipe(id);
  if (!old) throw new Error("That recipe no longer exists.");
  const record: RecipeRecord = { ...old, ...fromExtraction(e, old.sourceKind), updatedAt: Date.now() };
  await set(id, record, recipes);
  return record;
}

export const getRecipe = (id: string) => get<RecipeRecord>(id, recipes);
export const getSource = async (id: string) => normalizeSource(await get(id, sources));

export async function listRecipes(): Promise<RecipeRecord[]> {
  await migrateLast();
  const all = await entries<string, RecipeRecord>(recipes);
  return all.map(([, r]) => r).sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteRecipe(id: string): Promise<void> {
  await del(id, recipes);
  await del(id, sources);
}

// Milestone 3 kept only the last extraction, in localStorage, without its
// source. Move it into the library once.
async function migrateLast() {
  const last = loadLast();
  if (!last) return;
  const now = Date.now();
  const record: RecipeRecord = { id: newId(), createdAt: now, updatedAt: now, ...fromExtraction(last, "text") };
  await set(record.id, record, recipes);
  clearLast();
}
