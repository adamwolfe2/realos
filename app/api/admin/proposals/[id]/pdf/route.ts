import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";
import { computeProposalTotalsFromRow } from "@/lib/proposals/totals";
import { renderProposalPdf } from "@/lib/proposals/pdf/render";
import { putPublic } from "@/lib/blob-public";
import type { ProposalWithLines } from "@/lib/proposals/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/admin/proposals/[id]/pdf
//
// Agency-only. Renders (or serves cached) PDF artifact for any proposal in
// the platform. Cached to public Vercel Blob storage so a re-open of the
// proposal in the admin builder doesn't re-render. Cache key is implicit:
// `Proposal.pdfBlobUrl` / `pdfCachedAt`. Cache is invalidated whenever the
// proposal's `updatedAt` advances past `pdfCachedAt`.
//
// Returns the PDF inline so the operator can preview in-browser. The
// `Content-Disposition` filename embeds the human-friendly proposal number
// so downloaded files are self-identifying without renaming.
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  // Auth — throws ForbiddenError on non-agency callers; Next translates
  // to 403 via the global error boundary.
  await requireAgency();

  const { id } = await ctx.params;

  const proposal = (await prisma.proposal.findUnique({
    where: { id },
    include: { lineItems: true },
  })) as ProposalWithLines | null;

  if (!proposal) {
    return new Response("Not found", { status: 404 });
  }

  // Cache check: if a blob URL is persisted AND the proposal hasn't been
  // mutated since the cache stamp, redirect to the blob. The blob URL is
  // public — same caching characteristics as any other public blob in the
  // platform — but only links surfaced from this authenticated route.
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
      `[proposals/pdf] render failed for proposal=${id}:`,
      err instanceof Error ? err.message : err,
    );
    return new Response("Failed to render proposal PDF", { status: 500 });
  }

  // Best-effort cache: failure to upload to blob does NOT block the response.
  // Operator must always get the PDF; cache is a perf optimization.
  try {
    const url = await uploadPdfToBlob(pdf, proposal.id, proposal.number);
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { pdfBlobUrl: url, pdfCachedAt: new Date() },
    });
  } catch (err) {
    console.error(
      `[proposals/pdf] blob cache failed for proposal=${id}:`,
      err instanceof Error ? err.message : err,
    );
  }

  return pdfResponse(pdf, proposal.number);
}

// ---------------------------------------------------------------------------
// Helpers (shared with the public token route via re-export safety: we keep
// these private to avoid coupling; the public route reimplements its own
// cached-serve path with a token-scoped filename).
// ---------------------------------------------------------------------------

function pdfResponse(buffer: Buffer, number: string): Response {
  // The TS lib's Response constructor types `BodyInit` as web types; Node's
  // Buffer extends Uint8Array but the strict type-check rejects the
  // structural mismatch. Copy into a fresh `Uint8Array` over a plain
  // ArrayBuffer to land on the web-compatible side of the type system.
  const ab = new ArrayBuffer(buffer.byteLength);
  const body = new Uint8Array(ab);
  body.set(buffer);
  return new Response(body as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="proposal-${sanitizeFilename(number)}.pdf"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

function redirectToBlob(blobUrl: string, number: string): Response {
  // 302 keeps the canonical admin URL stable for future cache busts (a 301
  // would let the browser pin the blob URL forever, which breaks the
  // invalidation-on-edit contract).
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
  // Path scheme isolates proposals under a single prefix so we can list /
  // bulk-prune them later. Filename includes the proposal id so two
  // proposals with the same human number (across imports) never collide,
  // and `addRandomSuffix` adds a final entropy tail to bust browser caches
  // when a stale URL was ever pinned anywhere.
  const safeNumber = sanitizeFilename(number);
  const path = `proposals/${proposalId}/proposal-${safeNumber}.pdf`;
  const result = await putPublic(path, pdf, {
    contentType: "application/pdf",
    addRandomSuffix: true,
  });
  return result.url;
}

function sanitizeFilename(input: string): string {
  // Filenames flow into Content-Disposition AND into the blob path. Be
  // restrictive: only safe URL/path chars, length-capped to avoid pathological
  // proposal numbers.
  const cleaned = input.replace(/[^A-Za-z0-9_.-]/g, "-").slice(0, 80);
  return cleaned || "proposal";
}
