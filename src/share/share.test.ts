import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PasteGone } from "./privatebin";
import { createShareLink, encodeToken, parseShareHash, redeemShare } from "./share";

const APP = "https://gravitypersists.github.io/Cookline/";

// An in-memory PrivateBin: stores what it's given, deletes on first read.
let pastes: Map<string, unknown>;
let posted: any[];
beforeEach(() => {
  pastes = new Map();
  posted = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
      if (init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        posted.push(body);
        const id = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
        pastes.set(id, body);
        return json({ status: 0, id });
      }
      const id = new URL(url).searchParams.get("pasteid")!;
      const paste = pastes.get(id);
      pastes.delete(id);
      return paste ? json({ status: 0, ...(paste as object) }) : json({ status: 1, message: "Document does not exist" });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const hashOf = (link: string) => link.slice(link.indexOf("#"));

describe("share links", () => {
  it("are short: the app URL plus #k and 32 characters", async () => {
    const link = await createShareLink("sk-or-v1-abc", APP);
    expect(link).toMatch(/^https:\/\/gravitypersists\.github\.io\/Cookline\/#k[A-Za-z0-9_-]{32}$/);
    expect(link.length).toBe(77);
  });

  it("hand the key over once, then stop working", async () => {
    const link = await createShareLink("sk-or-v1-abc", APP);
    const token = parseShareHash(hashOf(link))!;
    expect(await redeemShare(token)).toBe("sk-or-v1-abc");
    await expect(redeemShare(token)).rejects.toBeInstanceOf(PasteGone);
  });

  it("never send the key or the secret to PrivateBin", async () => {
    const link = await createShareLink("sk-or-v1-abc", APP);
    const sent = JSON.stringify(posted);
    expect(sent).not.toContain("sk-or-v1-abc");
    expect(sent).not.toContain(hashOf(link).slice(2));
    expect(posted[0]).toMatchObject({ v: 2, meta: { expire: "1day" } });
    expect(posted[0].adata.at(-1)).toBe(1); // burn after reading
  });

  it("can't be decrypted with the wrong secret", async () => {
    const link = await createShareLink("sk-or-v1-abc", APP);
    const token = parseShareHash(hashOf(link))!;
    token.secret[0]! ^= 1;
    await expect(redeemShare(token)).rejects.toThrow();
  });

  it("round-trip the token and ignore anything else in the hash", () => {
    const token = { id: "d669ad613432fdaf", secret: crypto.getRandomValues(new Uint8Array(16)) };
    const parsed = parseShareHash(`#k${encodeToken(token)}`)!;
    expect(parsed.id).toBe(token.id);
    expect([...parsed.secret]).toEqual([...token.secret]);
    expect(parseShareHash("#/settings")).toBeNull();
    expect(parseShareHash("#kshort")).toBeNull();
  });
});
