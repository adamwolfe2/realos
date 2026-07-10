import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireScope } from "@/lib/tenancy/scope";
import { getOAuthCredentials } from "@/lib/integrations/oauth-credentials";
import {
  listMetaAdAccounts,
  type AccessibleMetaAdAccount,
} from "@/lib/integrations/meta-ads";
import { PageHeader } from "@/components/admin/page-header";
import { ConnectStepper } from "@/components/portal/connect/account-picker-list";
import { AdAccountPicker } from "./account-picker";

export const metadata: Metadata = { title: "Choose a Meta ad account" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/connect/meta-ads/select
//
// Meta equivalent of /portal/connect/google-ads/select. Lists every Meta
// ad account the OAuth token can reach via GET /me/adaccounts.
// ---------------------------------------------------------------------------
export default async function MetaAdsSelectPage() {
  const scope = await requireScope();

  const oauth = await getOAuthCredentials(scope.orgId, "meta_ads");
  if (!oauth) {
    // Wave-1 spine: bounce to the canonical connect hub, not the settings
    // drawer, when the consent step never completed.
    redirect("/portal/connect?oauth=meta_ads_missing");
  }

  let accounts: AccessibleMetaAdAccount[] = [];
  let listError: string | null = null;

  try {
    accounts = await listMetaAdAccounts({
      systemUserAccessToken: oauth.accessToken,
    });
  } catch (err) {
    listError =
      err instanceof Error ? err.message : "Unable to load Meta ad accounts.";
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Choose a Meta ad account"
        description="These are the ad accounts your Meta login can reach. Pick the one you want LeaseStack to sync. You can connect more later."
        actions={
          <Link
            href="/portal/connect"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
        }
      />

      {listError ? (
        <>
          <ConnectStepper current={2} />
          <div className="rounded-[2px] border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">
            Couldn&apos;t load your Meta ad accounts.
          </p>
          <p className="text-xs text-destructive/80 mt-1 leading-relaxed">
            {listError}
          </p>
          <Link
            href="/api/oauth/meta-ads/start"
            className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
          >
            Re-authorize with Meta
          </Link>
          </div>
        </>
      ) : accounts.length === 0 ? (
        <>
          <ConnectStepper current={2} />
          <div className="rounded-[2px] border border-border bg-muted/20 p-5 space-y-2">
          <p className="text-sm font-medium text-foreground">
            No accessible Meta ad accounts.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The Meta account you used to sign in doesn&apos;t have access to
            any ad accounts. Open{" "}
            <a
              href="https://business.facebook.com/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Meta Business Settings
            </a>{" "}
            → People → assign yourself an ad account, then come back and
            re-authorize.
          </p>
          <Link
            href="/api/oauth/meta-ads/start"
            className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
          >
            Re-authorize with Meta
          </Link>
          </div>
        </>
      ) : (
        // Stepper for the happy path renders inside AdAccountPicker so it
        // can advance to step 3 (Verify) on bind success.
        <AdAccountPicker accounts={accounts} />
      )}
    </div>
  );
}
