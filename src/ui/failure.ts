import { ExtractionError } from "../extract/extract";

export interface Failure {
  message: string;
  errors?: string[];
  raw?: string;
}

// User-facing description of a failed extraction.
export function describeFailure(e: unknown): Failure {
  if (e instanceof ExtractionError) return { message: e.message, errors: e.errors, raw: e.raw };
  // fetch rejects with a TypeError when the network is down or blocked.
  if (e instanceof TypeError) return { message: "Couldn't reach OpenRouter. Check your connection and try again." };
  return { message: (e as Error)?.message || "Something went wrong." };
}
