import Link from "next/link";
import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Marketplace · ${BRAND_NAME}`,
  description:
    "Browse a live pool of identity-matched, intent-scored real estate leads. Filter by market, property type, intent, and price. Subscribe to a stream and auto-route every match to your CRM.",
};

// ---------------------------------------------------------------------------
// /marketplace — standalone buyer surface
//
// Intentionally NOT under (platform) — the marketplace targets a different
// audience (buyer-agents, brokerages, investors) than the operator-marketing
// pages. Its own minimal chrome keeps the experience focused on the lead
// pool without dragging in the operator-portal pitch.
//
// Phase 2 will add proper buyer auth, a buyer dashboard, and a streams
// management UI. For now the layout is just a header strip + footer.
// ---------------------------------------------------------------------------

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FAFBFF" }}>
      <header
        style={{
          borderBottom: "1px solid #E2E8F0",
          backgroundColor: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(10px)",
        }}
        className="sticky top-0 z-30"
      >
        <div className="max-w-[1240px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">
          <Link
            href="/marketplace"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "17px",
              color: "#1E2A3A",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              textDecoration: "none",
            }}
          >
            {BRAND_NAME}{" "}
            <span
              style={{
                color: "#2563EB",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 700,
                marginLeft: "10px",
              }}
            >
              · Marketplace
            </span>
          </Link>
          <nav className="hidden sm:flex items-center gap-5">
            <Link
              href="/leads"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13.5px",
                color: "#64748B",
                fontWeight: 500,
              }}
            >
              How it works
            </Link>
            <Link
              href="/marketplace/buyer/sign-in"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13.5px",
                color: "#1E2A3A",
                fontWeight: 600,
              }}
            >
              Sign in
            </Link>
            <Link
              href="/onboarding"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13.5px",
                fontWeight: 600,
                padding: "6px 14px",
                borderRadius: "8px",
                backgroundColor: "#2563EB",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              Become a seller
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer
        style={{
          borderTop: "1px solid #E2E8F0",
          backgroundColor: "#fff",
        }}
      >
        <div
          className="max-w-[1240px] mx-auto px-4 md:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "#94A3B8",
            letterSpacing: "0.08em",
          }}
        >
          <span>© {new Date().getFullYear()} {BRAND_NAME}</span>
          <span className="flex items-center gap-4">
            <Link href="/leads" style={{ color: "#94A3B8" }}>
              Product
            </Link>
            <Link href="/privacy" style={{ color: "#94A3B8" }}>
              Privacy
            </Link>
            <Link href="/terms" style={{ color: "#94A3B8" }}>
              Terms
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
