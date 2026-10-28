import type { Extraction } from "../extract/extract";
import { read, write } from "./storage";

// The most recent extraction, until the recipe library lands (milestone 4).
const KEY = "cookline.lastExtraction";

export function saveLast(e: Extraction) {
  write(KEY, JSON.stringify(e));
}

export function loadLast(): Extraction | null {
  try {
    return JSON.parse(read(KEY) ?? "null");
  } catch {
    return null;
  }
}
