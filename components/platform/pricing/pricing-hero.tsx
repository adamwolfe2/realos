import Link from "next/link";
import { BookDemoLink } from "@/components/marketing/book-demo-link";

// ---------------------------------------------------------------------------
// PricingHero — single-column centered text hero. No artifact, no
// split layout. Matches the /audit hero's centered rhythm so pricing
// reads as a focused buying moment instead of a marketing wall.
//
// Structure mirrors app/(platform)/audit/page.tsx exactly:
//   max-w-[1100px] outer  ·  max-w-3xl mx-auto text-center inner
//   centered eyebrow with mirroring blue lines
//   centered headline + accent color on the second line
//   centered subhead capped at max-w-2xl
//   centered CTA row
//   centered trust strip
// ---------------------------------------------------------------------------

// Canonical CTA pair (Carbon wave 2): "Request pilot" → /sign-up (the
// one self-serve pilot entry; sign-up flows into onboarding with the
// trial). "Book intro call" → BookDemoLink, which resolves to the
// configured Cal.com URL (NEXT_PUBLIC_CAL_BOOK_URL).
const PRIMARY_HREF = "/sign-up";

export function PricingHero() {
  return (
    <section
      className="relative"
      style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}
    >
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 pt-16 md:pt-24 pb-16 md:pb-24">
        <div className="max-w-3xl mx-auto text-center">
          {/* Eyebrow — line + mono blue label + mirrored line */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <span
              aria-hidden
              className="hidden sm:inline-block"
              style={{ width: 28, height: 1, backgroundColor: "var(--color-primary)" }}
            />
            <p
              className="text-[11px] font-mono uppercase tracking-[0.18em]"
              style={{ color: "var(--color-primary)", fontFamily: "var(--font-mono)" }}
            >
              Pricing
            </p>
            <span
              aria-hidden
              className="hidden sm:inline-block"
              style={{ width: 28, height: 1, backgroundColor: "var(--color-primary)" }}
            />
          </div>

          {/* Headline — black first line, brand-blue second line.
              Norman v2 brief (PR1): "One platform. Every signal. One
              price per property." Leads with the platform-first frame
              instead of the displaced-retainer angle. */}
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tight"
            style={{ color: "#1E2A3A" }}
          >
            One platform. Every signal.
            <br />
            <span style={{ color: "var(--color-primary)" }}>One price per property.</span>
          </h1>

          {/* Subhead — Norman v2 PR2. Lead with the intelligence platform
              (connect existing stack, unified dashboard). Ad campaign
              management is a real capability but no longer the headline:
              acknowledged in a single follow-on sentence. No em dashes. */}
          <p
            className="mt-5 text-lg md:text-xl leading-relaxed mx-auto max-w-2xl"
            style={{ color: "#525252" }}
          >
            Connect your existing stack. Get one dashboard showing leads,
            traffic, reputation, and AI visibility. When you run paid
            campaigns, we track every dollar to a lease.
          </p>

          {/* Primary + secondary CTA — the one canonical buying pair:
              "Request pilot" and "Book intro call". */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={PRIMARY_HREF}
              className="inline-flex items-center justify-center h-11 px-6 rounded-md text-sm font-medium text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Request pilot
            </Link>
            <BookDemoLink
              className="inline-flex items-center justify-center h-11 px-6 rounded-md text-sm font-medium transition-colors"
              style={{
                border: "1px solid var(--hair)",
                color: "#1E2A3A",
                backgroundColor: "#FFFFFF",
              }}
            >
              Book intro call
            </BookDemoLink>
          </div>

          {/* Trust strip — 3 chips, centered, mirrors homepage rhythm */}
          <ul className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <TrustChip value="14 days" label="Live on your domain" />
            <TrustChip value="100%" label="Ad spend tracked" />
            <TrustChip value="$0" label="Pilot. Cancel anytime." />
          </ul>
        </div>
      </div>
    </section>
  );
}

function TrustChip({ value, label }: { value: string; label: string }) {
  return (
    <li className="text-center sm:text-left">
      <p
        className="text-xl font-semibold"
        style={{ color: "#1E2A3A", letterSpacing: "-0.01em" }}
      >
        {value}
      </p>
      <p
        className="mt-0.5 text-[11px] font-mono uppercase tracking-[0.16em]"
        style={{ color: "var(--stone-gray)", fontFamily: "var(--font-mono)" }}
      >
        {label}
      </p>
    </li>
  );
}
