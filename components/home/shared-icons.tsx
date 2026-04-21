import {
  MetaMark, GoogleMark, TikTokMark, SlackMark, CalcomMark, ResendMark,
  GA4Mark, AppFolioMark, ChatGPTMark, PerplexityMark, ClaudeMark,
  GeminiMark, LinkedInMark, VercelMark, FigmaMark,
} from "@/components/platform/artifacts/brand-logos";

export type Deliverable = {
  key: string;
  title: string;
  body: string;
  icon: "home" | "chat" | "pixel" | "ads" | "search" | "mail" | "report" | "cal";
  logos?: { brand: "meta" | "google" | "tiktok" | "slack" | "resend" | "cal" | "ga" | "appfolio" | "chatgpt" | "perplexity" | "claude" | "gemini" | "linkedin" | "vercel" | "figma" }[];
  big?: boolean;
};

export type DeliverableIconKind = Deliverable["icon"];
export type DeliverableBrand = NonNullable<Deliverable["logos"]>[number]["brand"];

export function DeliverableIcon({ kind }: { kind: DeliverableIconKind }) {
  const p = { width: 16, height: 16, viewBox: "0 0 14 14", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (kind) {
    case "home":   return <svg {...p}><path d="M2 7L7 3L12 7V12H8V9H6V12H2V7Z" /></svg>;
    case "chat":   return <svg {...p}><path d="M2 3H12V9H5L2 11V3Z" /></svg>;
    case "pixel":  return <svg {...p}><circle cx="7" cy="7" r="4"/><circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none"/></svg>;
    case "ads":    return <svg {...p}><path d="M2 5H5L9 2V12L5 9H2V5Z" /></svg>;
    case "search": return <svg {...p}><circle cx="6" cy="6" r="3.5"/><path d="M9 9l3 3"/></svg>;
    case "mail":   return <svg {...p}><path d="M2 4h10v6H2V4Zm0 0l5 4 5-4"/></svg>;
    case "report": return <svg {...p}><path d="M3 11V3h8v8H3Zm2-4h4M5 9h4M5 5h3"/></svg>;
    case "cal":    return <svg {...p}><rect x="2" y="3" width="10" height="9" rx="1.5"/><path d="M2 6h10M5 2v2M9 2v2"/></svg>;
  }
}

export function BrandIcon({ brand }: { brand: DeliverableBrand }) {
  switch (brand) {
    case "meta":       return <MetaMark size={16} />;
    case "google":     return <GoogleMark size={16} />;
    case "tiktok":     return <TikTokMark size={16} />;
    case "slack":      return <SlackMark size={16} />;
    case "resend":     return <ResendMark size={16} />;
    case "cal":        return <CalcomMark size={16} />;
    case "ga":         return <GA4Mark size={16} />;
    case "appfolio":   return <AppFolioMark size={16} />;
    case "chatgpt":    return <ChatGPTMark size={16} />;
    case "perplexity": return <PerplexityMark size={16} />;
    case "claude":     return <ClaudeMark size={16} />;
    case "gemini":     return <GeminiMark size={16} />;
    case "linkedin":   return <LinkedInMark size={16} />;
    case "vercel":     return <VercelMark size={16} />;
    case "figma":      return <FigmaMark size={16} />;
  }
}
