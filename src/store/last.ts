import type { Extraction } from "../extract/extract";
import { read, remove } from "./storage";

// Milestone 3 kept the most recent extraction here. Read only to migrate it
// into the library (store/recipes.ts).
const KEY = "cookline.lastExtraction";

export function loadLast(): Extraction | null {
  try {
    return JSON.parse(read(KEY) ?? "null");
  } catch {
    return null;
  }
}

export const clearLast = () => remove(KEY);
