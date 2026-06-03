import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Public share-token issuance for /proposal/[token].
//
// Entropy: 32 bytes from crypto.randomBytes, encoded base64url. Result is
// ~43 ASCII chars — uniform random across [A-Za-z0-9_-], no padding. At
// 256 bits of entropy the practical collision floor on a single Postgres
// table is far below ever encountering one across the platform lifetime,
// so we treat collisions as a thrown error rather than a normal retry loop.
//
// We DO still wrap creation in a one-shot retry because a unique-index
// race on a busy day is theoretically possible; the retry generates a
// fresh token instead of catching-and-rethrowing the same one.
// ---------------------------------------------------------------------------

const TOKEN_BYTES = 32;

/** Generate one fresh, opaque, URL-safe public token. */
export function generateShareToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Issue a new share token for a proposal. Existing un-revoked tokens are
 *  LEFT IN PLACE — calling code can revoke them via `revokeShareTokens` if
 *  it wants single-token semantics. Most flows just keep cycling tokens.
 *
 *  Accepts an optional Prisma transaction client so the token issuance can
 *  be atomically committed alongside the status flip in `sendProposal`.
 *  Without this hook, the global `prisma` client opens its own transaction
 *  and the two writes can interleave — issue token → caller throws →
 *  token persists pointing at a still-DRAFT proposal. */
type PrismaTxClient = Pick<typeof prisma, "proposalShareToken">;

export async function issueShareToken(
  proposalId: string,
  options: { expiresAt?: Date | null; tx?: PrismaTxClient } = {},
): Promise<string> {
  const client = options.tx ?? prisma;
  // Retry once on the (extraordinarily unlikely) unique-index collision —
  // any further failure is a real DB problem and should surface.
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = generateShareToken();
    try {
      await client.proposalShareToken.create({
        data: {
          proposalId,
          token,
          expiresAt: options.expiresAt ?? null,
        },
      });
      return token;
    } catch (err) {
      // Prisma surfaces unique-violation as P2002. Anything else: rethrow.
      const isUnique =
        err != null &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002";
      if (!isUnique) throw err;
      // continue → next attempt regenerates with fresh randomness
    }
  }
  throw new Error("Failed to issue share token after retry");
}

/** Resolve a token to its (live, un-revoked, unexpired) proposal. Returns
 *  null for every non-success path — caller must NEVER distinguish
 *  not-found / revoked / expired to the client (anti-enumeration oracle). */
export async function resolveLiveShareToken(rawToken: string): Promise<{
  proposalId: string;
} | null> {
  // review-fix: tightened from 16 to 32. Tokens are 43 chars (32 bytes
  // base64url), so a probe sending 16-char input gets a fast no-DB-hit
  // null while a 43-char probe takes the full DB roundtrip — a small
  // but real timing oracle. Setting the floor at 32 (the entropy
  // baseline) collapses the differential: anything shorter than the
  // canonical width is rejected on the same code path.
  if (!rawToken || rawToken.length < 32) return null;
  const now = new Date();
  const row = await prisma.proposalShareToken
    .findUnique({
      where: { token: rawToken },
      select: {
        proposalId: true,
        revokedAt: true,
        expiresAt: true,
      },
    })
    .catch(() => null);
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt <= now) return null;
  return { proposalId: row.proposalId };
}

/** Mark every share token for the proposal as revoked. Used by the "revoke
 *  share link" admin action and automatically when a proposal is voided.
 *
 *  Also invalidates the PDF blob cache. The public PDF route hands out a
 *  Vercel Blob URL that's randomized but immutable — without this
 *  invalidation, a prospect who hit /proposal/[token]/pdf once retains a
 *  permanent download link AFTER the share token is revoked. Best-effort
 *  blob delete (Vercel Blob's `del` is async + failure-tolerant; we
 *  clear the DB pointers regardless so subsequent requests miss the
 *  cache and re-render). */
export async function revokeShareTokens(proposalId: string): Promise<void> {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: { pdfBlobUrl: true },
  });

  await prisma.$transaction([
    prisma.proposalShareToken.updateMany({
      where: { proposalId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.proposal.update({
      where: { id: proposalId },
      data: { pdfBlobUrl: null, pdfCachedAt: null },
    }),
  ]);

  if (proposal?.pdfBlobUrl) {
    try {
      const { del } = await import("@vercel/blob");
      await del(proposal.pdfBlobUrl);
    } catch {
      // Vercel Blob delete is best-effort. The DB pointer is cleared so
      // the URL is unreachable via our routes; the orphaned blob will be
      // cleaned up by retention policy.
    }
  }
}
