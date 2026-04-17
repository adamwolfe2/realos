import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { AddNoteForm } from "./add-note-form";
import { LeadStatusForm } from "./lead-status-form";

export const metadata: Metadata = { title: "Lead detail" };
export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const scope = await requireScope();
  const { id } = await params;

  const lead = await prisma.lead.findFirst({
    where: { id, ...tenantWhere(scope) },
    include: {
      property: { select: { id: true, name: true } },
      tours: { orderBy: { scheduledAt: "desc" } },
      applications: { orderBy: { createdAt: "desc" } },
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        take: 5,
      },
      visitor: true,
    },
  });
  if (!lead) notFound();

  const notes = await prisma.clientNote.findMany({
    where: {
      orgId: scope.orgId,
      noteType: "LEAD_INTERACTION",
      body: { contains: lead.id },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const displayName =
    [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
    lead.email ||
    "Anonymous lead";

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/portal/leads" className="text-xs opacity-60 hover:opacity-100">
            ← Leads
          </Link>
          <h1 className="font-serif text-3xl font-bold mt-2">{displayName}</h1>
          <p className="text-sm opacity-70 mt-1">
            {lead.email ?? "No email"} ·{" "}
            {lead.phone ?? "No phone"}
          </p>
          <p className="text-xs opacity-60 mt-1">
            {lead.source}
            {lead.sourceDetail ? `, ${lead.sourceDetail}` : ""} ·{" "}
            {lead.property ? lead.property.name : "No property"}
            {lead.intent ? ` · ${lead.intent} intent` : ""}
          </p>
        </div>
        <LeadStatusForm
          leadId={lead.id}
          initialStatus={lead.status}
          score={lead.score}
        />
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel label="Preferences">
          <Row
            k="Move-in"
            v={
              lead.desiredMoveIn
                ? new Date(lead.desiredMoveIn).toLocaleDateString()
                : "—"
            }
          />
          <Row
            k="Budget"
            v={
              lead.budgetMinCents || lead.budgetMaxCents
                ? `${centsToUsd(lead.budgetMinCents)}–${centsToUsd(
                    lead.budgetMaxCents
                  )}`
                : "—"
            }
          />
          <Row
            k="Preferred unit"
            v={lead.preferredUnitType ?? "—"}
          />
          <Row
            k="First seen"
            v={new Date(lead.firstSeenAt).toLocaleString()}
          />
          <Row
            k="Last activity"
            v={new Date(lead.lastActivityAt).toLocaleString()}
          />
        </Panel>

        <Panel label="Tours">
          {lead.tours.length === 0 ? (
            <p className="text-xs opacity-60">No tours scheduled yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {lead.tours.map((t) => (
                <li key={t.id} className="py-2 flex items-baseline justify-between">
                  <span>
                    {t.tourType ?? "in_person"}
                    {t.scheduledAt
                      ? ` · ${new Date(t.scheduledAt).toLocaleString()}`
                      : ""}
                  </span>
                  <span className="text-[11px] opacity-60">{t.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel label="Applications">
          {lead.applications.length === 0 ? (
            <p className="text-xs opacity-60">No applications yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {lead.applications.map((a) => (
                <li key={a.id} className="py-2 flex items-baseline justify-between">
                  <span>
                    {a.status}
                    {a.appliedAt
                      ? ` · Applied ${new Date(a.appliedAt).toLocaleDateString()}`
                      : ""}
                  </span>
                  <span className="text-[11px] opacity-60">
                    {a.decidedAt
                      ? new Date(a.decidedAt).toLocaleDateString()
                      : "Pending"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel label="Chatbot conversations">
          {lead.conversations.length === 0 ? (
            <p className="text-xs opacity-60">No chatbot conversations.</p>
          ) : (
            <ul className="divide-y text-sm">
              {lead.conversations.map((c) => (
                <li key={c.id} className="py-2 flex items-baseline justify-between">
                  <span>
                    {c.messageCount} messages · {c.status}
                  </span>
                  <span className="text-[11px] opacity-60">
                    {new Date(c.lastMessageAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      <section>
        <h2 className="font-serif text-xl font-bold mb-3">Notes</h2>
        <AddNoteForm leadId={lead.id} />
        {notes.length === 0 ? (
          <p className="text-sm opacity-60 mt-4">
            No notes yet. Log interactions here so every teammate stays in
            sync.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="border rounded-md p-3 text-sm">
                <p className="whitespace-pre-wrap">{n.body}</p>
                <p className="text-[11px] opacity-60 mt-2">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function centsToUsd(c: number | null | undefined): string {
  if (c == null) return "—";
  return `$${Math.round(c / 100).toLocaleString()}`;
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-xs opacity-60">{k}</dt>
      <dd className="text-right truncate">{v}</dd>
    </div>
  );
}
