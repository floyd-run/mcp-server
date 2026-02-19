import { createHmac, timingSafeEqual } from "node:crypto";

export interface SlotPayload {
  v: 1;
  svc: string;
  rsc: string;
  st: string;
  et: string;
  tz: string;
}

const PREFIX = "slot_v1";
const KEY_DERIVATION_LABEL = "floyd-slot-key";

function deriveSecret(apiKey: string): Buffer {
  return createHmac("sha256", KEY_DERIVATION_LABEL).update(apiKey).digest();
}

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromBase64Url(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

export function sign(payload: SlotPayload, apiKey: string): string {
  const secret = deriveSecret(apiKey);
  const payloadB64 = toBase64Url(Buffer.from(JSON.stringify(payload)));
  const sig = createHmac("sha256", secret).update(payloadB64).digest();
  return `${PREFIX}.${payloadB64}.${toBase64Url(sig)}`;
}

export function verify(token: string, apiKey: string): SlotPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;

  // Length already validated above
  const payloadB64 = parts[1]!;
  const sigB64 = parts[2]!;
  const secret = deriveSecret(apiKey);
  const expected = createHmac("sha256", secret).update(payloadB64).digest();
  const actual = fromBase64Url(sigB64);

  if (actual.length !== expected.length) return null;
  if (!timingSafeEqual(actual, expected)) return null;

  try {
    const raw: unknown = JSON.parse(fromBase64Url(payloadB64).toString("utf-8"));
    if (typeof raw !== "object" || raw === null || !("v" in raw) || raw.v !== 1) return null;
    return raw as SlotPayload;
  } catch {
    return null;
  }
}
