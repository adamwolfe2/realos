import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductLine } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { getScope } from "@/lib/tenancy/scope";
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
          Audience Sync settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Connection details for this workspace. Set a personal AudienceLab key
          to override the platform default.
        </p>
      </header>

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
