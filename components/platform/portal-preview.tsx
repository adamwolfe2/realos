// ---------------------------------------------------------------------------
// PortalPreview (Linear-inspired, dark)
// Mock of a shipped tenant marketing site inside a browser chrome. The
// INSIDE of the browser stays light because tenant sites have their own
// brand. The OUTSIDE (section background, frame) is dark Linear chrome.
// ---------------------------------------------------------------------------

export function PortalPreview() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse at 20% 30%, rgba(94,106,210,0.18) 0%, transparent 55%)",
        }}
      />
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-28 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative">
        <div className="lg:col-span-4">
          <p className="eyebrow">What we actually ship</p>
          <h2
            className="mt-4"
            style={{
              color: "var(--text-headline)",
              fontSize: "clamp(32px, 3.8vw, 44px)",
              fontWeight: 510,
              letterSpacing: "-0.022em",
              lineHeight: 1.05,
            }}
          >
            A custom site on your domain, not a template.
          </h2>
          <p
            className="mt-5 text-[15px] leading-relaxed"
            style={{ color: "var(--text-muted)", letterSpacing: "-0.011em" }}
          >
            We rebuild every operator's marketing site from the intake call,
            brand, and unit mix. Floor plans pull from AppFolio. Tours book
            through your calendar. The pixel is live from day one.
          </p>
          <ul className="mt-8 space-y-3 text-[13px]" style={{ color: "var(--text-body)" }}>
            <PointRow>Next.js static generation, sub-second LCP</PointRow>
            <PointRow>Auto-synced inventory, no stale unit pages</PointRow>
            <PointRow>Schema markup for LocalBusiness and ApartmentComplex</PointRow>
            <PointRow>You own the domain, DNS, and the code</PointRow>
          </ul>
        </div>

        <div className="lg:col-span-8">
          <BrowserFrame />
        </div>
      </div>
    </section>
  );
}

function PointRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0 mt-0.5"
        style={{
          backgroundColor: "rgba(94,106,210,0.18)",
          color: "var(--accent-bright)",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M1.5 5L4 7.5L8.5 2.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span style={{ letterSpacing: "-0.011em" }}>{children}</span>
    </li>
  );
}

function BrowserFrame() {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: "1px solid var(--border-standard)",
        backgroundColor: "#FFFFFF",
        boxShadow:
          "0 30px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{
          backgroundColor: "#18191A",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <span className="flex gap-1.5">
          <Circle color="#E5695D" />
          <Circle color="#E9B949" />
          <Circle color="#58C36A" />
        </span>
        <span
          className="font-mono text-[10px] ml-3 px-2.5 py-0.5 rounded"
          style={{
            backgroundColor: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.65)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          telegraphcommons.com / floor-plans
        </span>
      </div>

      <div style={{ color: "#0F1523" }}>
        <MockNav />
        <MockHero />
        <MockFloorplans />
        <MockFooter />
      </div>
    </div>
  );
}

function Circle({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

function MockNav() {
  return (
    <div
      className="flex items-center px-5 py-3"
      style={{ borderBottom: "1px solid #E2DDD6", backgroundColor: "#FFFFFF" }}
    >
      <span className="text-[14px]" style={{ fontWeight: 510, letterSpacing: "-0.012em" }}>
        Telegraph Commons
      </span>
      <span className="flex-1" />
      <span
        className="hidden sm:flex gap-5 text-[11px]"
        style={{ color: "#3D4556", fontWeight: 510 }}
      >
        <span>Home</span>
        <span style={{ color: "#0F1523" }}>Floor plans</span>
        <span>Amenities</span>
        <span>Gallery</span>
        <span>Contact</span>
      </span>
      <span
        className="ml-5 text-[10px] px-3 py-1.5 rounded"
        style={{
          backgroundColor: "#1F2937",
          color: "white",
          fontWeight: 510,
          letterSpacing: "0.02em",
        }}
      >
        Apply now
      </span>
    </div>
  );
}

function MockHero() {
  return (
    <div
      className="px-5 py-6"
      style={{
        background:
          "linear-gradient(135deg, #F9F7F4 0%, #E5E1DB 50%, #C8C0B4 100%)",
      }}
    >
      <p
        className="font-mono text-[9px] mb-2"
        style={{ color: "#3D4556", letterSpacing: "0.14em" }}
      >
        UC BERKELEY &middot; SOUTHSIDE
      </p>
      <p
        className="text-[22px]"
        style={{
          fontWeight: 510,
          letterSpacing: "-0.022em",
          lineHeight: 1.1,
        }}
      >
        Floor plans steps
        <br />
        from Sproul Plaza.
      </p>
    </div>
  );
}

function MockFloorplans() {
  const plans = [
    { name: "Studio",    sqft: "380",   rent: "$1,995", beds: "1", available: 3 },
    { name: "1 Bedroom", sqft: "520",   rent: "$2,350", beds: "1", available: 5 },
    { name: "2 Bedroom", sqft: "760",   rent: "$3,100", beds: "2", available: 2 },
    { name: "3 Bedroom", sqft: "1,020", rent: "$4,150", beds: "3", available: 1 },
  ];
  return (
    <div className="px-5 py-6" style={{ backgroundColor: "#FFFFFF" }}>
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-[14px]"
          style={{ color: "#0F1523", fontWeight: 510 }}
        >
          Floor plans
        </p>
        <p
          className="font-mono text-[10px]"
          style={{ color: "#10b981" }}
        >
          &#9679; 11 available &middot; live from AppFolio
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {plans.map((p) => (
          <div
            key={p.name}
            className="px-3 py-2.5"
            style={{ border: "1px solid #E2DDD6", borderRadius: "6px" }}
          >
            <p className="text-[12px]" style={{ color: "#0F1523", fontWeight: 510 }}>
              {p.name}
            </p>
            <p className="font-mono text-[10px]" style={{ color: "#3D4556" }}>
              {p.sqft} sqft &middot; {p.beds} bed
            </p>
            <div
              className="mt-2 flex items-center justify-between"
              style={{ borderTop: "1px dashed #E2DDD6", paddingTop: "6px" }}
            >
              <span
                className="font-mono text-[10px]"
                style={{ color: "#0F1523", fontWeight: 510 }}
              >
                {p.rent}
              </span>
              <span
                className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: "#EEF2FB",
                  color: "#2A52BE",
                  fontWeight: 510,
                }}
              >
                {p.available} open
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockFooter() {
  return (
    <div
      className="flex items-center justify-between px-5 py-3"
      style={{
        borderTop: "1px solid #E2DDD6",
        backgroundColor: "#F9F7F4",
      }}
    >
      <span className="font-mono text-[9px]" style={{ color: "#8B92A5" }}>
        2490 Channing Way, Berkeley
      </span>
      <span className="font-mono text-[9px]" style={{ color: "#8B92A5" }}>
        (510) 462-5442
      </span>
    </div>
  );
}
