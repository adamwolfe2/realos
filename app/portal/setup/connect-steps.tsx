"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Copy, X } from "lucide-react";
import { Logo, Pill, type Tone } from "@/components/portal/overview/kit";
import { connectAppfolio } from "@/lib/actions/appfolio-connect";
import { connectSeo } from "@/lib/actions/seo-connect";
import { cn } from "@/lib/utils";

export type SourceId = "appfolio" | "ga4" | "gsc" | "google-ads" | "meta-ads";

export type SourceTile = {
  id: SourceId;
  name: string;
  line: string;
  state: "connected" | "error" | "off";
  stateText: string;
};

export type ManagedIds = {
  /** Our GA4/GSC service account, from GOOGLE_SERVICE_ACCOUNT_JSON. */
  googleEmail: string | null;
  /** Read-only OAuth sign-in is configured on this deploy. */
  googleAdsOAuth: boolean;
  metaAdsOAuth: boolean;
};

const LOGO: Record<SourceId, string> = { appfolio: "appfolio", ga4: "ga4", gsc: "gsc", "google-ads": "google-ads", "meta-ads": "meta-ads" };
const TONE: Record<SourceTile["state"], Tone> = { connected: "good", error: "bad", off: "neutral" };

const INPUT =
  "h-9 w-full rounded-[8px] border border-[var(--t-border)] bg-white px-3 text-[13.5px] text-[var(--t-ink)] placeholder:text-[var(--t-muted)] focus:border-[var(--t-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--t-accent)]/15";
const PRIMARY =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-[var(--t-primary-bg)] px-4 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-40";

/** Compact tiles; each opens a short numbered connect path in a side panel. */
export function ConnectSteps({ tiles, ids, propertyId, propertyName }: { tiles: SourceTile[]; ids: ManagedIds; propertyId: string | null; propertyName: string }) {
  const [open, setOpen] = useState<SourceId | null>(null);
  const tile = tiles.find((t) => t.id === open) ?? null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => setOpen(t.id)} className="group flex w-full items-center gap-3 rounded-[10px] border border-[var(--t-border)] bg-white px-3.5 py-3 text-left transition-colors hover:border-[#b9c7e6]">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-[var(--t-border)] bg-white"><Logo slug={LOGO[t.id]} size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13.5px] font-medium text-[var(--t-ink)]">{t.name}</span>
                  <Pill tone={TONE[t.state]}>{t.stateText}</Pill>
                </span>
                <span className="block truncate text-[12.5px] text-[var(--t-muted)]">{t.line}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--t-muted)] transition-transform group-hover:translate-x-0.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      {tile ? (
        <div role="dialog" aria-label={`Connect ${tile.name}`} className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[460px] flex-col border-l border-[var(--t-border)] bg-white shadow-[-24px_0_48px_-24px_rgba(11,21,48,0.25)]">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--t-divider)] px-5">
            <Logo slug={LOGO[tile.id]} size={18} />
            <h2 className="flex-1 text-[15px] font-semibold text-[var(--t-ink)]">{tile.name}</h2>
            <Pill tone={TONE[tile.state]}>{tile.stateText}</Pill>
            <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-[var(--t-muted)] hover:bg-[var(--t-wash)] hover:text-[var(--t-ink)]">
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {tile.id === "appfolio" ? <AppfolioPath /> : null}
            {tile.id === "ga4" ? <GooglePath kind="GA4" email={ids.googleEmail} propertyId={propertyId} /> : null}
            {tile.id === "gsc" ? <GooglePath kind="GSC" email={ids.googleEmail} propertyId={propertyId} /> : null}
            {tile.id === "google-ads" ? <AdsPath platform="google" available={ids.googleAdsOAuth} propertyId={propertyId} connected={tile.state === "connected"} /> : null}
            {tile.id === "meta-ads" ? <AdsPath platform="meta" available={ids.metaAdsOAuth} propertyId={propertyId} connected={tile.state === "connected"} /> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="space-y-5">{children}</ol>;
}

function Step({ n, title, children }: { n: number; title: string; children?: ReactNode }) {
  return (
    <li className="grid grid-cols-[24px_1fr] gap-3">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--t-wash)] text-[12px] font-semibold tabular-nums text-[var(--t-text)]">{n}</span>
      <div className="min-w-0 space-y-2 pt-0.5">
        <p className="text-[13.5px] font-medium text-[var(--t-ink)]">{title}</p>
        {children}
      </div>
    </li>
  );
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }, (err) => console.error("[setup] copy failed", err))}
      className="flex w-full items-center justify-between gap-3 rounded-[8px] border border-[var(--t-border)] bg-[#f7f9fd] px-3 py-2 text-left font-mono text-[12.5px] text-[var(--t-ink)] hover:border-[var(--t-accent)]"
    >
      <span className="min-w-0 truncate">{value}</span>
      <span className="flex shrink-0 items-center gap-1 font-sans text-[12px] text-[var(--t-accent)]">
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] leading-relaxed text-[var(--t-muted)]">{children}</p>;
}

function Result({ ok, text }: { ok: boolean; text: string }) {
  return <p className={cn("rounded-[8px] px-3 py-2 text-[12.5px]", ok ? "bg-[#effaf3] text-[#15803d]" : "bg-[#fdf2f2] text-[#b91c1c]")}>{text}</p>;
}

