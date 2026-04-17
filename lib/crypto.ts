import "server-only";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Symmetric encryption for per-tenant secrets (AppFolio API keys, OAuth
// tokens, ad platform refresh tokens). AES-256-GCM; key hex-encoded in
// ENCRYPTION_KEY env var (32 bytes / 64 hex chars).
//
// Generate a key:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// Payload layout (base64): [iv:12][tag:16][ciphertext:*]
//
// DECISION: throw at decrypt-time rather than startup-time so tenants with no
// encrypted secrets yet don't block the app boot.
// ---------------------------------------------------------------------------

const ALG = "aes-256-gcm";

function readKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || !/^[0-9a-f]{64}$/i.test(raw)) {
    throw new Error(
      "ENCRYPTION_KEY is missing or not a 32-byte hex string. Generate with `openssl rand -hex 32` and set in .env."
    );
  }
  return Buffer.from(raw, "hex");
}

export function encrypt(plaintext: string): string {
  const key = readKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decrypt(payload: string): string {
  const key = readKey();
  const buf = Buffer.from(payload, "base64");
  if (buf.length < 28) {
    throw new Error("Encrypted payload is too short to be valid");
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function maybeEncrypt(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === "") return null;
  return encrypt(plaintext);
}

export function maybeDecrypt(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    return decrypt(payload);
  } catch {
    return null;
  }
}
