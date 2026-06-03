"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";
import {
  collectBriefData,
  generateBriefToken,
} from "@/lib/brief/collect";

// ---------------------------------------------------------------------------
// Server actions for the brief generator admin UI.
//
// `createBrief` runs the full data-collection synchronously inside the
// action — the AEO scan + DataForSEO + Firecrawl combo takes ~60-120s on
// average. That's longer than a typical SSR boundary but Vercel
// `serverActions.maxDuration: 300` (set in next.config.mjs) gives us
// headroom. We could fire-and-forget into Inngest later; for v1 the
// sync path is fine and the operator gets a single tab open with the
// final URL when it lands.
//
// The action writes a QUEUED row first, then flips status as it runs —
// the admin list page can refresh and see the lifecycle even from
// another tab.
// ---------------------------------------------------------------------------

export type CreateBriefArgs = {
  domain: string;
  brand?: string;
  vertical?: string;
  fullAddress?: string;
  compSet?: string[];
};

export type CreateBriefResult = {
  ok: true;
  token: string;
  briefId: string;
};

export async function createBrief(
  args: CreateBriefArgs,
): Promise<CreateBriefResult> {
  const scope = await requireAgency();

  const domain = args.domain.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!domain || !domain.includes(".")) {
    throw new Error("Enter a valid domain (e.g. 255-cal.com).");
  }

  // Derive a sensible brand fallback when the operator didn't provide one.
  const brand =
    args.brand?.trim() ||
    domain
      .split(".")
      .slice(0, -1)
      .join(" ")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const token = generateBriefToken();

  // Insert a QUEUED row up front so the admin list shows it immediately
  // — operator can navigate away and come back. Status flips to RUNNING
  // when collection starts and READY/FAILED when it lands.
  const created = await prisma.prospectBrief.create({
    data: {
      token,
      domain,
      brand,
      vertical: args.vertical?.trim() || null,
      status: "QUEUED",
      createdById: scope.userId,
    },
    select: { id: true, token: true },
  });

  // Flip to RUNNING + start the collection. We await this in-action so
  // the redirect at the end lands on the finished brief. For long-
  // running prospects (>2 min) we could move this to Inngest; v1 keeps
  // it simple.
  try {
    await prisma.prospectBrief.update({
      where: { id: created.id },
      data: { status: "RUNNING" },
    });
    const data = await collectBriefData({
      domain,
      brand,
      vertical: args.vertical,
      fullAddress: args.fullAddress,
      compSet: args.compSet,
    });
    await prisma.prospectBrief.update({
      where: { id: created.id },
      data: {
        status: "READY",
        data: JSON.parse(JSON.stringify(data)),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.prospectBrief.update({
      where: { id: created.id },
      data: { status: "FAILED", errorMessage: message.slice(0, 1000) },
    });
    throw new Error(`Brief generation failed: ${message}`);
  }

  revalidatePath("/admin/briefs");
  revalidatePath(`/brief/${encodeURIComponent(token)}`);
  return { ok: true, briefId: created.id, token: created.token };
}

/** Retry a failed brief — picks up the same row, flips to RUNNING,
 *  re-runs the collector with the originally-stored inputs. */
export async function retryBrief(briefId: string): Promise<{ ok: true }> {
  await requireAgency();
  const row = await prisma.prospectBrief.findUnique({
    where: { id: briefId },
    select: { id: true, domain: true, brand: true, vertical: true },
  });
  if (!row) throw new Error("Brief not found");
  await prisma.prospectBrief.update({
    where: { id: briefId },
    data: { status: "RUNNING", errorMessage: null },
  });
  try {
    const data = await collectBriefData({
      domain: row.domain,
      brand: row.brand,
      vertical: row.vertical ?? undefined,
    });
    await prisma.prospectBrief.update({
      where: { id: briefId },
      data: {
        status: "READY",
        data: JSON.parse(JSON.stringify(data)),
      },
    });
  } catch (err) {
    await prisma.prospectBrief.update({
      where: { id: briefId },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
  revalidatePath("/admin/briefs");
  return { ok: true };
}

/** Form-action entrypoint — extracts FormData and redirects to the
 *  finished brief share URL when collection lands. */
export async function createBriefFromForm(formData: FormData): Promise<void> {
  const domain = String(formData.get("domain") ?? "");
  const brand = String(formData.get("brand") ?? "").trim() || undefined;
  const vertical = String(formData.get("vertical") ?? "").trim() || undefined;
  const fullAddress =
    String(formData.get("fullAddress") ?? "").trim() || undefined;
  const compSetRaw = String(formData.get("compSet") ?? "").trim();
  const compSet = compSetRaw
    ? compSetRaw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;
  const result = await createBrief({
    domain,
    brand,
    vertical,
    fullAddress,
    compSet,
  });
  // Open the operator straight into the finished brief; they can copy
  // the URL from there and paste into the prospect email.
  redirect(`/brief/${encodeURIComponent(result.token)}`);
}
