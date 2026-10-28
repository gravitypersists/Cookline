import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtures } from "../../fixtures";
import { toWire } from "../model/schema";
import { ExtractionError, extractRecipe } from "./extract";

const reply = (content: string, cost = 0.001) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { cost } }), { status: 200 });

function mockFetch(...responses: Response[]) {
  const fn = vi.fn(async () => responses.shift()!);
  vi.stubGlobal("fetch", fn);
  return fn;
}

const bodyOf = (fn: ReturnType<typeof mockFetch>, call: number) => JSON.parse((fn.mock.calls[call] as any)[1].body);
const good = () => JSON.stringify(toWire(fixtures.curry!));
const opts = { apiKey: "sk-test", model: "anthropic/claude-haiku-5.5" };

afterEach(() => vi.unstubAllGlobals());

describe("extractRecipe", () => {
  it("sends a strict JSON-schema request and returns the graph", async () => {
    const fetch = mockFetch(reply(good()));
    const result = await extractRecipe({ ...opts, input: { kind: "text", text: "Curry…" } });

    expect(result.graph.title).toBe("Eggplant & chickpea curry");
    expect(result.repaired).toBe(false);
    expect(result.cost).toBe(0.001);

    const [url, init] = fetch.mock.calls[0] as any;
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-test");
    const body = bodyOf(fetch, 0);
    expect(body.model).toBe(opts.model);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.provider).toEqual({ require_parameters: true });
    // system + two worked examples + the recipe
    expect(body.messages.map((m: any) => m.role)).toEqual(["system", "user", "assistant", "user", "assistant", "user"]);
    expect(body.messages.at(-1).content).toBe("Curry…");
  });

  it("sends photos as image parts", async () => {
    const fetch = mockFetch(reply(good()));
    await extractRecipe({ ...opts, input: { kind: "images", images: ["data:image/jpeg;base64,AAA", "data:image/jpeg;base64,BBB"] } });
    const content = bodyOf(fetch, 0).messages.at(-1).content;
    expect(content[0]).toEqual({ type: "text", text: "Here are 2 photos of the recipe, in order." });
    expect(content.slice(1).map((p: any) => p.image_url.url)).toEqual(["data:image/jpeg;base64,AAA", "data:image/jpeg;base64,BBB"]);
  });

  it("repairs once when validation fails, and adds up the cost", async () => {
    const broken = toWire(fixtures.curry!);
    broken.components[2]!.stations.at(-2)!.adds = ["lime"]; // drop cilantro
    const fetch = mockFetch(reply(JSON.stringify(broken)), reply(good(), 0.002));
    const stages: string[] = [];
    const result = await extractRecipe({ ...opts, input: { kind: "text", text: "x" }, onStage: (s) => stages.push(s) });

    expect(result.repaired).toBe(true);
    expect(result.cost).toBeCloseTo(0.003);
    expect(stages).toEqual(["reading", "repairing"]);
    const repair = bodyOf(fetch, 1).messages;
    expect(repair.at(-2)).toEqual({ role: "assistant", content: JSON.stringify(broken) });
    expect(repair.at(-1).content).toMatch(/Ingredient "cilantro" is not added at any station/);
  });

  it("gives up after one repair, keeping what parsed", async () => {
    const broken = toWire(fixtures.curry!);
    broken.trunk = "gravy";
    mockFetch(reply(JSON.stringify(broken)), reply("not json"));
    const err = await extractRecipe({ ...opts, input: { kind: "text", text: "x" } }).catch((e) => e);
    expect(err).toBeInstanceOf(ExtractionError);
    expect(err.errors).toEqual(["The output was not valid JSON."]);
    expect(err.graph.title).toBe("Eggplant & chickpea curry");
  });

  it("accepts JSON wrapped in a code fence", async () => {
    mockFetch(reply("```json\n" + good() + "\n```"));
    const result = await extractRecipe({ ...opts, input: { kind: "text", text: "x" } });
    expect(result.graph.components).toHaveLength(3);
  });

  it("explains a rejected key", async () => {
    mockFetch(new Response(JSON.stringify({ error: { message: "No auth credentials found" } }), { status: 401 }));
    await expect(extractRecipe({ ...opts, input: { kind: "text", text: "x" } })).rejects.toThrow(
      "OpenRouter rejected the API key. No auth credentials found",
    );
  });
});
