import { SeoTabs } from "./seo-tabs";

// ---------------------------------------------------------------------------
// /portal/seo/* shared layout.
//
// Renders the horizontal sub-tab bar once across every SEO route so the
// operator can hop between Overview / AI Search / Opportunities / Agent /
// Neighborhoods without going back through the URL bar. Server component
// — the tabs themselves carry the only client-side concern (highlighting
// the active route via usePathname).
// ---------------------------------------------------------------------------

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SeoTabs />
      {children}
    </>
  );
}
