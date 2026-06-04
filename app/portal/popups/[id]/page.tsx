import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requireScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { getPopupById } from "@/lib/popups/queries";
import { getSiteUrl } from "@/lib/brand";
import { PageHeader } from "@/components/admin/page-header";
import { PopupEditor } from "@/components/portal/popups/popup-editor";
import { InstallSnippet } from "@/app/portal/chatbot/install-snippet";
import { EmbedDetectionChip } from "@/components/portal/popups/embed-detection-chip";
import { PreviewLiveSite } from "@/components/portal/popups/preview-live-site";
import { TriggerInspector } from "@/components/portal/popups/trigger-inspector";
import { LiveEventFeed } from "@/components/portal/popups/live-event-feed";
import { TestFireButton } from "@/components/portal/popups/test-fire-button";

export const metadata: Metadata = { title: "Edit popup" };
export const dynamic = "force-dynamic";

export default async function PopupEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const scope = await requireScope();
  const { id } = await params;
  const popup = await getPopupById(scope.orgId, id);
  if (!popup) notFound();

  const [properties, org, marketingSite] = await Promise.all([
    prisma.property.findMany({
      where: marketablePropertyWhere(scope.orgId),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: { slug: true },
    }),
    // Resolve the URL we hand to the preview button + embed-detection
    // probe. Preference order:
    //   1. The property this campaign is bound to (if any), so per-
    //      property campaigns preview against the right site.
    //   2. The first marketable property with a websiteUrl set — this
    //      is the org's "default" public site in practice.
    // If neither resolves, both Preview + Embed chip render their
    // graceful "no URL configured" empty states.
    (async () => {
      if (popup.propertyId) {
        const p = await prisma.property.findFirst({
          where: { id: popup.propertyId, orgId: scope.orgId, websiteUrl: { not: null } },
          select: { websiteUrl: true },
        });
        if (p?.websiteUrl) return p.websiteUrl;
      }
      const p = await prisma.property.findFirst({
        where: { ...marketablePropertyWhere(scope.orgId), websiteUrl: { not: null } },
        select: { websiteUrl: true },
        orderBy: { updatedAt: "desc" },
      });
      return p?.websiteUrl ?? null;
    })(),
  ]);

  // One-line embed snippet — same shape as chatbot install-snippet so
  // operators recognize the pattern. The popup script reads the slug
  // attribute, calls /api/public/popup/config/[slug], and renders.
  //
  // CORS-safe host: 2026-06-04 primary-domain swap inverted the redirect
  // direction. APEX is now primary and www 308-redirects to apex. The
  // pre-swap workaround rewrote apex → www so a customer-site
  // cross-origin fetch wouldn't follow a 307 to a different origin (the
  // redirect response carries no Access-Control-Allow-Origin header).
  // Now the safe direction is the opposite — normalize any www in the
  // snippet host down to apex so the embed fetches the canonical URL
  // directly and never has to follow a cross-origin redirect.
  const snippetHost = getSiteUrl().replace(
    /^https:\/\/www\.leasestack\.co/i,
    "https://leasestack.co",
  );
  const snippet = `<script async src="${snippetHost}/embed/popup.js" data-tenant="${org?.slug ?? ""}"></script>`;

  // Norman bug #93: "the popups should have been shown many times since
  // going live, so there is probably just a data disconnect." We can't
  // see the embed config on every external site, but we can detect the
  // most common cause from server data and surface a self-service
  // troubleshoot card: status=ACTIVE for >24h with shownCount=0 almost
  // always means either (a) the embed snippet hasn't been pasted on
  // the live site, (b) it's pasted with the wrong data-tenant slug,
  // or (c) targetUrlPatterns excludes the pages where it fires. The
  // diagnostic only renders for this narrow case.
  const showTroubleshoot =
    popup.status === "ACTIVE" &&
    popup.shownCount === 0 &&
    Date.now() - popup.updatedAt.getTime() > 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-4 ls-page-fade">
      <PageHeader
        eyebrow={
          <Link
            href="/portal/popups"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <span aria-hidden="true">←</span> All popups
          </Link>
        }
        title={popup.name}
        description="Edit copy, design, triggers, and capture settings. The preview on the right updates as you type. Don't forget to hit Save."
      />

      {/* Testing surface — Preview / Embed detection / Trigger inspector /
          Live event feed. Sits above the editor so an operator can verify
          "this is wired correctly on my live site" without scrolling
          past every form field first. Each component degrades gracefully
          when its input is missing (no website URL, no events yet,
          etc.) so this whole block is safe to render unconditionally. */}
      <section
        aria-label="Test this popup"
        className="rounded-xl border border-border bg-background p-4 space-y-3"
      >
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-[13px] font-semibold text-foreground">Test this popup</h2>
            <p className="text-[11.5px] text-muted-foreground">
              Preview on your real site, verify the embed is installed, and watch SHOWN / DISMISSED / CTA events arrive live.
            </p>
          </div>
          <TestFireButton campaignId={popup.id} />
        </header>

        <PreviewLiveSite
          siteUrl={marketingSite}
          // Auto-expand the "Why isn't this firing?" help when the
          // popup has ZERO recorded impressions despite being ACTIVE.
          // The operator is almost certainly hitting the same
          // sessionStorage dedup issue Norman flagged on May 22.
          defaultShowHelp={
            popup.status === "ACTIVE" && popup.shownCount === 0
          }
        />

        <EmbedDetectionChip url={marketingSite} orgSlug={org?.slug ?? ""} />

        <div className="grid gap-3 md:grid-cols-2">
          <TriggerInspector
            trigger={popup.trigger}
            triggerThreshold={popup.triggerThreshold}
            targetUrlPatterns={
              Array.isArray(popup.targetUrlPatterns)
                ? (popup.targetUrlPatterns as string[])
                : []
            }
            frequency={popup.frequency}
            position={popup.position}
          />
          <LiveEventFeed campaignId={popup.id} />
        </div>
      </section>

      {showTroubleshoot ? (
        <div
          role="status"
          className="rounded-xl border border-amber-500/30 bg-amber-50/60 p-4 text-[12.5px] text-foreground space-y-2"
        >
          <p className="font-semibold flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="w-4 h-4 text-amber-700" strokeWidth={1.5} />
            This popup is active but hasn&apos;t recorded any impressions.
          </p>
          <p className="text-muted-foreground leading-snug">
            Most common causes, in order of likelihood:
          </p>
          <ol className="list-decimal pl-5 text-muted-foreground space-y-1 leading-snug">
            <li>
              The install snippet below isn&apos;t pasted on your live site
              yet. Add it once in your site&apos;s &lt;head&gt; (or via your CMS).
            </li>
            <li>
              The snippet is pasted with the wrong{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px] text-foreground">
                data-tenant
              </code>{" "}
              attribute. It must match your org slug exactly:{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px] text-foreground">
                {org?.slug ?? ""}
              </code>
              .
            </li>
            <li>
              Your{" "}
              <span className="font-semibold text-foreground">
                target URL patterns
              </span>{" "}
              don&apos;t match the page where you expect the popup to fire.
              Empty pattern list = any URL; otherwise the visited path
              must contain one of the patterns as a substring.
            </li>
            <li>
              The trigger threshold hasn&apos;t been reached. Time-on-page +
              scroll-depth triggers can sit silent on bounces.
            </li>
          </ol>
        </div>
      ) : null}

      <PopupEditor
        initial={{
          id: popup.id,
          name: popup.name,
          status: popup.status,
          headline: popup.headline,
          body: popup.body,
          ctaText: popup.ctaText,
          ctaUrl: popup.ctaUrl,
          offerCode: popup.offerCode,
          secondaryText: popup.secondaryText,
          trigger: popup.trigger,
          triggerThreshold: popup.triggerThreshold,
          targetUrlPatterns: Array.isArray(popup.targetUrlPatterns)
            ? (popup.targetUrlPatterns as string[])
            : [],
          frequency: popup.frequency,
          position: popup.position,
          primaryColor: popup.primaryColor,
          textColor: popup.textColor,
          backgroundColor: popup.backgroundColor,
          heroImageUrl: popup.heroImageUrl,
          captureEmail: popup.captureEmail,
          capturePhone: popup.capturePhone,
          propertyId: popup.propertyId,
          // Phase 1 — design parity fields. NULL on legacy rows; the editor
          // and preview both fall through to v1 treatment when unset.
          eyebrowText: popup.eyebrowText,
          accentColor: popup.accentColor,
          theme: popup.theme,
          template: popup.template,
          featuredLabel: popup.featuredLabel,
          featuredValue: popup.featuredValue,
          featuredUnit: popup.featuredUnit,
          featuredCaption: popup.featuredCaption,
          secondaryCtaText: popup.secondaryCtaText,
          secondaryCtaUrl: popup.secondaryCtaUrl,
          secondaryCtaIcon: (popup.secondaryCtaIcon ?? null) as
            | "calendar"
            | "phone"
            | "external"
            | "arrow"
            | "none"
            | null,
          primaryCtaIcon: (popup.primaryCtaIcon ?? null) as
            | "calendar"
            | "phone"
            | "external"
            | "arrow"
            | "none"
            | null,
          dismissText: popup.dismissText,
          gradientColors: Array.isArray(popup.gradientColors)
            ? (popup.gradientColors as string[])
            : null,
        }}
        properties={properties}
      />

      <InstallSnippet snippet={snippet} />
    </div>
  );
}
