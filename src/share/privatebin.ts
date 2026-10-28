// Burn-after-reading storage on a public PrivateBin instance (privatebin.net):
// free, no account, CORS-enabled, and the server deletes a paste on its first
// read. It only ever receives ciphertext; the key travels in our link's fragment.
//
// Pastes use PrivateBin's v2 format: AES-256-GCM with a PBKDF2-derived key and
// the paste's metadata ("adata") authenticated alongside the ciphertext.

export const PRIVATEBIN = "https://privatebin.net/";

const ITERATIONS = 100_000;
const headers = { "X-Requested-With": "JSONHttpRequest", "Content-Type": "application/json" };

type Spec = [iv: string, salt: string, iterations: number, keySize: 256, tagSize: 128, "aes", "gcm", "none"];
type Adata = [spec: Spec, formatter: "plaintext", openDiscussion: 0, burnAfterReading: 1];

const b64 = (bytes: Uint8Array<ArrayBuffer>) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function deriveKey(secret: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>, usage: KeyUsage) {
  const base = await crypto.subtle.importKey("raw", secret, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

export class PasteGone extends Error {
  constructor() {
    super("This link has already been used or has expired.");
  }
}

// Encrypts `text` with `secret` and stores it for one read, up to a day.
// Returns the paste id (16 hex characters).
export async function createPaste(text: string, secret: Uint8Array<ArrayBuffer>): Promise<string> {
  const iv = random(16);
  const salt = random(8);
  const adata: Adata = [[b64(iv), b64(salt), ITERATIONS, 256, 128, "aes", "gcm", "none"], "plaintext", 0, 1];
  const key = await deriveKey(secret, salt, "encrypt");
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(JSON.stringify(adata)), tagLength: 128 },
    key,
    new TextEncoder().encode(JSON.stringify({ paste: text })),
  );

  const res = await fetch(PRIVATEBIN, {
    method: "POST",
    headers,
    body: JSON.stringify({ v: 2, adata, ct: b64(new Uint8Array(ct)), meta: { expire: "1day" } }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.status !== 0 || !/^[0-9a-f]{16}$/.test(body?.id ?? "")) {
    throw new Error(body?.message ? `PrivateBin: ${body.message}` : `PrivateBin request failed (${res.status}).`);
  }
  return body.id;
}

// Reads (and thereby destroys) a paste, then decrypts it.
export async function takePaste(id: string, secret: Uint8Array<ArrayBuffer>): Promise<string> {
  const res = await fetch(`${PRIVATEBIN}?pasteid=${id}`, { headers });
  const body = await res.json().catch(() => null);
  if (body?.status !== 0 || typeof body?.ct !== "string") throw new PasteGone();

  const adata = body.adata as Adata;
  const [iv, salt] = adata[0];
  const key = await deriveKey(secret, unb64(salt), "decrypt");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(iv), additionalData: new TextEncoder().encode(JSON.stringify(adata)), tagLength: 128 },
    key,
    unb64(body.ct),
  );
  return JSON.parse(new TextDecoder().decode(plain)).paste;
}