function AppfolioPath() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"embed" | "rest">("embed");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("authMode", mode);
    start(async () => {
      const r = await connectAppfolio(fd);
      setResult(r.ok ? { ok: true, text: r.listingsFound != null ? `Connected. Found ${r.listingsFound} listings.` : "Connected." } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  }
  return (
    <form onSubmit={submit}>
      <Steps>
        <Step n={1} title="Your AppFolio address">
          <span className="flex items-center gap-2">
            <input name="subdomain" required placeholder="yourcompany" className={INPUT} />
            <span className="shrink-0 text-[13px] text-[var(--t-muted)]">.appfolio.com</span>
          </span>
          <Muted>The part before .appfolio.com when you sign in.</Muted>
        </Step>
        <Step n={2} title="Leases and residents too? (optional)">
          {mode === "embed" ? (
            <>
              <Muted>Step 1 alone syncs your public listings. For leases, residents and applications, add your Reports API keys.</Muted>
              <button type="button" onClick={() => setMode("rest")} className="text-[12.5px] font-medium text-[var(--t-accent)] hover:underline">Add Reports API keys</button>
            </>
          ) : (
            <>
              <Muted>In AppFolio: Settings, then Reports API, then create a client ID and secret. Paste both here.</Muted>
              <input name="clientId" required placeholder="Client ID" className={INPUT} />
              <input name="clientSecret" required type="password" placeholder="Client secret" className={INPUT} />
              <button type="button" onClick={() => setMode("embed")} className="text-[12.5px] text-[var(--t-muted)] hover:text-[var(--t-ink)]">Listings only for now</button>
            </>
          )}
        </Step>
        <Step n={3} title="Connect">
          <button type="submit" disabled={pending} className={PRIMARY}>{pending ? "Checking..." : "Connect AppFolio"}</button>
          {result ? <Result {...result} /> : null}
        </Step>
      </Steps>
    </form>
  );
}

function GooglePath({ kind, email, propertyId }: { kind: "GA4" | "GSC"; email: string | null; propertyId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const ga4 = kind === "GA4";
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("provider", kind);
    if (propertyId) fd.set("leasestackPropertyId", propertyId);
    start(async () => {
      const r = await connectSeo(fd);
      setResult(r.ok ? { ok: true, text: "Access confirmed. Data starts syncing today." } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  }
  if (!email) return <Muted>Google access is being set up on our side. Your LeaseStack contact will let you know when this opens.</Muted>;
  return (
    <form onSubmit={submit}>
      <Steps>
        <Step n={1} title="Copy our access email">
          <CopyValue value={email} />
          <Muted>Read-only. We never change anything in your Google account.</Muted>
        </Step>
        <Step n={2} title={ga4 ? "Add it in Google Analytics" : "Add it in Search Console"}>
          <Muted>
            {ga4
              ? "Admin, then Property access management, then the + button. Paste the email and choose Viewer."
              : "Settings, then Users and permissions, then Add user. Paste the email and choose Restricted."}
          </Muted>
          <a href={ga4 ? "https://analytics.google.com/analytics/web/" : "https://search.google.com/search-console/users"} target="_blank" rel="noreferrer" className="inline-block text-[12.5px] font-medium text-[var(--t-accent)] hover:underline">
            Open {ga4 ? "Google Analytics" : "Search Console"}
          </a>
        </Step>
        <Step n={3} title={ga4 ? "Your GA4 property ID" : "Your site in Search Console"}>
          <input name="propertyIdentifier" required placeholder={ga4 ? "123456789" : "sc-domain:yoursite.com"} className={INPUT} />
          <Muted>{ga4 ? "Admin, then Property details. The number in the top right." : "Exactly as it appears in the Search Console property picker."}</Muted>
        </Step>
        <Step n={4} title="Check access">
          <button type="submit" disabled={pending} className={PRIMARY}>{pending ? "Checking..." : "Done, check access"}</button>
          {result ? <Result {...result} /> : null}
        </Step>
      </Steps>
    </form>
  );
}

// Read-only by design: the customer signs in with their own Google or Meta
// login and picks an ad account. We only read campaigns, spend, results and
// ads; we never create, change or pause anything (Adam, 2026-10-29). Meta
// asks for ads_read only. Spec: plans/ads-read-only/slice-plan.md.
const ADS = {
  google: {
    name: "Google",
    start: "/api/oauth/google-ads/start",
    access: "Use the Google login that can see your Google Ads account. Google's screen lists its standard Ads permission because Google has no read-only option; we still only read.",
  },
  meta: {
    name: "Facebook",
    start: "/api/oauth/meta-ads/start",
    access: "Use the Facebook login that has access to your ad account in Business settings.",
  },
} as const;

function AdsPath({ platform, available, propertyId, connected }: { platform: keyof typeof ADS; available: boolean; propertyId: string | null; connected: boolean }) {
  const p = ADS[platform];
  if (!available) return <Muted>Ad account sign-in is being set up on our side. Your LeaseStack contact will let you know when this opens.</Muted>;
  const qs = new URLSearchParams({ returnTo: "/portal/setup", ...(propertyId ? { propertyId } : {}) });
  return (
    <Steps>
      <Step n={1} title={`Sign in with ${p.name}`}>
        <Muted>We only read. We pull your campaigns, spend, results and ad creatives so you can see what's working. We never create, change or pause your ads, and you can disconnect any time.</Muted>
        <Muted>{p.access} An account owner or admin in LeaseStack needs to do this.</Muted>
        <a href={`${p.start}?${qs.toString()}`} className={PRIMARY}>{connected ? "Reconnect" : `Sign in with ${p.name}`}</a>
      </Step>
      <Step n={2} title="Pick your ad account">
        <Muted>After you sign in, choose the ad account for this property. Your results show up on the Ads page within a few minutes, with the last 30 days filled in.</Muted>
      </Step>
    </Steps>
  );
}
