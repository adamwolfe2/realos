// ---------------------------------------------------------------------------
// Google Ads connector smoke test.
//
// What this validates (without touching real client data):
//   1. The developer token is present in env.
//   2. OAuth credentials (client_id + secret + refresh_token) exchange
//      successfully for an access token.
//   3. The Google Ads REST endpoint accepts the developer token header.
//   4. The customer query returns a row for the supplied customer ID.
//
// Required env (or CLI args):
//   GOOGLE_ADS_DEVELOPER_TOKEN          — required
//   GOOGLE_ADS_OAUTH_CLIENT_ID          — required for live API call
//   GOOGLE_ADS_OAUTH_CLIENT_SECRET      — required for live API call
//   GOOGLE_ADS_REFRESH_TOKEN            — required for live API call
//   GOOGLE_ADS_LOGIN_CUSTOMER_ID        — optional (the MCC)
//   GOOGLE_ADS_TEST_CUSTOMER_ID         — required for live API call (test
//                                          customer account on the MCC)
//
// With ONLY the developer token set, the script runs in "preflight" mode:
// it confirms env wiring and prints the next steps to unlock the live test.
//
// Run with:
//   pnpm tsx scripts/smoke-google-ads.ts
// ---------------------------------------------------------------------------

// Load both, with .env.local taking precedence (Next.js convention).
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

import {
  testGoogleAdsConnection,
  type GoogleAdsCredentials,
} from "../lib/integrations/google-ads";

function header(text: string): void {
  console.log("\n" + "─".repeat(64));
  console.log(text);
  console.log("─".repeat(64));
}

function status(label: string, ok: boolean, detail?: string): void {
  const mark = ok ? "✓" : "✗";
  const line = `  ${mark} ${label}${detail ? "  — " + detail : ""}`;
  console.log(line);
}

async function main(): Promise<void> {
  header("Google Ads connector — smoke test");

  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
  const oauthClientId = process.env.GOOGLE_ADS_OAUTH_CLIENT_ID ?? "";
  const oauthClientSecret = process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET ?? "";
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN ?? "";
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "";
  const testCustomerId = process.env.GOOGLE_ADS_TEST_CUSTOMER_ID ?? "";

  status("GOOGLE_ADS_DEVELOPER_TOKEN", Boolean(developerToken));
  status("GOOGLE_ADS_OAUTH_CLIENT_ID", Boolean(oauthClientId));
  status("GOOGLE_ADS_OAUTH_CLIENT_SECRET", Boolean(oauthClientSecret));
  status("GOOGLE_ADS_REFRESH_TOKEN", Boolean(refreshToken));
  status(
    "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
    Boolean(loginCustomerId),
    loginCustomerId ? "(optional, set)" : "(optional, unset)"
  );
  status("GOOGLE_ADS_TEST_CUSTOMER_ID", Boolean(testCustomerId));

  const ready =
    developerToken &&
    oauthClientId &&
    oauthClientSecret &&
    refreshToken &&
    testCustomerId;

  if (!ready) {
    header("Preflight only — live API call skipped");
    console.log("");
    console.log("To unlock the live call, complete these steps in order:");
    console.log("");
    console.log("  1. Google Cloud Console → APIs & Services → Library →");
    console.log("     enable Google Ads API on the same project that holds");
    console.log("     your developer token.");
    console.log("");
    console.log("  2. Same project → Credentials → Create Credentials →");
    console.log("     OAuth client ID → Web application. Add");
    console.log("     https://developers.google.com/oauthplayground as an");
    console.log("     authorized redirect URI (for now).");
    console.log("     Copy client_id and client_secret into .env.local:");
    console.log("       GOOGLE_ADS_OAUTH_CLIENT_ID=");
    console.log("       GOOGLE_ADS_OAUTH_CLIENT_SECRET=");
    console.log("");
    console.log("  3. Visit https://developers.google.com/oauthplayground");
    console.log("     → gear icon → 'Use your own OAuth credentials' →");
    console.log("     paste client_id + secret.");
    console.log("     Scope (paste in custom box):");
    console.log("       https://www.googleapis.com/auth/adwords");
    console.log("     → Authorize → log in as the user that owns the MCC");
    console.log("     → Exchange authorization code for tokens →");
    console.log("     copy the refresh_token into .env.local:");
    console.log("       GOOGLE_ADS_REFRESH_TOKEN=");
    console.log("");
    console.log("  4. ads.google.com (logged in as the MCC owner) →");
    console.log("     top-right account picker → Create new account →");
    console.log("     check 'Test account'. Note the customer ID.");
    console.log("     Put it (digits only, no dashes) in .env.local:");
    console.log("       GOOGLE_ADS_TEST_CUSTOMER_ID=");
    console.log("     And the MCC ID:");
    console.log("       GOOGLE_ADS_LOGIN_CUSTOMER_ID=");
    console.log("");
    console.log("  5. pnpm tsx scripts/smoke-google-ads.ts");
    console.log("");
    process.exit(ready ? 0 : 1);
  }

  header("Calling Google Ads REST: customer.id, descriptive_name, currency");

  const credentials: GoogleAdsCredentials = {
    developerToken,
    oauthClientId,
    oauthClientSecret,
    refreshToken,
    loginCustomerId: loginCustomerId || null,
  };

  const result = await testGoogleAdsConnection(credentials, testCustomerId);

  if (result.ok) {
    console.log("");
    console.log(
      `  ✓ Live call succeeded. Currency: ${result.currency ?? "unknown"}`
    );
    console.log("");
    console.log(
      "  Auth chain validated end-to-end. The connector is wired correctly."
    );
    console.log(
      "  Once Basic Access is granted, real client refresh tokens will work."
    );
    process.exit(0);
  } else {
    console.log("");
    console.log(`  ✗ Live call failed: ${result.error}`);
    console.log("");
    if (result.error.includes("DEVELOPER_TOKEN_NOT_APPROVED")) {
      console.log(
        "  Expected if you're on a Test token and the customer ID is NOT a"
      );
      console.log(
        "  test account. Confirm the customer is flagged as 'Test account'"
      );
      console.log("  in the MCC.");
    } else if (result.error.includes("PERMISSION_DENIED")) {
      console.log(
        "  Test token cannot query non-test accounts. Verify"
      );
      console.log(
        "  GOOGLE_ADS_TEST_CUSTOMER_ID points at a test account."
      );
    } else if (result.error.includes("invalid_grant")) {
      console.log(
        "  Refresh token rejected. Most common cause: token generated"
      );
      console.log(
        "  for a different OAuth client. Re-mint in OAuth Playground"
      );
      console.log("  with the client_id/secret currently in .env.local.");
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n  ✗ Unhandled error:", err);
  process.exit(1);
});
