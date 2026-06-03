import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveLiveShareToken } from "@/lib/proposals/share-token";
import { computeProposalTotalsFromRow } from "@/lib/proposals/totals";
import { renderProposalPdf } from "@/lib/proposals/pdf/render";
import { putPublic } from "@/lib/blob-public";
import {
  checkRateLimit,
  getIp,
  publicApiLimiter,
  WIDGET_FALLBACK,
} from "@/lib/rate-limit";
import type { ProposalWithLines } from "@/lib/proposals/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /proposal/[token]/pdf
//
// Public, token-protected proposal PDF. Anti-enumeration: EVERY failure path
// — bad token, revoked token, expired token, DRAFT-status proposal — returns
// 404 with an identical body so an attacker can't distinguish "token doesn't
// exist" from "token was revoked" or "proposal isn't ready yet".
//
// Rate-limited by IP. Falls back to in-memory limiting if Upstash isn't
// configured so a misconfigured deploy doesn't 100%-block prospect access
// (this is a customer-facing surface; a hard block would silently break
// every share link).
// ---------------------------------------------------------------------------

const NOT_FOUND_BODY = "Not found";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
): Promise<Response> {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(publicApiLimiter, ip, {
    softFallback: WIDGET_FALLBACK.publicApi,
  });
  if (!allowed) {
    return new Response("Rate limit exceeded", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  const { token } = await ctx.params;

  // Every negative branch below returns the same 404. Do NOT add specific
  // error messages — that would create an enumeration oracle on the
  // ProposalShareToken table.
  const resolved = await resolveLiveShareToken(token);
  if (!resolved) {
    return notFound();
  }

  const proposal = (await prisma.proposal.findUnique({
    where: { id: resolved.proposalId },
    include: { lineItems: true },
  })) as ProposalWithLines | null;

  if (!proposal) {
    return notFound();
  }

  // DRAFTs are never shareable. If a token was issued before the proposal
  // moved out of DRAFT (or someone fished a token from logs), treat it as
  // not-found rather than 403 — same anti-enumeration rationale.
  if (proposal.status === "DRAFT") {
    return notFound();
  }

  // Cache: serve the persisted blob when the proposal hasn't been mutated
  // since the cache stamp. Redirect to the blob URL so the prospect's
  // browser gets the asset directly from Vercel's edge.
  if (
    proposal.pdfBlobUrl &&
    proposal.pdfCachedAt &&
    proposal.updatedAt <= proposal.pdfCachedAt
  ) {
    return redirectToBlob(proposal.pdfBlobUrl, proposal.number);
  }

  const totals = computeProposalTotalsFromRow(proposal);

  let pdf: Buffer;
  try {
    pdf = await renderProposalPdf({ proposal, totals });
  } catch (err) {
    console.error(
      `[proposal/pdf public] render failed for proposal=${proposal.id}:`,
      err instanceof Error ? err.message : err,
    );
    // Even on internal render failure we return 404 — prospect-facing
    // surface must not leak internal failure modes. The error is captured
    // server-side; operator can investigate via the admin route.
    return notFound();
  }

  // Best-effort cache. Failure to cache must not block the response.
  try {
    const url = await uploadPdfToBlob(pdf, proposal.id, proposal.number);
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { pdfBlobUrl: url, pdfCachedAt: new Date() },
    });
  } catch (err) {
    console.error(
      `[proposal/pdf public] blob cache failed for proposal=${proposal.id}:`,
      err instanceof Error ? err.message : err,
    );
  }

  return pdfResponse(pdf, proposal.number);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function notFound(): Response {
  return new Response(NOT_FOUND_BODY, {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function pdfResponse(buffer: Buffer, number: string): Response {
  // See admin route for the rationale — strict TS rejects Buffer as
  // BodyInit despite Node's Buffer extending Uint8Array structurally.
  const ab = new ArrayBuffer(buffer.byteLength);
  const body = new Uint8Array(ab);
  body.set(buffer);
  return new Response(body as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="proposal-${sanitizeFilename(number)}.pdf"`,
      // Public-facing: allow short caching at the CDN to absorb refreshes
      // from a prospect clicking around the share page, while still letting
      // the operator invalidate via `pdfCachedAt` reset on edit.
      "Cache-Control": "public, max-age=0, s-maxage=60, must-revalidate",
    },
  });
}

function redirectToBlob(blobUrl: string, number: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: blobUrl,
      "Content-Disposition": `inline; filename="proposal-${sanitizeFilename(number)}.pdf"`,
    },
  });
}

async function uploadPdfToBlob(
  pdf: Buffer,
  proposalId: string,
  number: string,
): Promise<string> {
  const safeNumber = sanitizeFilename(number);
  const path = `proposals/${proposalId}/proposal-${safeNumber}.pdf`;
  const result = await putPublic(path, pdf, {
    contentType: "application/pdf",
    addRandomSuffix: true,
  });
  return result.url;
}

function sanitizeFilename(input: string): string {
  const cleaned = input.replace(/[^A-Za-z0-9_.-]/g, "-").slice(0, 80);
  return cleaned || "proposal";
}
