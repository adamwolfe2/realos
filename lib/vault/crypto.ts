import "server-only";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Credentials vault — envelope encryption
//
// Two-tier key model (NIST SP 800-57 envelope):
//
//   master KEK   (env: VAULT_MASTER_KEK_B64, 32 bytes base64)
//        ↓ wraps
//   org DEK      (stored encrypted on Organization.vaultDekWrapped + nonce)
//        ↓ encrypts
//   credential   (CredentialEntry.secretCiphertext + iv + authTag)
//
// Properties:
//   - DB dump alone yields nothing — attacker needs env KEK
//   - Env KEK leak alone yields nothing — attacker also needs DB
//   - Per-org DEK isolation — a compromised org DEK cannot decrypt
//     other orgs' credentials
//   - Master-KEK rotation only re-wraps each org's DEK (cheap)
//   - Org-DEK rotation requires re-encrypting that org's credentials
//     (medium effort, scoped, scriptable)
//
// All primitives come from Node's built-in `crypto`. No third-party
// crypto library — that's a deliberate choice; the security boundary
// is small and Node's openssl bindings are FIPS-grade.
//
// See docs/PRD-CREDENTIALS-VAULT.md for the full design.
// ---------------------------------------------------------------------------

const KEK_ENV = "VAULT_MASTER_KEK_B64";
const DEK_LEN = 32; // bytes — AES-256
const GCM_NONCE_LEN = 12;
const GCM_TAG_LEN = 16;

class VaultCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultCryptoError";
  }
}

/** Resolve the master KEK from env. Throws if missing or malformed. */
function getMasterKek(): Buffer {
  const raw = process.env[KEK_ENV];
  if (!raw) {
    throw new VaultCryptoError(
      `${KEK_ENV} env var is not set. Generate one with \`openssl rand -base64 32\` and set in Vercel + .env.local.`,
    );
  }
  const buf = Buffer.from(raw.trim(), "base64");
  if (buf.length !== DEK_LEN) {
    throw new VaultCryptoError(
      `${KEK_ENV} must decode to exactly ${DEK_LEN} bytes (got ${buf.length}). Generate with \`openssl rand -base64 32\`.`,
    );
  }
  return buf;
}

/** AES-256-GCM encrypt. Returns ciphertext, 12-byte iv, 16-byte tag. */
function encryptGcm(
  plaintext: Buffer,
  key: Buffer,
): { ciphertext: Buffer; iv: Buffer; tag: Buffer } {
  const iv = randomBytes(GCM_NONCE_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  if (tag.length !== GCM_TAG_LEN) {
    throw new VaultCryptoError(`GCM tag length unexpected: ${tag.length}`);
  }
  return { ciphertext, iv, tag };
}

/** AES-256-GCM decrypt. Throws on auth-tag mismatch (tampering / wrong key). */
function decryptGcm(
  ciphertext: Buffer,
  key: Buffer,
  iv: Buffer,
  tag: Buffer,
): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    // Don't leak the underlying openssl error to callers — that can
    // reveal whether the ciphertext was the right shape vs the wrong
    // key (oracle attack). Log server-side for ops debugging; return
    // a generic public message. Pre-fix the err.message was concat'd
    // into the thrown error and surfaced all the way to the reveal
    // modal, which is exactly the leak the comment claimed to avoid.
    if (err instanceof Error) {
      console.warn("[vault] decryptGcm failed:", err.message);
    }
    throw new VaultCryptoError("Vault decrypt failed");
  }
}

/**
 * Lazy-provision the per-org DEK. Called from every encrypt/decrypt
 * path; idempotent and concurrency-safe.
 *
 * Concurrency-safety (the real story): two parallel "first credential
 * created" actions could both observe `vaultDekWrapped: null` and
 * each generate a fresh DEK. Without the conditional-update guard
 * below, the second writer would clobber the first writer's DEK —
 * meaning the credential the first writer ALREADY encrypted with its
 * (now-discarded) DEK is permanently unreadable.
 *
 * Fix: `updateMany` with `where: { id, vaultDekWrapped: null }` is
 * atomic at the SQL level — only ONE writer can win (Postgres row
 * lock). The loser sees `count === 0`, knows its DEK was discarded,
 * and re-reads + decrypts the winner's DEK so subsequent encrypts in
 * this request use the persisted key.
 *
 * Open caveat (Phase 2): if the encrypt+credential-create flow spans
 * two server actions (rare today; the create action does both inline),
 * a loser could still write a credential against a discarded DEK
 * BETWEEN its DEK-mint failure and the next call. The encryptForOrg
 * helper now re-reads the persisted DEK after `updateMany` returns
 * count=0, which closes the window for the inline create path.
 */
