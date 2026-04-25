// Client-side analytics helper for the tenant chatbot widget. Pushes to
// window.dataLayer (GTM) and falls back to window.gtag (GA4 direct) so the
// tenant can wire either instrumentation on their own site. No-op on the
// server or when neither is present.

type DataLayerEntry = Record<string, unknown>;

function getDataLayer(): Array<DataLayerEntry> | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { dataLayer?: Array<DataLayerEntry> };
  if (!Array.isArray(w.dataLayer)) return null;
  return w.dataLayer;
}

function getGtag():
  | ((command: string, event: string, params?: DataLayerEntry) => void)
  | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    gtag?: (
      command: string,
      event: string,
      params?: DataLayerEntry
    ) => void;
  };
  return typeof w.gtag === "function" ? w.gtag : null;
}

export function track(event: string, params: DataLayerEntry = {}): void {
  const dl = getDataLayer();
  if (dl) {
    dl.push({ event, ...params });
    return;
  }
  const gtag = getGtag();
  if (gtag) {
    gtag("event", event, params);
  }
}

export function trackChatbotOpened(source: "button" | "bubble"): void {
  track("chatbot_opened", { source });
}

export function trackChatbotLeadCaptured(params: {
  orgId?: string;
  via: "form" | "regex";
}): void {
  track("chatbot_lead_captured", params);
}
