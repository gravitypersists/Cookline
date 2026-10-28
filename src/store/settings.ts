import { read, write } from "./storage";

// Per-device settings in localStorage (SPEC §2). The key never leaves the
// device except in requests to openrouter.ai.
const KEY = "cookline.openrouterKey";
const MODEL = "cookline.model";

// Cheap, reads photos, honors JSON schemas. The eval in milestone 6 revisits this.
export const DEFAULT_MODEL = "anthropic/claude-haiku-5.5";

export const getApiKey = () => read(KEY)?.trim() || "";
export const setApiKey = (key: string) => write(KEY, key.trim());
export const getModel = () => read(MODEL) || DEFAULT_MODEL;
export const setModel = (model: string) => write(MODEL, model);
