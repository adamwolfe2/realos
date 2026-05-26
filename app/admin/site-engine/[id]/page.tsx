import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { StatusPanel } from "./status-panel";
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
                <dl className="grid grid-cols-1 gap-3 text-sm">
                  <Row
                    label="Preset"
                    value={sr.intake.presetChoice ?? "—"}
                  />
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
                  <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mt-2">
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
