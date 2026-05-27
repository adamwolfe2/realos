import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { StatusPanel } from "./status-panel";
import { PromptRunner } from "./prompt-runner";
import { PROMPT_00_TRIAGE, PROMPT_01_REVERSE_PRD } from "@/lib/site-engine/prompt-templates";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = { title: `Site request | ${BRAND_NAME} Admin` };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /admin/site-engine/[id] — full detail view for a single SiteRequest. Shows
// every intake answer, all uploaded assets, the event timeline, and the
// status / notes / artifacts mutation panel. The "Download build packet"
// button kicks off the zip download Adam pulls into local Claude Code.
// ---------------------------------------------------------------------------

export default async function SiteEngineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requireAgency();
  } catch {
    redirect("/sign-in");
  }
  const { id } = await params;

  const sr = await prisma.siteRequest.findUnique({
    where: { id },
    include: {
      intake: true,
      assets: { orderBy: { uploadedAt: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 50 },
      org: { select: { id: true, name: true, slug: true } },
      assignedTo: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  if (!sr) notFound();

  const submitterLabel = `${sr.submittedByName} (${sr.submittedByEmail})`;

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title={sr.intake?.brandName ?? sr.submittedByName}
        description={`Site request ${sr.slug} · submitted ${formatDistanceToNow(
          sr.submittedAt,
          { addSuffix: true },
        )} by ${submitterLabel}`}
        breadcrumb={
          <Link href="/admin/site-engine" className="hover:underline">
            ← Site engine
          </Link>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button asChild>
              <a
                href={`/api/site-requests/${sr.id}/packet`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download build packet
              </a>
            </Button>
          </div>
        }
      />

      {/* Inline prompt runners — Triage + PRD extraction. Surface above
          the read-only sections because these are the actions Adam takes
          most often when working a new row. */}
      <PromptRunner
        siteRequestId={sr.id}
        prompt00={PROMPT_00_TRIAGE}
        prompt01={PROMPT_01_REVERSE_PRD}
        inspirationUrls={sr.intake?.inspirationUrls ?? []}
        intakePayload={{
          siteRequest: {
            id: sr.id,
            slug: sr.slug,
            tier: sr.tier,
            status: sr.status,
            submittedAt: sr.submittedAt.toISOString(),
            source: sr.source,
            submitter: {
              name: sr.submittedByName,
              email: sr.submittedByEmail,
              phone: sr.submittedByPhone,
              company: sr.submittedByCompany,
            },
          },
          intake: sr.intake,
          assetCount: sr.assets.length,
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SectionCard label="Submitter">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Row label="Name" value={sr.submittedByName} />
              <Row label="Email" value={sr.submittedByEmail} />
              <Row label="Phone" value={sr.submittedByPhone ?? "—"} />
              <Row label="Company" value={sr.submittedByCompany ?? "—"} />
              <Row
                label="Linked org"
                value={
                  sr.org ? (
                    <Link
                      href={`/admin/clients/${sr.org.id}`}
                      className="text-primary underline underline-offset-2"
                    >
                      {sr.org.name}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <Row
                label="Source"
                value={sr.source ? sr.source : "direct"}
              />
              <Row label="Tier" value={humanTier(sr.tier)} />
              <Row label="Priority" value={sr.priority} />
            </dl>
          </SectionCard>

          {sr.intake ? (
            <>
              <SectionCard label="Brand">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <Row label="Brand name" value={sr.intake.brandName} />
                  <Row label="Tagline" value={sr.intake.tagline ?? "—"} />
                  <Row label="Color" value={sr.intake.brandColorHex ?? "—"} />
                  <Row label="Vertical" value={sr.intake.vertical ?? "—"} />
                  <Row
                    label="Service areas"
                    value={sr.intake.serviceAreas.join(", ") || "—"}
                  />
                  <Row
                    label="HQ"
                    value={
                      [sr.intake.hqCity, sr.intake.hqState]
                        .filter(Boolean)
                        .join(", ") || "—"
                    }
                  />
                  <Row label="Identity" value={sr.intake.identityType ?? "—"} />
                </dl>
              </SectionCard>

              <SectionCard label="Compliance">
                <dl className="grid grid-cols-3 gap-x-6 gap-y-3 text-sm">
                  <Row label="License #" value={sr.intake.licenseNumber ?? "—"} />
                  <Row label="Brokerage" value={sr.intake.brokerageName ?? "—"} />
                  <Row label="State" value={sr.intake.licenseState ?? "—"} />
                </dl>
              </SectionCard>

              <SectionCard label="Visual direction">
                <dl className="grid grid-cols-1 gap-4 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Row
                      label="Preset"
                      value={
                        sr.intake.chosenPresetSlug ??
                        sr.intake.presetChoice ??
                        "—"
                      }
                    />
                    <Row
                      label="Design language"
                      value={sr.intake.chosenDesignLanguageSlug ?? "—"}
                    />
                    <Row
                      label="Palette"
                      value={sr.intake.chosenPaletteSlug ?? "—"}
                    />
                  </div>

                  {/* Inline expanders for the chosen design language + palette
                      — pulls actual content from public/site-engine/data/
                      (the bundled kit data) so Adam can review without
                      switching to GitHub. Renders nothing when nothing's
                      picked. */}
                  {sr.intake.chosenDesignLanguageSlug ? (
                    <DesignLanguageCard slug={sr.intake.chosenDesignLanguageSlug} />
                  ) : null}
                  {sr.intake.chosenPaletteSlug ? (
                    <PaletteCard slug={sr.intake.chosenPaletteSlug} />
                  ) : null}

                  <Row
                    label="Current site"
                    value={
                      sr.intake.currentSiteUrl ? (
                        <a
                          href={sr.intake.currentSiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-2"
                        >
                          {sr.intake.currentSiteUrl}
                        </a>
                      ) : (
                        "—"
                      )
                    }
                  />

                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                      Inspiration URLs
                    </div>
                    {sr.intake.inspirationUrls.length === 0 ? (
                      <p className="text-sm text-muted-foreground">None provided.</p>
                    ) : (
                      <ul className="space-y-1">
                        {sr.intake.inspirationUrls.map((u) => (
                          <li key={u}>
                            <a
                              href={u}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary underline underline-offset-2 break-all"
                            >
                              {u}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {sr.assets.filter((a) => a.type === "INSPIRATION").length > 0 ? (
                    <div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                        Inspiration screenshots
                      </div>
                      <ul className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {sr.assets
                          .filter((a) => a.type === "INSPIRATION")
                          .map((a) => (
                            <li
                              key={a.id}
                              className="rounded-md border border-border overflow-hidden bg-background"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={a.blobUrl}
                                alt={a.filename}
                                className="w-full h-28 object-cover"
                              />
                              <div className="px-2 py-1.5 text-[11px] text-muted-foreground truncate" title={a.filename}>
                                {a.filename}
                              </div>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}

                  {sr.intake.negativeInputs ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                      <div className="text-xs uppercase tracking-widest text-amber-700 font-semibold mb-1">
                        Things to avoid
                      </div>
                      <p className="text-sm text-amber-900 whitespace-pre-wrap">
                        {sr.intake.negativeInputs}
                      </p>
                    </div>
                  ) : null}
                </dl>
              </SectionCard>

              <SectionCard label="Assets">
                {sr.assets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assets uploaded.</p>
                ) : (
                  <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                            className="w-full h-32 object-cover rounded"
                          />
                        ) : (
                          <div className="w-full h-32 rounded bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                            {a.mimeType.split("/")[1]?.toUpperCase() ?? "FILE"}
                          </div>
                        )}
                        <div className="mt-2 text-xs">
                          <div className="font-medium truncate" title={a.filename}>
                            {a.filename}
                          </div>
                          <div className="text-muted-foreground">
                            {a.type.replaceAll("_", " ").toLowerCase()} ·{" "}
                            {(a.size / 1024).toFixed(0)} KB
                          </div>
                          <a
                            href={a.blobUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-2"
                          >
                            Open
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              {sr.intake.voiceSample ? (
                <SectionCard label="Voice sample">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                    {sr.intake.voiceSample}
                  </pre>
                </SectionCard>
              ) : null}

              {sr.intake.bio ? (
                <SectionCard label="Bio">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                    {sr.intake.bio}
                  </pre>
                </SectionCard>
              ) : null}

              <SectionCard label="Content">
                <div className="space-y-4 text-sm">
                  <ContentList
                    title="Services"
                    items={
                      Array.isArray(sr.intake.services)
                        ? (sr.intake.services as Array<{ title?: string; description?: string }>)
                        : []
                    }
                    renderItem={(it) => (
                      <>
                        <strong>{it.title}</strong>
                        {it.description ? (
                          <span className="text-muted-foreground"> — {it.description}</span>
                        ) : null}
                      </>
                    )}
                  />
                  <ContentList
                    title="Testimonials"
                    items={
                      Array.isArray(sr.intake.testimonials)
                        ? (sr.intake.testimonials as Array<{
                            name?: string;
                            quote?: string;
                            role?: string;
                          }>)
                        : []
                    }
                    renderItem={(it) => (
                      <>
                        <strong>{it.name}</strong>
                        {it.role ? <span className="text-muted-foreground">, {it.role}</span> : null}
                        {it.quote ? <div className="text-muted-foreground mt-1">“{it.quote}”</div> : null}
                      </>
                    )}
                  />
                  <ContentList
                    title="Key stats"
                    items={
                      Array.isArray(sr.intake.keyStats)
                        ? (sr.intake.keyStats as Array<{ label?: string; value?: string }>)
                        : []
                    }
                    renderItem={(it) => (
                      <>
                        <strong>{it.value}</strong>
                        <span className="text-muted-foreground"> — {it.label}</span>
                      </>
                    )}
                  />
                </div>
              </SectionCard>

              <SectionCard label="Integrations & domain">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <Row label="Calendly" value={sr.intake.calendlyUrl ?? "—"} />
                  <Row label="CRM" value={sr.intake.crmChoice ?? "—"} />
                  <Row label="MLS" value={sr.intake.mlsPreference ?? "—"} />
                  <Row label="GA4 id" value={sr.intake.ga4Id ?? "—"} />
                  <Row label="Domain" value={sr.intake.domain ?? "—"} />
                  <Row
                    label="Needs domain?"
                    value={boolLabel(sr.intake.domainNeeded)}
                  />
                  <Row
                    label="Has DNS access?"
                    value={boolLabel(sr.intake.dnsAccess)}
                  />
                  <Row
                    label="Timeline"
                    value={sr.intake.timelineExpectation ?? "—"}
                  />
                  <Row label="Budget tier" value={sr.intake.budgetTier ?? "—"} />
                  <Row
                    label="Budget confirmed?"
                    value={boolLabel(sr.intake.budgetConfirmed)}
                  />
                </dl>
              </SectionCard>

              {sr.intake.anythingElse ? (
                <SectionCard label="Anything else">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                    {sr.intake.anythingElse}
                  </pre>
                </SectionCard>
              ) : null}
            </>
          ) : (
            <SectionCard label="Intake">
              <p className="text-sm text-muted-foreground">
                No intake response on this row — submitted via API without
                payload, or pre-existing test data.
              </p>
            </SectionCard>
          )}

          <SectionCard label="Activity">
            {sr.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <ol className="space-y-2">
                {sr.events.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">
                        {humanEventKind(e.kind)}
                        {e.fromStatus && e.toStatus
                          ? `: ${humanStatus(e.fromStatus)} → ${humanStatus(e.toStatus)}`
                          : ""}
                      </div>
                      {e.message ? (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {e.message}
                        </div>
                      ) : null}
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap tabular-nums">
                      {formatDistanceToNow(e.createdAt, { addSuffix: true })}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </div>

        <aside className="space-y-6">
          <StatusPanel
            id={sr.id}
            currentStatus={sr.status}
            internalNotes={sr.internalNotes}
            githubRepoUrl={sr.githubRepoUrl}
            vercelProjectId={sr.vercelProjectId}
            vercelPreviewUrl={sr.vercelPreviewUrl}
            productionUrl={sr.productionUrl}
          />
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
        {label}
      </dt>
      <dd className="text-sm text-foreground mt-0.5">{value}</dd>
    </div>
  );
}

function ContentList<T>({
  title,
  items,
  renderItem,
}: {
  title: string;
  items: T[];
  renderItem: (it: T) => React.ReactNode;
}) {
  if (!items?.length) {
    return (
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
          {title}
        </div>
        <p className="text-sm text-muted-foreground mt-1">None.</p>
      </div>
    );
  }
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
        {title}
      </div>
      <ul className="mt-1 space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-sm">
            {renderItem(it)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function boolLabel(v: boolean | null | undefined): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "—";
}

function humanStatus(s: string): string {
  return s.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanTier(t: string): string {
  switch (t) {
    case "TIER1_MARKETING":
      return "Marketing";
    case "TIER2_PORTAL":
      return "Portal";
    case "TIER3_CUSTOM":
      return "Custom";
    default:
      return t;
  }
}

function humanEventKind(k: string): string {
  switch (k) {
    case "status_change":
      return "Status changed";
    case "note":
      return "Note";
    case "email_sent":
      return "Email sent";
    case "preview_sent":
      return "Preview sent";
    case "revision_requested":
      return "Revision requested";
    case "packet_downloaded":
      return "Build packet downloaded";
    default:
      return k;
  }
}

// ---------------------------------------------------------------------------
// Visual-direction inline cards. Server components — read straight from the
// bundled kit data in public/site-engine/data/ via Node fs at request time.
// ---------------------------------------------------------------------------

import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface DesignLanguageEntry {
  name: string;
  description: string;
  category: string;
  colorPhilosophy: string | null;
  typography: string | null;
  motion: string | null;
  bestFor: string[];
  sampleColors: { primary: string | null; canvas: string | null };
}

// Slug → domain map for Clearbit logos + website links. Keep in sync with
// the matching map in lib/site-engine/visual-direction-catalogs.ts.
const DL_DOMAIN_OVERRIDES: Record<string, string> = {
  "bmw-m": "bmw-m.com",
  cal: "cal.com",
  claude: "claude.ai",
  composio: "composio.dev",
  expo: "expo.dev",
  hashicorp: "hashicorp.com",
  "linear.app": "linear.app",
  lovable: "lovable.dev",
  meta: "meta.com",
  minimax: "minimaxi.com",
  mintlify: "mintlify.com",
  "mistral.ai": "mistral.ai",
  ollama: "ollama.com",
  "opencode.ai": "opencode.ai",
  playstation: "playstation.com",
  posthog: "posthog.com",
  raycast: "raycast.com",
  replicate: "replicate.com",
  resend: "resend.com",
  runwayml: "runwayml.com",
  sanity: "sanity.io",
  sentry: "sentry.io",
  spacex: "spacex.com",
  superhuman: "superhuman.com",
  theverge: "theverge.com",
  "together.ai": "together.ai",
  vercel: "vercel.com",
  voltagent: "voltagent.dev",
  warp: "warp.dev",
  webflow: "webflow.com",
  wired: "wired.com",
  wise: "wise.com",
  "x.ai": "x.ai",
  zapier: "zapier.com",
};

function dlDomain(slug: string): string {
  return DL_DOMAIN_OVERRIDES[slug] ?? `${slug}.com`;
}

async function DesignLanguageCard({ slug }: { slug: string }) {
  let entry: DesignLanguageEntry | null = null;
  try {
    const indexPath = join(
      process.cwd(),
      "public",
      "site-engine",
      "design-languages-index.json",
    );
    const raw = await readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw) as {
      designLanguages: Array<DesignLanguageEntry & { slug: string }>;
    };
    entry = parsed.designLanguages.find((d) => d.slug === slug) ?? null;
  } catch {
    // Bundled data missing — fall through to slug-only render.
  }

  const domain = dlDomain(slug);
  const website = `https://${domain}`;
  const logoUrl = `https://logo.clearbit.com/${domain}?size=128`;

  if (!entry) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
        Design language <code className="text-foreground">{slug}</code> wasn&apos;t
        found in the bundled catalog. Run{" "}
        <code className="text-foreground">pnpm sync:site-engine-data</code> after
        the kit&apos;s INDEX.json is regenerated.
      </div>
    );
  }

  return (
    <details className="rounded-md border border-border bg-background p-3 open:bg-card">
      <summary className="cursor-pointer flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={`${entry.name} logo`}
            className="size-7 rounded-sm bg-white object-contain border border-border/50 shrink-0"
            loading="lazy"
          />
          <div className="min-w-0">
            <div className="font-medium text-foreground capitalize">{entry.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {entry.category} · {entry.colorPhilosophy ?? "—"} ·{" "}
              {entry.typography ?? "—"} · {entry.motion ?? "—"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {entry.sampleColors.canvas ? (
            <span
              className="size-4 rounded-sm border border-border"
              style={{ background: entry.sampleColors.canvas }}
              title={`canvas ${entry.sampleColors.canvas}`}
            />
          ) : null}
          {entry.sampleColors.primary ? (
            <span
              className="size-4 rounded-sm border border-border"
              style={{ background: entry.sampleColors.primary }}
              title={`primary ${entry.sampleColors.primary}`}
            />
          ) : null}
        </div>
      </summary>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground border-t border-border pt-3">
        <p className="leading-relaxed">{entry.description}</p>
        {entry.bestFor.length > 0 ? (
          <p className="text-xs">
            <span className="uppercase tracking-widest text-foreground font-semibold mr-2">
              Best for
            </span>
            {entry.bestFor.join(" · ")}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Full DESIGN.md ships in the build packet under{" "}
          <code className="text-foreground">visual-direction/design-language-{slug}.md</code>.
        </p>
        <div className="pt-2">
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            View live site at {domain} <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </details>
  );
}

interface PaletteEntry {
  name: string;
  description: string;
  category: string;
  colors: Record<string, string>;
  wcagAACompliant?: boolean;
}

async function PaletteCard({ slug }: { slug: string }) {
  let palette: PaletteEntry | null = null;
  try {
    const palettePath = join(
      process.cwd(),
      "public",
      "site-engine",
      "data",
      "palettes",
      `${slug}.json`,
    );
    const raw = await readFile(palettePath, "utf8");
    palette = JSON.parse(raw);
  } catch {
    // ignore
  }

  if (!palette) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
        Palette <code className="text-foreground">{slug}</code> not found.
      </div>
    );
  }

  const SWATCH_ORDER = [
    "background",
    "backgroundAlt",
    "surface",
    "textPrimary",
    "textSecondary",
    "textMuted",
    "primary",
    "primaryDark",
    "primaryLight",
    "accent",
    "border",
    "borderStrong",
  ];

  return (
    <details className="rounded-md border border-border bg-background p-3 open:bg-card">
      <summary className="cursor-pointer flex items-center justify-between gap-3 text-sm">
        <div className="min-w-0">
          <div className="font-medium text-foreground">{palette.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {palette.category}
            {palette.wcagAACompliant === false ? " · ⚠ Not WCAG AA" : ""}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {["background", "primary", "accent"].map((k) =>
            palette.colors[k] ? (
              <span
                key={k}
                className="size-4 rounded-sm border border-border"
                style={{ background: palette.colors[k] }}
                title={`${k} ${palette.colors[k]}`}
              />
            ) : null,
          )}
        </div>
      </summary>
      <div className="mt-3 space-y-3 border-t border-border pt-3">
        <p className="text-sm text-muted-foreground">{palette.description}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {SWATCH_ORDER.filter((k) => palette.colors[k]).map((k) => (
            <div
              key={k}
              className="rounded border border-border overflow-hidden bg-background"
            >
              <div
                className="h-10 w-full"
                style={{ background: palette.colors[k] }}
              />
              <div className="px-2 py-1">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  {k}
                </div>
                <div className="text-xs font-mono text-foreground">
                  {palette.colors[k]}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
