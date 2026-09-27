import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

// Phone numbers are PII (spec §2.2): store a keyed hash for lookup and an AES-256-GCM
// ciphertext for sending. Never the plain number.

function key() {
  const k = process.env.PHONE_ENC_KEY;
  if (!k) throw new Error("PHONE_ENC_KEY is not set");
  return k;
}

/**
 * Normalize to E.164. Group MMS through Twilio is US/Canada only, so only +1 numbers are
 * accepted. Returns null for anything that isn't a 10-digit NANP number.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  let d = digits.startsWith("+") ? digits.slice(1) : digits;
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (!/^\d{10}$/.test(d)) return null;
  // NANP: area code and exchange can't start with 0 or 1.
  if (/^[01]/.test(d) || /^[01]/.test(d.slice(3))) return null;
  return `+1${d}`;
}

export function phoneHash(e164: string) {
  return createHmac("sha256", key()).update(`phone:${e164}`).digest("hex");
}

function aesKey() {
  return createHash("sha256").update(`enc:${key()}`).digest();
}

export function encryptPhone(e164: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", aesKey(), iv);
  const body = Buffer.concat([c.update(e164, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function decryptPhone(enc: string) {
  const [iv, tag, body] = enc.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", aesKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}

/** "•••• 1234", safe to show the owner of the number. */
export function maskPhone(e164: string) {
  return `•••• ${e164.slice(-4)}`;
}
