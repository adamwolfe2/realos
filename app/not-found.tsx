import Link from "next/link";

// ---------------------------------------------------------------------------
// 404 — brand-aligned, editorial. Single-column, left-justified, large
// numeral, restrained CTAs. Matches the home page's typographic rhythm so
// stray URLs land on something that feels like the same product.
// ---------------------------------------------------------------------------

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="min-h-screen flex flex-col px-6 md:px-10"
      style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}
    >
      <header className="py-8">
        <Link href="/" aria-label="LeaseStack home" className="inline-flex">
          <img
            src="/logos/leasestack-wordmark.png"
            alt="LeaseStack"
            style={{ height: 36, width: "auto", display: "block" }}
          />
        </Link>
      </header>

      <div className="flex-1 flex items-center">
        <div className="max-w-[720px]">
          <p
            style={{
              color: "#2563EB",
              fontFamily: "var(--font-mono)",
              fontSize: "11.5px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            404 · Page not found
          </p>

          <h1
            className="mt-6"
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(44px, 7vw, 80px)",
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
            }}
          >
            Nothing at this address.
          </h1>

          <p
            className="mt-6 max-w-[560px]"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "18px",
              lineHeight: 1.55,
            }}
          >
            The page you were looking for has moved or never existed.
            Head back to the home page, or book a demo and we&apos;ll show
            you what LeaseStack actually does.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 46,
                padding: "12px 22px",
                backgroundColor: "#2563EB",
                color: "#FFFFFF",
                fontFamily: "var(--font-sans)",
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 3,
                textDecoration: "none",
                letterSpacing: "-0.005em",
              }}
            >
              Back to home
            </Link>
            <Link
              href="/onboarding"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 46,
                padding: "12px 22px",
                backgroundColor: "transparent",
                color: "#1E2A3A",
                fontFamily: "var(--font-sans)",
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 3,
                textDecoration: "none",
                border: "1px solid #E2E8F0",
              }}
            >
              Book a demo
            </Link>
          </div>
        </div>
      </div>

      <footer
        className="py-8"
        style={{
          color: "#94A3B8",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        Your leasing data. Working for you.
      </footer>
    </main>
  );
}
