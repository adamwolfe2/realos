import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProductLine } from "@prisma/client";
import { getScope } from "@/lib/tenancy/scope";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { ArrowLeft } from "lucide-react";
import { DestinationsManager } from "@/components/audiences/destinations-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Destinations" };

export default async function DestinationsPage() {
  const scope = await getScope();
  if (!scope) redirect("/sign-in");
  if (scope.productLine !== ProductLine.AUDIENCE_SYNC && !scope.isAlPartner) {
    redirect("/portal");
  }

  const [destinations, adAccounts, segments] = await Promise.all([
    prisma.audienceDestination.findMany({
      where: { orgId: scope.orgId },
      orderBy: { createdAt: "desc" },
      include: {
        adAccount: { select: { displayName: true, platform: true } },
      },
    }),
    prisma.adAccount.findMany({
      where: { orgId: scope.orgId, accessStatus: "active" },
      select: {
        id: true,
        platform: true,
        displayName: true,
        externalAccountId: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.audienceSegment.findMany({
      where: { orgId: scope.orgId, visible: true },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        memberCount: true,
      },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/portal/audiences"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to segments
        </Link>
      </div>

      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          Sync destinations
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Where your audience segments get sent. CSV and webhooks are live
          today; Meta Custom Audiences and Google Customer Match light up once
          OAuth is wired.
        </p>
      </header>

      <DashboardSection
        eyebrow="Connected"
        title="Destinations"
        description="Reusable push targets across all your segments"
      >
        <DestinationsManager
          destinations={destinations.map((d) => ({
            id: d.id,
            name: d.name,
            type: d.type,
            enabled: d.enabled,
            webhookUrl: d.webhookUrl,
            adAccountLabel: d.adAccount
              ? `${d.adAccount.displayName ?? "Ad account"} (${d.adAccount.platform})`
              : null,
            createdAt: d.createdAt.toISOString(),
            lastUsedAt: d.lastUsedAt?.toISOString() ?? null,
          }))}
          adAccounts={adAccounts.map((a) => ({
            id: a.id,
            label: `${a.displayName ?? a.externalAccountId} — ${a.platform}`,
          }))}
          segments={segments.map((s) => ({
            id: s.id,
            name: s.name,
            memberCount: s.memberCount,
          }))}
        />
      </DashboardSection>

      <DashboardSection
        eyebrow="Integration"
        title="Webhook contract"
        description="JSON payload format for webhook destinations"
      >
        <p className="text-xs text-muted-foreground">
          Webhook destinations receive a signed POST whenever you push a
          segment. The body is JSON; the{" "}
          <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">
            x-leasestack-signature
          </code>{" "}
          header is an HMAC-SHA256 of the body using your destination secret.
          Verify it before processing.
        </p>
        <pre className="mt-3 text-[11px] bg-muted/50 p-3 rounded-md overflow-x-auto font-mono leading-relaxed">
          {`{
  "event": "audience.sync",
  "sentAt": "2026-04-28T18:30:00.000Z",
  "segment": { "id": "...", "alSegmentId": "...", "name": "..." },
  "members": [
    {
      "email": "person@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "phone": "+15555550100",
      "city": "Berkeley",
      "state": "CA",
      "postalCode": "94704",
      "country": "US",
      "profileId": "...",
      "uid": "...",
      "hemSha256": "..."
    }
  ]
}`}
        </pre>
      </DashboardSection>
    </div>
  );
}
