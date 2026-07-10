import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireScope } from "@/lib/tenancy/scope";
import { getOAuthCredentials } from "@/lib/integrations/oauth-credentials";
import {
  listAccessibleCustomers,
  type GoogleAdsCredentials,
  type AccessibleCustomer,
} from "@/lib/integrations/google-ads";
import { PageHeader } from "@/components/admin/page-header";
import { ConnectStepper } from "@/components/portal/connect/account-picker-list";
import { CustomerPicker } from "./customer-picker";

export const metadata: Metadata = { title: "Choose a Google Ads account" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/connect/google-ads/select
//
// Post-OAuth landing page. Operator just OAuthed via Google; their refresh
// token is on file. This page calls listAccessibleCustomers (which probes
// the Google Ads API for everything the token can reach) and renders a
// picker. Choosing one binds the customer to their AdAccount + kicks an
// initial backfill.
//
// Edge cases handled inline:
//   - No active OAuth row → bounce back to integrations page to re-OAuth
//   - listAccessibleCustomers throws → show the error inline; let operator
//     re-OAuth (often the dev token isn't approved for their access yet)
//   - Empty list → show a "no accessible accounts" empty state with copy
//     that explains the access-sharing path
// ---------------------------------------------------------------------------
export default async function GoogleAdsSelectPage() {
  const scope = await requireScope();

  const oauth = await getOAuthCredentials(scope.orgId, "google_ads");
  if (!oauth || !oauth.refreshToken) {
    // No OAuth on file — they didn't actually complete the consent step,
    // or the row was revoked. Bounce them back to the canonical connect
    // hub where the Connect button lives (Wave-1 spine: /portal/connect,
    // not the settings drawer).
    redirect("/portal/connect?oauth=google_ads_missing");
  }

  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const oauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const oauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  let customers: AccessibleCustomer[] = [];
  let listError: string | null = null;

  if (!developerToken || !oauthClientId || !oauthClientSecret) {
    listError =
      "Server is missing required Google Ads credentials. Contact your LeaseStack admin.";
  } else {
    const creds: GoogleAdsCredentials = {
      developerToken,
      loginCustomerId: null,
      refreshToken: oauth.refreshToken,
      oauthClientId,
      oauthClientSecret,
    };
    try {
      customers = await listAccessibleCustomers(creds);
    } catch (err) {
      listError =
        err instanceof Error ? err.message : "Unable to load Google Ads accounts.";
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Choose a Google Ads account"
        description="These are the accounts your Google login can reach. Pick the one you want LeaseStack to sync. You can connect more later."
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
            Couldn&apos;t load your Google Ads accounts.
          </p>
          <p className="text-xs text-destructive/80 mt-1 leading-relaxed">
            {listError}
          </p>
          <Link
            href="/api/oauth/google-ads/start"
            className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
          >
            Re-authorize with Google
          </Link>
          </div>
        </>
      ) : customers.length === 0 ? (
        <>
          <ConnectStepper current={2} />
          <div className="rounded-[2px] border border-border bg-muted/20 p-5 space-y-2">
          <p className="text-sm font-medium text-foreground">
            No accessible Google Ads accounts.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The Google account you used to sign in doesn&apos;t have access to
            any Google Ads customer accounts. Two ways to fix this:
          </p>
          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 leading-relaxed">
            <li>
              In Google Ads (
              <a
                href="https://ads.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                ads.google.com
              </a>
              ) → Tools &amp; Settings → Access &amp; Security → invite the
              email you just used as a Standard or Admin user. Then come back
              and re-authorize.
            </li>
            <li>
              Or sign out, then re-authorize using a different Google account
              that already has access to your Google Ads account.
            </li>
          </ul>
          <Link
            href="/api/oauth/google-ads/start"
            className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
          >
            Re-authorize with Google
          </Link>
          </div>
        </>
      ) : (
        // Stepper for the happy path renders inside CustomerPicker so it can
        // advance to step 3 (Verify) on bind success.
        <CustomerPicker customers={customers} />
      )}
    </div>
  );
}
