// Server component — renders the OAuth connect button. Disabled with tooltip
// when OAuth is not yet enabled (no production domain configured). Once
// OAUTH_ENABLED=true and OAUTH_CALLBACK_BASE_URL is set, the button becomes
// active and starts the per-provider OAuth flow.

import { isOAuthEnabled } from "@/lib/integrations/oauth-config";
import type { OAuthProvider } from "@/lib/integrations/oauth-config";

const PROVIDER_LABEL: Record<OAuthProvider, string> = {
  "google-ads": "Google Ads",
  "meta-ads": "Meta Ads",
  gsc: "Google Search Console",
  ga4: "Google Analytics 4",
};

export function OAuthConnectButton({ provider }: { provider: OAuthProvider }) {
  const enabled = isOAuthEnabled();
  const label = PROVIDER_LABEL[provider];

  if (!enabled) {
    return (
      <div className="rounded-md border border-border bg-muted/20 px-3 py-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            Connect via {label} OAuth
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Available once a production domain is set on this workspace.
            Until then, paste credentials manually below.
          </p>
        </div>
        <button
          type="button"
          disabled
          className="text-xs px-3 py-1.5 border border-border rounded-md text-muted-foreground bg-card cursor-not-allowed disabled:opacity-40"
          title="OAuth disabled. Set OAUTH_ENABLED=true and OAUTH_CALLBACK_BASE_URL on Vercel."
        >
          OAuth disabled
        </button>
      </div>
    );
  }

  return (
    <a
      href={`/api/oauth/${provider}/start`}
      className="rounded-md border border-primary bg-primary text-primary-foreground px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-primary/90"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium">Connect via {label} OAuth</div>
        <p className="text-[11px] opacity-80 mt-0.5">
          Recommended. Tokens are stored encrypted and refreshed automatically.
        </p>
      </div>
      <span className="text-xs px-3 py-1.5 border border-background/30 rounded-md">
        Connect
      </span>
    </a>
  );
}
