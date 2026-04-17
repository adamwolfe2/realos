import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import {
  CreativeRequestThread,
  type ThreadRequest,
} from "@/components/creative-request/thread";

export const metadata: Metadata = { title: "Creative request" };
export const dynamic = "force-dynamic";

export default async function CreativeRequestDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const scope = await requireScope();
  const { id } = await params;

  const request = await prisma.creativeRequest.findFirst({
    where: { id, ...tenantWhere(scope) },
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
        href="/portal/creative"
        className="text-xs opacity-60 hover:opacity-100"
      >
        ← Creative studio
      </Link>
      <CreativeRequestThread
        request={thread}
        viewer={scope.isImpersonating ? "agency" : "client"}
      />
    </div>
  );
}

function toStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}
