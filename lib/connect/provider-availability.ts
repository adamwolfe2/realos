import "server-only";

// ---------------------------------------------------------------------------
// Provider availability
//
// Single source of truth for "can this org actually connect to <provider>
// right now?" — meaning the AGENCY (LeaseStack) has all the OAuth credentials
// and configuration in place. The Connect Hub uses this to gate the Connect
// button per source so operators don't click into a 503.
//
// Each entry returns:
//   available  — true when the user can complete the connection flow
//   reason     — human reason when unavailable (rendered in the disabled
//                state); null when available
//   eta        — optional short ETA string ("Coming soon" by default)
//
// AppFolio + Cursive pixel + website are AGENCY-CONFIG-INDEPENDENT in this
// sense — the operator brings their own credentials / installs their own
// snippet. Their availability is purely "can they take the action right now"
// (always true). OAuth providers (GA4, GSC, Google Ads, Meta Ads) require
// the master OAuth env vars to be set; without them every Connect click
// would route to a 503 disabled response.
// ---------------------------------------------------------------------------

import { isOAuthEnabled } from "@/lib/integrations/oauth-config";

export type ProviderId =
  | "appfolio"
  | "ga4"
  | "gsc"
  | "google_ads"
  | "meta_ads"
  | "cursive_pixel"
  | "website";

export type ProviderAvailability = {
  available: boolean;
  reason: string | null;
  eta: string | null;
};

export type AvailabilityMap = Record<ProviderId, ProviderAvailability>;

function googleOauthConfigured(): boolean {
  return (
    isOAuthEnabled() &&
    !!process.env.GOOGLE_OAUTH_CLIENT_ID &&
    !!process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
}

function metaOauthConfigured(): boolean {
  return (
    isOAuthEnabled() &&
    !!process.env.META_OAUTH_APP_ID &&
    !!process.env.META_OAUTH_APP_SECRET
  );
}

function googleAdsAdditionallyConfigured(): boolean {
  // Google Ads requires a separately-approved developer token on top of
  // standard OAuth. Without the token the OAuth flow succeeds but downstream
  // API calls 401. Gate the connect button accordingly.
  return !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
}

function metaAdsAdditionallyConfigured(): boolean {
  // Meta Marketing API Standard Access is required for cross-customer
  // ads_read / ads_management. We use the same env var the catalog uses
  // to surface the public Ad Library widget.
  return !!process.env.META_AD_LIBRARY_TOKEN;
}

export function getProviderAvailability(): AvailabilityMap {
  const googleReady = googleOauthConfigured();
  const metaReady = metaOauthConfigured();

  const googleNotReady: ProviderAvailability = {
    available: false,
    reason:
      "Your agency is completing Google OAuth setup. This source will become connectable within a few days.",
    eta: "Coming soon",
  };
  const metaNotReady: ProviderAvailability = {
    available: false,
    reason:
      "Your agency is completing Meta Business verification. This source will become connectable once Meta approves the agency app.",
    eta: "Coming soon",
  };

  return {
    appfolio: {
      // Bring-your-own-credentials — always available.
      available: true,
      reason: null,
      eta: null,
    },
    ga4: googleReady
      ? { available: true, reason: null, eta: null }
      : googleNotReady,
    gsc: googleReady
      ? { available: true, reason: null, eta: null }
      : googleNotReady,
    google_ads:
      googleReady && googleAdsAdditionallyConfigured()
        ? { available: true, reason: null, eta: null }
        : {
            available: false,
            reason: googleReady
              ? "Your agency is waiting on Google Ads developer-token approval. Once approved, this source becomes connectable."
              : "Your agency is completing Google OAuth setup, then awaiting Google Ads developer-token approval.",
            eta: "Coming soon",
          },
    meta_ads:
      metaReady && metaAdsAdditionallyConfigured()
        ? { available: true, reason: null, eta: null }
        : {
            available: false,
            reason: metaReady
              ? "Your agency is awaiting Meta Marketing API Standard Access approval. Once approved, this source becomes connectable."
              : "Your agency is completing Meta Business verification + Marketing API approval.",
            eta: "Coming soon",
          },
    cursive_pixel: {
      // Pixel request becomes a 3-5 min ops task (manual AudienceLab setup).
      // Operator-side action is always available; the request itself just
      // notifies ops to provision.
      available: true,
      reason: null,
      eta: null,
    },
    website: {
      available: true,
      reason: null,
      eta: null,
    },
  };
}
