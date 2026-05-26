import Link from "next/link";
import { MarketplaceLive } from "@/components/marketplace/marketplace-live";

// ---------------------------------------------------------------------------
// /marketplace — public live browse page (no auth)
//
// Single hero strip + the live MarketplaceLive component which hits
// GET /api/marketplace/leads. The marketing-pitch live demo lives at
// /leads — this surface is the real product.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

export default function MarketplacePage() {
  return (
    <div>
      <section
        className="border-b"
        style={{
          backgroundColor: "#FFFFFF",
          borderColor: "#E2E8F0",
        }}
      >
        <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-12 md:py-16">
          <p
            style={{
              color: "#2563EB",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Live marketplace
          </p>
          <h1
            className="mt-3 max-w-[820px]"
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(32px, 4vw, 48px)",
              fontWeight: 500,
              lineHeight: 1.08,
              letterSpacing: "-0.018em",
            }}
          >
            Real estate leads, scored and refreshed weekly.
          </h1>
          <p
            className="mt-4 max-w-[640px]"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "16.5px",
              lineHeight: 1.55,
            }}
          >
            Every lead in this pool is identity-matched, intent-scored, and
            re-enriched every week. Filter by market, property type, intent
            floor, and price band. Buy a single lead or subscribe to a stream
            that auto-routes new matches to your CRM.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/marketplace/buyer/sign-in"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                fontWeight: 600,
                padding: "10px 18px",
                borderRadius: "10px",
                backgroundColor: "#2563EB",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              Sign in to buy
            </Link>
            <Link
              href="/leads"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                fontWeight: 600,
                padding: "10px 18px",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
                color: "#1E2A3A",
                textDecoration: "none",
              }}
            >
              How it works →
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-10 md:py-14">
          <MarketplaceLive />
        </div>
      </section>
    </div>
  );
}
