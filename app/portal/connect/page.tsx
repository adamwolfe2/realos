import type { Metadata } from "next";
import { requireScope } from "@/lib/tenancy/scope";
import { getConnectStatusForOrg } from "@/lib/connect/status";
import { ConnectHub } from "@/components/portal/connect/connect-hub";

export const metadata: Metadata = {
  title: "Connect your data · LeaseStack",
  description:
    "Plug in AppFolio, Google Analytics, Search Console, Google Ads, Meta Ads, and your website. Insights flow within minutes of your first connection.",
};
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/connect — the unified data-connection hub.
//
// Always reachable from the nav. Shows every data source as a card with
// connection status + a single CTA. Each newly-connected source kicks off
// background sync immediately and triggers the insight detectors as soon
// as data lands (see lib/insights/triggers.ts).
// ---------------------------------------------------------------------------

export default async function ConnectPage() {
  const scope = await requireScope();
  const sources = await getConnectStatusForOrg(scope.orgId);

  return (
    <div className="max-w-[1100px] mx-auto px-4 lg:px-6 py-8 lg:py-12">
      <ConnectHub
        variant="page"
        sources={sources.map((s) => ({
          id: s.id,
          connected: s.connected,
          lastSyncAt: s.lastSyncAt ? s.lastSyncAt.toISOString() : null,
          accountLabel: s.accountLabel,
        }))}
      />
    </div>
  );
}
