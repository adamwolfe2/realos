import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { getConnectStatusForOrg, type ConnectSource } from "@/lib/connect/status";
import { getProviderAvailability } from "@/lib/connect/provider-availability";
import { getActivePropertyId } from "@/lib/portal/active-property";
import { Initial, Panel, Pill, Step } from "@/components/portal/overview/kit";
import { ConnectSteps, type ManagedIds, type SourceId, type SourceTile } from "./connect-steps";

export const metadata: Metadata = { title: "Setup" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/setup: the one onboarding walkthrough, per property. Three steps:
// the property, its data, its chatbot. Replaces the old checklist + duplicate
// data-source grid (Adam, 2026-10-28). /portal/connect redirects here.
// ---------------------------------------------------------------------------

const SOURCES: Array<{ id: SourceId; status: ConnectSource; name: string; line: string }> = [
  { id: "appfolio", status: "appfolio", name: "AppFolio", line: "Listings, leases and residents" },
  { id: "ga4", status: "ga4", name: "Google Analytics", line: "Website traffic and where it comes from" },
  { id: "gsc", status: "gsc", name: "Search Console", line: "How you rank on Google" },
  { id: "google-ads", status: "google_ads", name: "Google Ads", line: "Spend, results and your ads" },
  { id: "meta-ads", status: "meta_ads", name: "Meta Ads", line: "Facebook and Instagram results and ads" },
];
const KB_THIN = 300;
const fmtDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function managedIds(): ManagedIds {
  let googleEmail: string | null = null;
  try {
    const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "{}") as { client_email?: unknown };
    googleEmail = typeof sa.client_email === "string" ? sa.client_email : null;
  } catch (err) {
    console.error("[setup] GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON", err);
  }
  const availability = getProviderAvailability();
  return {
    googleEmail,
    googleAdsOAuth: availability.google_ads.available,
    metaAdsOAuth: availability.meta_ads.available,
  };
}

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ property?: string }> }) {
  const scope = await requireScope();
  const sp = await searchParams;
  const allowed = scope.allowedPropertyIds;
  const [properties, activeId] = await Promise.all([
    prisma.property.findMany({
      where: { orgId: scope.orgId, lifecycle: "ACTIVE", ...(allowed ? { id: { in: allowed } } : {}) },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, city: true, state: true, websiteUrl: true },
      take: 200,
    }),
    getActivePropertyId().catch((err) => {
      console.error("[setup] active property read failed", err);
      return null;
    }),
  ]);
  const property = properties.find((p) => p.id === sp.property) ?? properties.find((p) => p.id === activeId) ?? properties[0] ?? null;

  const [org, site, statuses, lastChat] = await Promise.all([
    prisma.organization.findUnique({ where: { id: scope.orgId }, select: { name: true, notifyLeadEmail: true, notifyOnChatbotLead: true, moduleChatbot: true } }),
    prisma.tenantSiteConfig.findUnique({ where: { orgId: scope.orgId }, select: { chatbotEnabled: true, chatbotPersonaName: true, chatbotGreeting: true, chatbotKnowledgeBase: true } }),
    getConnectStatusForOrg(scope.orgId, property?.id ?? null),
    prisma.chatbotConversation.findFirst({ where: { orgId: scope.orgId }, orderBy: { lastMessageAt: "desc" }, select: { lastMessageAt: true } }),
  ]);

  const tiles: SourceTile[] = SOURCES.map((s) => {
    const st = statuses.find((x) => x.id === s.status);
    const connected = Boolean(st?.connected);
    if (connected && st?.hasError) return { id: s.id, name: s.name, line: "Last sync failed. Reconnect to fix.", state: "error", stateText: "Needs attention" };
    if (connected) return { id: s.id, name: s.name, line: st?.lastSyncAt ? `Synced ${fmtDate.format(st.lastSyncAt)}${st.accountLabel ? ` · ${st.accountLabel}` : ""}` : st?.accountLabel ?? s.line, state: "connected", stateText: "Connected" };
    return { id: s.id, name: s.name, line: s.line, state: "off", stateText: "Not connected" };
  });

  const persona = Boolean(site?.chatbotPersonaName?.trim() && site?.chatbotGreeting?.trim());
  const knows = (site?.chatbotKnowledgeBase?.length ?? 0) >= KB_THIN;
  const routing = Boolean(org?.notifyLeadEmail?.trim() && org?.notifyOnChatbotLead);
  const installed = Boolean(lastChat && Date.now() - lastChat.lastMessageAt.getTime() < 7 * 86_400_000);
  const chatbot = [
    { label: "Name and greeting", ok: persona },
    { label: "Knows your rent, fees and policies", ok: knows },
    { label: "Leads emailed to your team", ok: routing },
    { label: "Installed on your site", ok: installed },
  ];

  const steps = [Boolean(property), tiles.some((t) => t.state === "connected"), installed];
  const done = steps.filter(Boolean).length;
  const name = property?.name ?? org?.name ?? "your property";
  const broken = tiles.filter((t) => t.state === "error").length;
  const ready = chatbot.filter((c) => c.ok).length;

  return (
    <div className="w-full space-y-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--t-ink)]">{done === 3 ? `${name} is live` : `Get ${name} live`}</h1>
          <p className="mt-0.5 text-[13.5px] text-[var(--t-muted)]">{done < 3 ? `${done} of 3 steps done · about 10 minutes` : broken ? `${broken} ${broken === 1 ? "source needs" : "sources need"} attention below` : ready < 4 ? `${4 - ready} chatbot ${4 - ready === 1 ? "item" : "items"} left to finish` : "Everything is connected. Edit anything below."}</p>
        </div>
        <span className="flex gap-1" aria-hidden>
          {steps.map((ok, i) => <span key={i} className="h-1.5 w-10 rounded-full" style={{ background: ok ? "var(--t-accent)" : "#dfe6f5" }} />)}
        </span>
      </header>

      <Panel
        title={<Step n={1}>Your property</Step>}
        aside={property ? <Pill tone="good">Done</Pill> : <Pill tone="warn">Add a property</Pill>}
        flush
      >
        {property ? (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
            <Initial name={property.name} size={34} />
            <span className="min-w-[220px] flex-1">
              <span className="block text-[13.5px] font-medium text-[var(--t-ink)]">{property.name}</span>
              <span className="block truncate text-[12.5px] text-[var(--t-muted)]">
                {[property.city, property.state].filter(Boolean).join(", ") || "No address yet"}
                {" · "}
                {property.websiteUrl ?? "No website added"}
              </span>
            </span>
            {properties.length > 1 ? (
              <span className="flex flex-wrap items-center gap-1.5">
                {properties.slice(0, 6).map((p) => (
                  <Link key={p.id} href={`/portal/setup?property=${p.id}`} className={p.id === property.id ? "rounded-full bg-[var(--t-wash)] px-2.5 py-1 text-[12.5px] font-medium text-[var(--t-ink)]" : "rounded-full px-2.5 py-1 text-[12.5px] text-[var(--t-muted)] hover:text-[var(--t-ink)]"}>
                    {p.name}
                  </Link>
                ))}
              </span>
            ) : null}
            <Link href={`/portal/properties/${property.id}`} className="text-[12.5px] font-medium text-[var(--t-accent)] hover:underline">{property.websiteUrl ? "Edit details" : "Add website"}</Link>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <p className="text-[13px] text-[var(--t-muted)]">Add the building you want leads for. Everything else hangs off it.</p>
            <Link href="/portal/properties" className="inline-flex h-8 items-center rounded-full bg-[var(--t-primary-bg)] px-3.5 text-[13px] font-medium text-white hover:opacity-90">Add property</Link>
          </div>
        )}
      </Panel>

      <Panel
        title={<Step n={2}>Connect your data</Step>}
        aside={steps[1] ? <Pill tone="good">{tiles.filter((t) => t.state === "connected").length} connected</Pill> : <Pill tone="warn">Connect at least one</Pill>}
      >
        <ConnectSteps tiles={tiles} ids={managedIds()} propertyId={property?.id ?? null} propertyName={name} />
        <p className="mt-3 text-[12.5px] text-[var(--t-muted)]">Coming soon: Yardi, Buildium, Entrata and RealPage.</p>
      </Panel>

      <Panel
        title={<Step n={3}>Turn on your chatbot</Step>}
        aside={installed && ready === 4 ? <Pill tone="good">Live</Pill> : <Pill tone="warn">{installed ? "Live · " : ""}{ready} of 4 ready</Pill>}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <ul className="grid flex-1 gap-2 sm:grid-cols-2">
            {chatbot.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-[13px] text-[var(--t-ink)]">
                <span className={c.ok ? "grid h-4 w-4 place-items-center rounded-full bg-[#16a34a] text-white" : "h-4 w-4 rounded-full border border-[#cbd5e1]"}>
                  {c.ok ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                </span>
                {c.label}
              </li>
            ))}
          </ul>
          <Link href="/portal/chatbot" className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-full bg-[var(--t-primary-bg)] px-4 text-[13px] font-medium text-white hover:opacity-90 md:self-auto">
            {installed ? "Open chatbot studio" : "Set up and try it"} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </Panel>

      {done === 3 ? (
        <Link href="/portal" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--t-accent)] hover:underline">
          Go to your overview <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
