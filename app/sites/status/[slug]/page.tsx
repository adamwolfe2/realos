import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyStatusToken } from "@/lib/site-engine/status-token";
import { BRAND_NAME } from "@/lib/brand";
import { StatusTimeline, statusCopy } from "@/components/site-engine/status-timeline";

export const metadata: Metadata = {
  title: `Site request status | ${BRAND_NAME}`,
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /sites/status/[slug] — public status page for a SiteRequest. Gated by the
// signed token issued to the submitter when the row was created. The page
// shows the lifecycle, what's expected next, and the preview/production
// URLs once they exist. No PII beyond what the submitter already sees.
// ---------------------------------------------------------------------------

export default async function PublicSiteStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug } = await params;
  const { token } = await searchParams;

  if (!verifyStatusToken(slug, token)) {
    // Don't leak existence — return a generic 404.
    notFound();
  }

  const sr = await prisma.siteRequest.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      status: true,
      submittedAt: true,
      lastActivityAt: true,
      vercelPreviewUrl: true,
      productionUrl: true,
      submittedByName: true,
      intake: { select: { brandName: true } },
      events: {
        where: { visibleToClient: true },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          kind: true,
          fromStatus: true,
          toStatus: true,
          message: true,
          createdAt: true,
        },
      },
    },
  });
  if (!sr) notFound();

  const copy = statusCopy(sr.status);
  const brandName = sr.intake?.brandName ?? sr.submittedByName;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 py-12 md:py-16">
        <header className="mb-8 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {BRAND_NAME} · Site Engine
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {brandName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Reference id <code className="text-foreground">{sr.slug}</code> ·
            submitted{" "}
            {new Intl.DateTimeFormat("en-US", {
              dateStyle: "long",
            }).format(sr.submittedAt)}
          </p>
        </header>

        <section className="rounded-lg border border-border bg-card p-6 space-y-3 mb-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            Current status
          </p>
          <h2 className="text-2xl font-semibold">{copy.label}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {copy.description}
          </p>
          {sr.vercelPreviewUrl ? (
            <a
              href={sr.vercelPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
            >
              View preview →
            </a>
          ) : null}
          {sr.productionUrl ? (
            <a
              href={sr.productionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 ml-2 rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium"
            >
              Open live site →
            </a>
          ) : null}
        </section>

        <StatusTimeline currentStatus={sr.status} events={sr.events} />

        <footer className="mt-12 text-xs text-muted-foreground text-center">
          Questions? Reply to the confirmation email and we'll get back to you.
        </footer>
      </div>
    </main>
  );
}
