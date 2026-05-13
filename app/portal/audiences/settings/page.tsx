import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductLine } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { getScope } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { ApiKeySettings } from "@/components/audiences/api-key-settings";
import { getOrgAlApiKeyStatus } from "@/lib/actions/audiences";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audience Sync settings" };

export default async function AudienceSyncSettingsPage() {
  const scope = await getScope();
  if (!scope) redirect("/sign-in");
  if (scope.productLine !== ProductLine.AUDIENCE_SYNC && !scope.isAlPartner) {
    redirect("/portal");
  }

  const status = await getOrgAlApiKeyStatus();

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={
          <Link
            href="/portal/audiences"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to segments
          </Link>
        }
        title="Audience Sync settings"
        description="Connection details for this workspace. Set a personal AudienceLab key to override the platform default."
      />

      <DashboardSection
        eyebrow="AudienceLab connection"
        title="Data source"
        description="Use a personal AudienceLab API key for this org instead of the platform default. The key is encrypted at rest and only the last 4 characters are ever displayed."
      >
        <ApiKeySettings
          hasOverride={status.hasOverride}
          keyHint={status.keyHint}
          inheritedFromPlatform={status.inheritedFromPlatform}
        />
      </DashboardSection>
    </div>
  );
}
