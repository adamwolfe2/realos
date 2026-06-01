// Server component — renders the OAuth connect button. Per-provider
// readiness drives state: if the env vars for THIS provider are set,
// the button is live and routes to /api/oauth/<provider>/start. Otherwise
// renders a clear, provider-specific waiting message and a disabled
// button. No more global gate — Google flows can ship the day the
// Google Cloud client lands even if Meta is still pending.

import {
  isOAuthEnabled,
  isProviderConfigured,
  providerReadinessReason,
  providerToRouteSlug,
} from "@/lib/integrations/oauth-config";
import type { OAuthProvider } from "@/lib/integrations/oauth-config";

const PROVIDER_LABEL: Record<OAuthProvider, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  google_gsc: "Google Search Console",
  google_ga4: "Google Analytics 4",
};

export function OAuthConnectButton({ provider }: { provider: OAuthProvider }) {
  const label = PROVIDER_LABEL[provider];
  const globalDisabled = !isOAuthEnabled();
  const configured = isProviderConfigured(provider);

  if (globalDisabled || !configured) {
    const reason = globalDisabled
      ? "OAuth temporarily disabled by OAUTH_ENABLED=false."
      : (providerReadinessReason(provider) ?? "Provider not configured.");
    return (
      <div className="rounded-md border border-border bg-muted/20 px-3 py-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            Connect via {label} OAuth
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{reason}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Until then, paste credentials manually below.
          </p>
        </div>
        <button
          type="button"
          disabled
          className="text-xs px-3 py-1.5 border border-border rounded-md text-muted-foreground bg-card cursor-not-allowed disabled:opacity-40"
          title={reason}
        >
          Waiting
        </button>
      </div>
    );
  }

  return (
    <a
      href={`/api/oauth/${providerToRouteSlug(provider)}/start`}
      className="rounded-md border border-primary bg-primary text-primary-foreground px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-primary/90 transition-colors"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium">Connect via {label} OAuth</div>
        <p className="text-[11px] text-primary-foreground/80 mt-0.5">
          Recommended. Tokens are stored encrypted and refreshed automatically.
        </p>
      </div>
      <span className="text-xs px-3 py-1.5 border border-background/30 rounded-md">
        Connect
      </span>
    </a>
  );
}
