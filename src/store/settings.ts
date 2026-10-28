import { read, remove, write } from "./storage";

// Per-device settings in localStorage (SPEC §2). The key leaves the device only
// in requests to openrouter.ai, or encrypted in a share link (SPEC §3).
const KEY = "cookline.openrouterKey";
const MODEL = "cookline.model";

// Recommended (and preselected): cheap, reads photos, honors JSON schemas. The
// eval in milestone 6 revisits this.
export const RECOMMENDED_MODEL = "anthropic/claude-haiku-5.5";

export const getApiKey = () => read(KEY)?.trim() || "";
export const setApiKey = (key: string) => write(KEY, key.trim());
export const clearApiKey = () => remove(KEY);
export const getModel = () => read(MODEL) || RECOMMENDED_MODEL;
export const setModel = (model: string) => write(MODEL, model);
