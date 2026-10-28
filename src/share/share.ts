import { createPaste, takePaste } from "./privatebin";

// Share links (SPEC §3): `<app>#k<token>`, where the 32-character base64url
// token packs the 8-byte paste id and a 16-byte random secret. Fragments never
// reach a server, so only the recipient's browser sees the secret.

const ID_BYTES = 8;
const SECRET_BYTES = 16;
export const SHARE_PREFIX = "#k";
const TOKEN = /^#k([A-Za-z0-9_-]{32})$/;

const toB64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) => Uint8Array.from(s.match(/../g)!, (h) => parseInt(h, 16));

export interface ShareToken {
  id: string;
  secret: Uint8Array<ArrayBuffer>;
}

export function encodeToken({ id, secret }: ShareToken): string {
  return toB64url(new Uint8Array([...unhex(id), ...secret]));
}

export function parseShareHash(hash: string): ShareToken | null {
  const m = hash.match(TOKEN);
  if (!m) return null;
  const bytes = fromB64url(m[1]!);
  if (bytes.length !== ID_BYTES + SECRET_BYTES) return null;
  return { id: hex(bytes.slice(0, ID_BYTES)), secret: bytes.slice(ID_BYTES) };
}

// Creates a one-time link that hands `apiKey` to whoever opens it first.
export async function createShareLink(apiKey: string, appUrl: string): Promise<string> {
  const secret = crypto.getRandomValues(new Uint8Array(SECRET_BYTES));
  const id = await createPaste(apiKey, secret);
  return `${appUrl}${SHARE_PREFIX}${encodeToken({ id, secret })}`;
}

// Redeems a link's token: fetches (destroying) and decrypts the key.
export function redeemShare(token: ShareToken): Promise<string> {
  return takePaste(token.id, token.secret);
}
