import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { BackendPlatform, OrgType } from "@prisma/client";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { AppfolioActionButton } from "./action-buttons";

export const metadata: Metadata = { title: "AppFolio sync · Admin" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// AppFolio sync diagnosis. Cross-tenant view of every CLIENT org's AppFolio
// integration state, per-tenant failure mode, and quick actions to recover.
//
// What you'll usually see for a tenant whose listings aren't syncing:
//   1. No integration row              → "Not connected" pill
//   2. Embed mode (no REST creds)      → REST sync skipped entirely
//   3. lastError set                   → token bad, network blip, etc.
//   4. Properties without backendPlatform=APPFOLIO → listings drop silently
//   5. Sync ran but 0 listings         → propertyGroupFilter too tight, or
//                                         the AppFolio account genuinely has
//                                         nothing on the listings page.
// ---------------------------------------------------------------------------

type TenantRow = {
  orgId: string;
  orgName: string;
  orgSlug: string;
  status: "not_connected" | "embed" | "rest" | "syncing" | "error";
  syncStatus: string | null;
  lastSyncAt: Date | null;
  lastError: string | null;
  subdomain: string | null;
  propertiesTotal: number;
  propertiesAttached: number;
  listingsTotal: number;
  listingsAvailable: number;
  recentEvents: Array<{
    id: string;
    description: string | null;
    createdAt: Date;
    diff: unknown;
  }>;
  diagnosis: string;
  fixAction: "sync" | "attach" | "clear" | null;
};

export default async function AppfolioDiagnosisPage() {
  await requireAgency();

  const orgs = await prisma.organization.findMany({
    where: { orgType: OrgType.CLIENT },
    select: {
      id: true,
      name: true,
      slug: true,
      moduleChatbot: true,
      appfolioIntegration: {
        select: {
          id: true,
          instanceSubdomain: true,
          plan: true,
          syncStatus: true,
          lastSyncAt: true,
          lastError: true,
          clientIdEncrypted: true,
          clientSecretEncrypted: true,
          apiKeyEncrypted: true,
          useEmbedFallback: true,
          autoSyncEnabled: true,
          propertyGroupFilter: true,
          syncFrequencyMinutes: true,
        },
      },
      properties: {
        select: {
          id: true,
          backendPlatform: true,
          _count: { select: { listings: true } },
          listings: {
            where: { isAvailable: true },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Recent admin/sync events per integration. Pulled with one query, grouped
  // in memory.
  const integrationIds = orgs
    .map((o) => o.appfolioIntegration?.id)
    .filter((v): v is string => !!v);
  const events = integrationIds.length
    ? await prisma.auditEvent.findMany({
        where: {
          entityType: "AppFolioIntegration",
          entityId: { in: integrationIds },
        },
        orderBy: { createdAt: "desc" },
        take: 8 * integrationIds.length,
        select: {
          id: true,
          entityId: true,
          description: true,
          createdAt: true,
          diff: true,
        },
      })
    : [];
  const eventsByIntegration = new Map<string, typeof events>();
  for (const ev of events) {
    if (!ev.entityId) continue;
    const arr = eventsByIntegration.get(ev.entityId) ?? [];
    if (arr.length < 5) arr.push(ev);
    eventsByIntegration.set(ev.entityId, arr);
  }

  const rows: TenantRow[] = orgs.map((o) => {
    const integ = o.appfolioIntegration;
    const propertiesTotal = o.properties.length;
    const propertiesAttached = o.properties.filter(
      (p) => p.backendPlatform === BackendPlatform.APPFOLIO
    ).length;
    const listingsTotal = o.properties.reduce(
      (s, p) => s + p._count.listings,
      0
    );
    const listingsAvailable = o.properties.reduce(
      (s, p) => s + p.listings.length,
      0
    );

    let status: TenantRow["status"] = "not_connected";
    let diagnosis = "AppFolio not connected for this tenant.";
    let fixAction: TenantRow["fixAction"] = null;

    if (integ) {
      const hasRest =
        Boolean(integ.clientIdEncrypted) &&
        Boolean(integ.clientSecretEncrypted || integ.apiKeyEncrypted);
      if (integ.syncStatus === "syncing") {
        status = "syncing";
        // Stuck if syncing more than 15 min ago
        if (
          integ.lastSyncAt &&
          Date.now() - integ.lastSyncAt.getTime() > 15 * 60 * 1000
        ) {
          diagnosis = "Sync flag is stuck. Clear it, then re-run.";
          fixAction = "clear";
        } else {
          diagnosis = "Sync in progress.";
        }
      } else if (integ.lastError) {
        status = "error";
        diagnosis = integ.lastError;
        fixAction = "sync";
      } else if (integ.useEmbedFallback) {
        status = "embed";
        diagnosis = `Embed scrape mode (no REST creds). Listings come from ${integ.instanceSubdomain}.appfolio.com/listings.`;
        fixAction = "sync";
      } else if (hasRest) {
        status = "rest";
        if (!integ.lastSyncAt) {
          diagnosis = "REST creds saved but sync hasn't run yet.";
          fixAction = "sync";
        } else if (listingsTotal === 0) {
          if (propertiesTotal === 0) {
            diagnosis =
              "Sync ran but no Property rows exist on this tenant. Add a Property first, then re-sync.";
          } else if (propertiesAttached === 0) {
            diagnosis =
              "Properties exist but none have backendPlatform=APPFOLIO. Listings drop silently.";
            fixAction = "attach";
          } else {
            diagnosis =
              integ.propertyGroupFilter
                ? `Sync ran but matched 0 listings. Check propertyGroupFilter (${integ.propertyGroupFilter}) — it may be filtering everything out.`
                : "Sync ran cleanly but matched 0 listings on AppFolio's side. Confirm the AppFolio account actually publishes any units.";
          }
        } else {
          diagnosis = "OK.";
        }
      } else {
        status = "error";
        diagnosis = "Integration row exists but has no usable credentials.";
        fixAction = "sync";
      }
    }

    return {
      orgId: o.id,
      orgName: o.name,
      orgSlug: o.slug,
      status,
      syncStatus: integ?.syncStatus ?? null,
      lastSyncAt: integ?.lastSyncAt ?? null,
      lastError: integ?.lastError ?? null,
      subdomain: integ?.instanceSubdomain ?? null,
      propertiesTotal,
      propertiesAttached,
      listingsTotal,
      listingsAvailable,
      recentEvents: integ
        ? (eventsByIntegration.get(integ.id) ?? []).map((e) => ({
            id: e.id,
            description: e.description,
            createdAt: e.createdAt,
            diff: e.diff,
          }))
        : [],
      diagnosis,
      fixAction,
    };
  });

  const totals = {
    tenants: rows.length,
    connected: rows.filter((r) => r.status !== "not_connected").length,
    syncing: rows.filter((r) => r.status === "syncing").length,
    erroring: rows.filter((r) => r.status === "error").length,
    healthy: rows.filter(
      (r) =>
        (r.status === "rest" || r.status === "embed") &&
        r.listingsTotal > 0 &&
        !r.lastError
    ).length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AppFolio sync"
        description="Every tenant's AppFolio integration state at a glance. Diagnoses the most common silent failures and gives you the right fix button per tenant."
      />

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Tenants" value={totals.tenants} />
        <Stat label="Connected" value={totals.connected} />
        <Stat label="Healthy" value={totals.healthy} tone="ok" />
        <Stat label="Erroring" value={totals.erroring} tone="bad" />
        <Stat label="Syncing now" value={totals.syncing} />
      </section>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left font-semibold px-4 py-2.5">Tenant</th>
              <th className="text-left font-semibold px-4 py-2.5">Status</th>
              <th className="text-left font-semibold px-4 py-2.5">
                Subdomain
              </th>
              <th className="text-right font-semibold px-4 py-2.5">
                Properties
              </th>
              <th className="text-right font-semibold px-4 py-2.5">
                Listings
              </th>
              <th className="text-left font-semibold px-4 py-2.5">
                Last sync
              </th>
              <th className="text-left font-semibold px-4 py-2.5">
                Diagnosis
              </th>
              <th className="text-left font-semibold px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.orgId} className="align-top">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/clients/${r.orgId}`}
                    className="font-medium text-foreground hover:underline text-xs"
                  >
                    {r.orgName}
                  </Link>
                  <div className="text-[10px] text-muted-foreground">
                    {r.orgSlug}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={r.status} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                  {r.subdomain ?? "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-xs">
                  <div>{r.propertiesAttached} / {r.propertiesTotal}</div>
                  <div className="text-[10px] text-muted-foreground">
                    attached
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-xs">
                  <div>{r.listingsAvailable} / {r.listingsTotal}</div>
                  <div className="text-[10px] text-muted-foreground">
                    available
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {r.lastSyncAt
                    ? formatDistanceToNow(r.lastSyncAt, { addSuffix: true })
                    : "Never"}
                </td>
                <td className="px-4 py-3 text-xs text-foreground max-w-md">
                  <div className="line-clamp-3">{r.diagnosis}</div>
                  {r.recentEvents.length > 0 ? (
                    <details className="mt-1">
                      <summary className="text-[10px] text-muted-foreground cursor-pointer">
                        Last {r.recentEvents.length} events
                      </summary>
                      <ul className="mt-1 space-y-1">
                        {r.recentEvents.map((ev) => (
                          <li
                            key={ev.id}
                            className="text-[10px] text-muted-foreground"
                          >
                            <span className="text-foreground">
                              {formatDistanceToNow(ev.createdAt, {
                                addSuffix: true,
                              })}
                            </span>
                            : {ev.description ?? "—"}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </td>
                <td className="px-4 py-3 space-y-1">
                  {r.status === "not_connected" ? (
                    <Link
                      href={`/admin/clients/${r.orgId}`}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Connect →
                    </Link>
                  ) : (
                    <>
                      {r.fixAction === "attach" ? (
                        <AppfolioActionButton
                          orgId={r.orgId}
                          variant="attach"
                          label="Attach properties"
                        />
                      ) : null}
                      {r.fixAction === "clear" ? (
                        <AppfolioActionButton
                          orgId={r.orgId}
                          variant="clear"
                          label="Clear stuck"
                        />
                      ) : null}
                      <AppfolioActionButton
                        orgId={r.orgId}
                        variant="sync"
                        label="Run sync"
                      />
                    </>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-xs text-muted-foreground"
                >
                  No CLIENT tenants found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-border bg-muted/20 p-5">
        <h2 className="text-sm font-semibold text-foreground mb-2">
          Diagnosis cheat sheet
        </h2>
        <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-5">
          <li>
            <strong>Not connected:</strong> open the client's settings &gt;
            integrations and add subdomain + REST creds (or embed fallback).
          </li>
          <li>
            <strong>REST creds saved, never synced:</strong> click Run sync.
            First sync pulls 90 days of history.
          </li>
          <li>
            <strong>Properties not attached:</strong> sync runs but listings
            drop because Property.backendPlatform = NONE. Click Attach
            properties, then Run sync.
          </li>
          <li>
            <strong>0 listings on AppFolio side:</strong> propertyGroupFilter
            may be too tight, or the AppFolio account genuinely has nothing
            published. Verify by visiting{" "}
            <code>{"<subdomain>"}.appfolio.com/listings</code> directly.
          </li>
          <li>
            <strong>Sync stuck:</strong> a previous run crashed mid-flight and
            left syncStatus=&quot;syncing&quot;. Click Clear stuck.
          </li>
          <li>
            <strong>Embed mode:</strong> tenant is on AppFolio Core (no REST
            API). Listings scrape from the public AppFolio listings page —
            slower, less reliable, but works without API access.
          </li>
        </ul>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tone === "ok"
            ? "text-emerald-700"
            : tone === "bad"
              ? "text-destructive"
              : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: TenantRow["status"] }) {
  switch (status) {
    case "not_connected":
      return <StatusBadge tone="muted">Not connected</StatusBadge>;
    case "embed":
      return <StatusBadge tone="info">Embed</StatusBadge>;
    case "rest":
      return <StatusBadge tone="success">REST</StatusBadge>;
    case "syncing":
      return <StatusBadge tone="info">Syncing</StatusBadge>;
    case "error":
      return <StatusBadge tone="danger">Error</StatusBadge>;
  }
}