async function getOrgDek(orgId: string): Promise<Buffer> {
  const kek = getMasterKek();
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      vaultDekWrapped: true,
      vaultDekNonce: true,
    },
  });
  if (!org) {
    throw new VaultCryptoError(`Organization ${orgId} not found`);
  }

  if (org.vaultDekWrapped && org.vaultDekNonce) {
    return unwrapDek(Buffer.from(org.vaultDekWrapped), Buffer.from(org.vaultDekNonce), kek);
  }

  // Mint a candidate DEK and try to win the race via conditional UPDATE.
  const candidateDek = randomBytes(DEK_LEN);
  const { ciphertext, iv, tag } = encryptGcm(candidateDek, kek);
  const wrapped = Buffer.concat([ciphertext, tag]);
  const wrappedAb = new Uint8Array(new ArrayBuffer(wrapped.length));
  wrappedAb.set(wrapped);
  const ivAb = new Uint8Array(new ArrayBuffer(iv.length));
  ivAb.set(iv);

  // updateMany on (id, vaultDekWrapped: null) is atomic — Postgres
  // row-locks the Organization row, so only ONE concurrent writer
  // gets count === 1. The losers get count === 0 and fall through
  // to the re-read below.
  const winResult = await prisma.organization.updateMany({
    where: { id: orgId, vaultDekWrapped: null },
    data: {
      vaultDekWrapped: wrappedAb,
      vaultDekNonce: ivAb,
      vaultEnabledAt: new Date(),
    },
  });

  if (winResult.count === 1) {
    // We won. Return our in-memory DEK; the persisted copy matches.
    return candidateDek;
  }

  // Lost the race. The candidateDek we minted is now garbage — it was
  // never persisted, no credential should ever be encrypted with it.
  // Zero it out aggressively and re-read the winner's DEK.
  candidateDek.fill(0);

  const after = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { vaultDekWrapped: true, vaultDekNonce: true },
  });
  if (!after?.vaultDekWrapped || !after.vaultDekNonce) {
    throw new VaultCryptoError("Org DEK write failed");
  }
  return unwrapDek(Buffer.from(after.vaultDekWrapped), Buffer.from(after.vaultDekNonce), kek);
}

/** Shared helper for unwrapping a stored DEK with the master KEK. */
function unwrapDek(wrapped: Buffer, nonce: Buffer, kek: Buffer): Buffer {
  if (wrapped.length < GCM_TAG_LEN) {
    throw new VaultCryptoError("Wrapped DEK is shorter than the GCM tag");
  }
  if (nonce.length !== GCM_NONCE_LEN) {
    throw new VaultCryptoError(`Wrapped DEK nonce length unexpected: ${nonce.length}`);
  }
  // Layout: ciphertext || tag (last 16 bytes)
  const tag = wrapped.subarray(wrapped.length - GCM_TAG_LEN);
  const ct = wrapped.subarray(0, wrapped.length - GCM_TAG_LEN);
  return decryptGcm(ct, kek, nonce, tag);
}

export type EncryptedSecret = {
  secretCiphertext: string; // base64
  secretIv: string;         // base64
  secretAuthTag: string;    // base64
};

/** Encrypt a plaintext secret for the given org. */
export async function encryptForOrg(
  orgId: string,
  plaintext: string,
): Promise<EncryptedSecret> {
  if (!plaintext) {
    throw new VaultCryptoError("Empty plaintext — refuse to encrypt nothing");
  }
  const dek = await getOrgDek(orgId);
  const { ciphertext, iv, tag } = encryptGcm(Buffer.from(plaintext, "utf8"), dek);
  // Zero out the DEK from memory as quickly as we can. Node doesn't
  // give us a "really zero this buffer" primitive — Buffer.fill(0) is
  // the closest we have, and the GC will pick it up shortly after.
  dek.fill(0);
  return {
    secretCiphertext: ciphertext.toString("base64"),
    secretIv: iv.toString("base64"),
    secretAuthTag: tag.toString("base64"),
  };
}

/** Decrypt a stored secret for the given org. */
export async function decryptForOrg(
  orgId: string,
  encrypted: EncryptedSecret,
): Promise<string> {
  const dek = await getOrgDek(orgId);
  const ct = Buffer.from(encrypted.secretCiphertext, "base64");
  const iv = Buffer.from(encrypted.secretIv, "base64");
  const tag = Buffer.from(encrypted.secretAuthTag, "base64");
  const plaintext = decryptGcm(ct, dek, iv, tag);
  dek.fill(0);
  return plaintext.toString("utf8");
}

/**
 * Verify the master KEK is configured + the right shape. Call at boot
 * time from instrumentation.ts so a missing/malformed KEK fails fast
 * instead of at first reveal attempt 3 weeks later.
 */
export function assertVaultKekConfigured(): void {
  // Throws if missing/malformed.
  getMasterKek();
}

/**
 * Generate a cryptographically-strong random password. Used by the
 * "Generate" button in the credential editor. Defaults match
 * 1Password's "strong" preset: 24 chars from alphanumerics + symbols.
 */
export function generateStrongPassword(length = 24): string {
  const ALPHABET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
