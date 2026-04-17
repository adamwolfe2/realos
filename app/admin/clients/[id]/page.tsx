import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { OrgType } from "@prisma/client";
import { ImpersonateButton } from "./impersonate-button";

export const metadata: Metadata = { title: "Client detail" };
export const dynamic = "force-dynamic";

export default async function ClientDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAgency();
  const { id } = await params;

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          properties: true,
          leads: true,
          visitors: true,
          chatbotConversations: true,
          creativeRequests: true,
          users: true,
          adCampaigns: true,
          domains: true,
        },
      },
      properties: {
        include: { _count: { select: { listings: true } } },
        take: 20,
        orderBy: { updatedAt: "desc" },
      },
      domains: true,
      tenantSiteConfig: true,
      projects: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { _count: { select: { tasks: true, notes: true } } },
      },
      clientNotes: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
  if (!org || org.orgType !== OrgType.CLIENT) notFound();

  const moduleRows: Array<[string, boolean]> = [
    ["Website", org.moduleWebsite],
    ["Lead Capture", org.moduleLeadCapture],
    ["Pixel", org.modulePixel],
    ["Chatbot", org.moduleChatbot],
    ["Google Ads", org.moduleGoogleAds],
    ["Meta Ads", org.moduleMetaAds],
    ["SEO", org.moduleSEO],
    ["Email", org.moduleEmail],
    ["Outbound Email", org.moduleOutboundEmail],
    ["Referrals", org.moduleReferrals],
    ["Creative Studio", org.moduleCreativeStudio],
  ];

  const recentLeads = await prisma.lead.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { property: { select: { name: true } } },
  });

  const recentAudits = await prisma.auditEvent.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/admin/clients"
            className="text-xs opacity-60 hover:opacity-100"
          >
            ← All clients
          </Link>
          <h1 className="font-serif text-3xl font-bold mt-2">{org.name}</h1>
          <p className="text-sm opacity-70 mt-1">
            {org.propertyType}
            {org.residentialSubtype
              ? `, ${org.residentialSubtype}`
              : org.commercialSubtype
              ? `, ${org.commercialSubtype}`
              : ""}{" "}
            · {org.slug} · {org.status}
          </p>
          {org.primaryContactName ? (
            <p className="text-xs opacity-60 mt-1">
              {org.primaryContactName}
              {org.primaryContactEmail ? `, ${org.primaryContactEmail}` : ""}
              {org.primaryContactPhone ? ` · ${org.primaryContactPhone}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <ImpersonateButton orgId={org.id} />
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <MiniStat label="Properties" value={org._count.properties} />
        <MiniStat label="Leads" value={org._count.leads} />
        <MiniStat label="Visitors" value={org._count.visitors} />
        <MiniStat label="Chats" value={org._count.chatbotConversations} />
        <MiniStat label="Ad campaigns" value={org._count.adCampaigns} />
        <MiniStat label="Domains" value={org._count.domains} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel label="Modules">
          <ul className="grid grid-cols-2 gap-y-1.5 text-sm">
            {moduleRows.map(([k, v]) => (
              <li
                key={k}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span>{k}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    v
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {v ? "On" : "Off"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel label="Domains">
          {org.domains.length === 0 ? (
            <p className="text-xs opacity-60">
              None attached, fallback subdomain: {org.slug}.realos.dev
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {org.domains.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span>{d.hostname}</span>
                  <span className="text-[10px] opacity-60">
                    {d.isPrimary ? "Primary, " : ""}
                    {d.sslStatus ?? "pending"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel label="Properties">
          {org.properties.length === 0 ? (
            <p className="text-xs opacity-60">No properties seeded yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {org.properties.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between py-2"
                >
                  <span>
                    {p.name}
                    <span className="text-[11px] opacity-60 ml-1">
                      /{p.slug}
                    </span>
                  </span>
                  <span className="text-[11px] opacity-70">
                    {p._count.listings} listings
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel label="Active project">
          {org.projects.length === 0 ? (
            <p className="text-xs opacity-60">No project yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {org.projects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span>{p.name}</span>
                  <span className="text-[11px] opacity-60">
                    {p._count.tasks} tasks · {p.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel label="Recent leads">
          {recentLeads.length === 0 ? (
            <p className="text-xs opacity-60">No leads yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {recentLeads.map((l) => (
                <li key={l.id} className="py-2 flex items-baseline gap-3">
                  <span className="font-medium truncate min-w-0 flex-1">
                    {l.firstName || l.email || "Anonymous"}
                  </span>
                  <span className="text-[11px] opacity-60 whitespace-nowrap">
                    {l.source} · {l.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel label="Audit log">
          {recentAudits.length === 0 ? (
            <p className="text-xs opacity-60">No events yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {recentAudits.map((a) => (
                <li key={a.id} className="py-2 flex items-baseline gap-3">
                  <span className="text-[11px] opacity-60 whitespace-nowrap">
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                  <span className="flex-1 text-xs truncate">
                    {a.action}, {a.entityType}
                    {a.description ? `, ${a.description}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  );
}

function Panel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-md p-4">
      <p className="text-[10px] tracking-widest uppercase opacity-60 mb-3">
        {label}
      </p>
      {children}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-md p-3">
      <div className="text-[10px] tracking-widest uppercase opacity-60">
        {label}
      </div>
      <div className="font-serif text-xl font-bold mt-1 tabular-nums">
        {value}
      </div>
    </div>
  );
}
