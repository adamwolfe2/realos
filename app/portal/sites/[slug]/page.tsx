import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { StatusTimeline, statusCopy } from "@/components/site-engine/status-timeline";

export const metadata: Metadata = { title: "Your website request" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/sites/[slug] — logged-in status page for a SiteRequest. Gated by
// Clerk session + orgId match. Shows the same lifecycle as the public
// status page, plus the assets the user uploaded.
// ---------------------------------------------------------------------------

export default async function PortalSiteStatusPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const scope = await requireScope();
  const { slug } = await params;

  const sr = await prisma.siteRequest.findFirst({
    where: { slug, orgId: scope.orgId },
    include: {
      intake: { select: { brandName: true } },
      assets: { orderBy: { uploadedAt: "asc" } },
      events: {
        where: { visibleToClient: true },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });
  if (!sr) notFound();

  const copy = statusCopy(sr.status);
  const brandName = sr.intake?.brandName ?? sr.submittedByName;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={brandName}
        description={`Site request ${sr.slug} · submitted ${new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(sr.submittedAt)}`}
        breadcrumb={
          <Link href="/portal" className="hover:underline">
            ← Portal
          </Link>
        }
      />

      <SectionCard label="Current status">
        <h3 className="text-xl font-semibold mt-1">{copy.label}</h3>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          {copy.description}
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {sr.vercelPreviewUrl ? (
            <a
              href={sr.vercelPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
            >
              View preview →
            </a>
          ) : null}
          {sr.productionUrl ? (
            <a
              href={sr.productionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium"
            >
              Open live site →
            </a>
          ) : null}
        </div>
      </SectionCard>

      <StatusTimeline currentStatus={sr.status} events={sr.events} />

      {sr.assets.length > 0 ? (
        <SectionCard label="Your uploads">
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {sr.assets.map((a) => (
              <li
                key={a.id}
                className="rounded-md border border-border p-2 bg-background"
              >
                {a.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.blobUrl}
                    alt={a.filename}
                    className="w-full h-24 object-cover rounded"
                  />
                ) : (
                  <div className="w-full h-24 rounded bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                    {a.mimeType.split("/")[1]?.toUpperCase() ?? "FILE"}
                  </div>
                )}
                <div className="mt-2 text-xs">
                  <div className="font-medium truncate" title={a.filename}>
                    {a.filename}
                  </div>
                  <div className="text-muted-foreground">
                    {a.type.replaceAll("_", " ").toLowerCase()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </div>
  );
}
