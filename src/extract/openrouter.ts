// Direct browser calls to OpenRouter with the user's own key (SPEC §2). No
// backend: the key never leaves this device except to openrouter.ai.

const API = "https://openrouter.ai/api/v1";

export type Content =
  | string
  | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];

export interface Message {
  role: "system" | "user" | "assistant";
  content: Content;
}

export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

function headers(apiKey?: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    // Optional attribution OpenRouter shows in its dashboards.
    ...(typeof location !== "undefined" ? { "HTTP-Referer": location.origin } : {}),
    "X-Title": "Cookline",
  };
}

async function failure(res: Response): Promise<OpenRouterError> {
  let detail = "";
  try {
    const body = await res.json();
    detail = body?.error?.message ?? "";
  } catch {
    // not JSON
  }
  const reason =
    res.status === 401
      ? "OpenRouter rejected the API key."
      : res.status === 402
        ? "The OpenRouter key is out of credits."
        : res.status === 429
          ? "OpenRouter is rate limiting this key; try again shortly."
          : `OpenRouter request failed (${res.status}).`;
  return new OpenRouterError(detail ? `${reason} ${detail}` : reason, res.status);
}

export interface Completion {
  content: string;
  cost?: number; // USD, when OpenRouter reports it
}

export async function complete(opts: {
  apiKey: string;
  model: string;
  messages: Message[];
  schema: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<Completion> {
  const res = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: headers(opts.apiKey),
    signal: opts.signal,
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      response_format: {
        type: "json_schema",
        json_schema: { name: "recipe", strict: true, schema: opts.schema },
      },
      // Only route to providers that honor structured outputs.
      provider: { require_parameters: true },
      usage: { include: true },
    }),
  });
  if (!res.ok) throw await failure(res);
  const body = await res.json();
  if (body?.error) throw new OpenRouterError(body.error.message ?? "OpenRouter returned an error.");
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new OpenRouterError("The model returned an empty response.");
  }
  return { content, cost: typeof body.usage?.cost === "number" ? body.usage.cost : undefined };
}

export interface KeyInfo {
  label?: string;
  limitRemaining?: number | null; // USD; null = no limit set
  usage?: number;
}

// Free call: checks the key without spending credits.
export async function checkKey(apiKey: string, signal?: AbortSignal): Promise<KeyInfo> {
  const res = await fetch(`${API}/key`, { headers: headers(apiKey), signal });
  if (!res.ok) throw await failure(res);
  const { data } = await res.json();
  return { label: data?.label, limitRemaining: data?.limit_remaining ?? null, usage: data?.usage };
}

export interface ModelInfo {
  id: string;
  name: string;
  promptPerM: number; // USD per million input tokens
  completionPerM: number;
}

// Models that can read photos and honor a JSON schema. Batch-only and router
// pseudo-models are left out: extraction is interactive.
export async function listModels(signal?: AbortSignal): Promise<ModelInfo[]> {
  const res = await fetch(`${API}/models`, { signal });
  if (!res.ok) throw await failure(res);
  const { data } = await res.json();
  return (data as any[])
    .filter(
      (m) =>
        m.architecture?.input_modalities?.includes("image") &&
        m.supported_parameters?.includes("structured_outputs") &&
        !m.id.endsWith(":batch") &&
        !m.id.startsWith("openrouter/") &&
        Number(m.pricing?.prompt) >= 0,
    )
    .map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      promptPerM: Number(m.pricing.prompt) * 1e6,
      completionPerM: Number(m.pricing.completion) * 1e6,
    }))
    .sort((a, b) => a.promptPerM + a.completionPerM - (b.promptPerM + b.completionPerM));
}
