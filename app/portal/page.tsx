import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

// TODO(Sprint 05): full client portal dashboard (lead counts, chatbot
// conversations, property rollup, billing status, recent creative requests).
export default async function PortalHome() {
  const scope = await requireScope();

  const [leadCount, propertyCount, visitorCount, conversationCount] =
    await Promise.all([
      prisma.lead.count({ where: tenantWhere(scope) }),
      prisma.property.count({ where: tenantWhere(scope) }),
      prisma.visitor.count({ where: tenantWhere(scope) }),
      prisma.chatbotConversation.count({ where: tenantWhere(scope) }),
    ]);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-serif text-3xl font-bold mb-8">Portal dashboard</h1>
      <p className="opacity-70 mb-8 text-sm">
        Sprint 05 rebuilds this screen with live lead pipeline, chatbot
        conversations, property performance, and billing status. For now,
        here are the raw row counts for your tenant.
      </p>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Leads" value={leadCount} />
        <Stat label="Properties" value={propertyCount} />
        <Stat label="Pixel visitors" value={visitorCount} />
        <Stat label="Chatbot conversations" value={conversationCount} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-shell p-4">
      <dt className="text-xs tracking-widest uppercase opacity-60">{label}</dt>
      <dd className="font-serif text-3xl font-bold mt-2">{value}</dd>
    </div>
  );
}
