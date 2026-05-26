"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";
import { SiteRequestStatus, type Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Server actions for the SiteRequest admin detail page.
//
// Every mutation writes a SiteRequestEvent row alongside the change so the
// detail-page timeline has a complete audit trail. All actions revalidate
// the queue + detail routes so the UI reflects the new state immediately.
// ---------------------------------------------------------------------------

const VALID_STATUSES = new Set(Object.values(SiteRequestStatus));

export async function transitionStatus(
  id: string,
  toStatus: SiteRequestStatus,
  message?: string,
) {
  const scope = await requireAgency();
  if (!VALID_STATUSES.has(toStatus)) {
    throw new Error(`Invalid status: ${toStatus}`);
  }

  const current = await prisma.siteRequest.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!current) throw new Error("SiteRequest not found");
  if (current.status === toStatus) return { ok: true };

  const data: Prisma.SiteRequestUpdateInput = {
    status: toStatus,
    lastActivityAt: new Date(),
    events: {
      create: {
        kind: "status_change",
        fromStatus: current.status,
        toStatus,
        message: message ?? null,
        actorUserId: scope.userId,
        visibleToClient: true,
      },
    },
  };
  // Stamp lifecycle timestamps on the milestone transitions so the
  // queue can render time-to-X analytics later.
  if (toStatus === "DEPLOYED") data.deployedAt = new Date();
  if (toStatus === "APPROVED") data.approvedAt = new Date();
  if (toStatus === "PREVIEW_READY") data.previewSentAt = new Date();
  if (toStatus === "DISQUALIFIED") {
    data.disqualifiedAt = new Date();
    if (message) data.disqualifiedReason = message;
  }

  await prisma.siteRequest.update({ where: { id }, data });

  revalidatePath("/admin/site-engine");
  revalidatePath(`/admin/site-engine/${id}`);
  return { ok: true };
}

export async function updateInternalNotes(id: string, notes: string) {
  await requireAgency();
  await prisma.siteRequest.update({
    where: { id },
    data: { internalNotes: notes || null, lastActivityAt: new Date() },
  });
  revalidatePath(`/admin/site-engine/${id}`);
  return { ok: true };
}

export async function updateBuildArtifacts(
  id: string,
  args: {
    githubRepoUrl?: string;
    vercelProjectId?: string;
    vercelPreviewUrl?: string;
    productionUrl?: string;
  },
) {
  const scope = await requireAgency();
  const data: Prisma.SiteRequestUpdateInput = {
    githubRepoUrl: args.githubRepoUrl || null,
    vercelProjectId: args.vercelProjectId || null,
    vercelPreviewUrl: args.vercelPreviewUrl || null,
    productionUrl: args.productionUrl || null,
    lastActivityAt: new Date(),
    events: {
      create: {
        kind: "note",
        message: "Build artifacts updated",
        actorUserId: scope.userId,
      },
    },
  };
  await prisma.siteRequest.update({ where: { id }, data });
  revalidatePath(`/admin/site-engine/${id}`);
  return { ok: true };
}

export async function logPacketDownload(id: string) {
  const scope = await requireAgency();
  await prisma.siteRequestEvent.create({
    data: {
      siteRequestId: id,
      kind: "packet_downloaded",
      message: "Build packet downloaded",
      actorUserId: scope.userId,
    },
  });
  await prisma.siteRequest.update({
    where: { id },
    data: { lastActivityAt: new Date() },
  });
  revalidatePath(`/admin/site-engine/${id}`);
  return { ok: true };
}
