import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import {
  CreativeRequestThread,
  type ThreadRequest,
} from "@/components/creative-request/thread";

export const metadata: Metadata = { title: "Creative request" };
export const dynamic = "force-dynamic";

// DECISION: the admin detail uses the same `CreativeRequestThread` the
// client portal uses. Because agency operators act via impersonation when
// hitting the /api/tenant/creative-requests/* routes, we pre-impersonate
// by embedding the agent UX with `viewer="agency"`. Sprint 04 impersonate
// flow remains the canonical write path for audit integrity; this page is
// the read+write surface that agency operators use day-to-day.
export default async function AdminCreativeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAgency();
  const { id } = await params;

  const request = await prisma.creativeRequest.findUnique({
    where: { id },
    include: {
      org: { select: { id: true, name: true, slug: true } },
      property: { select: { name: true } },
    },
  });
  if (!request) notFound();

  const thread: ThreadRequest = {
    id: request.id,
    title: request.title,
    description: request.description,
    format: request.format,
    targetDate: request.targetDate?.toISOString() ?? null,
    status: request.status,
    copyIdeas: request.copyIdeas,
    targetAudience: request.targetAudience,
    referenceImageUrls: toStringArray(request.referenceImageUrls),
    brandAssetsUrls: toStringArray(request.brandAssetsUrls),
    deliverableUrls: toStringArray(request.deliverableUrls),
    messages: Array.isArray(request.messages)
      ? (request.messages as ThreadRequest["messages"])
      : [],
    revisionCount: request.revisionCount,
  };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/creative-requests"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Creative queue
      </Link>
      <div className="text-xs text-muted-foreground">
        Tenant:{" "}
        <Link href={`/admin/clients/${request.org.id}`} className="underline">
          {request.org.name}
        </Link>
        {request.property ? ` · ${request.property.name}` : ""}
      </div>
      <CreativeRequestThread request={thread} viewer="agency" />
    </div>
  );
}

function toStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}
