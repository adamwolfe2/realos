// ---------------------------------------------------------------------------
// PortalPreview
// Static mock of a shipped tenant marketing site inside a browser chrome.
// We show the structure operators actually get: nav, hero, live floorplans
// table (auto-synced), neighborhood tile. Zero real assets; pure CSS.
// ---------------------------------------------------------------------------

export function PortalPreview() {
  return (
    <section style={{ backgroundColor: "var(--bg-blue-dark)", color: "white" }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-4">
          <p
            className="font-mono text-[11px]"
            style={{
              color: "rgba(255,255,255,0.55)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            What we actually ship
          </p>
          <h2 className="font-serif text-3xl md:text-4xl mt-4 leading-[1.1]">
            A custom site on your domain, not a template.
          </h2>
          <p
            className="font-mono text-[13px] leading-relaxed mt-6"
            style={{ color: "rgba(255,255,255,0.78)" }}
          >
            We rebuild every operator's marketing site from the intake call,
            brand, and unit mix. Floor plans pull from AppFolio. Tours book
            through your calendar. The pixel is there from day one.
          </p>
          <ul
            className="mt-8 space-y-3 font-mono text-[12px]"
            style={{ color: "rgba(255,255,255,0.78)" }}
          >
            <li className="flex gap-3">
              <Dot /> Next.js static generation, sub-second LCP on 4G
            </li>
            <li className="flex gap-3">
              <Dot /> Auto-synced inventory, no stale unit pages
            </li>
            <li className="flex gap-3">
              <Dot /> Schema markup for LocalBusiness + ApartmentComplex
            </li>
            <li className="flex gap-3">
              <Dot /> You own the domain, DNS, and the code
            </li>
          </ul>
        </div>

        <div className="lg:col-span-8">
          <BrowserFrame />
        </div>
      </div>
    </section>
  );
}

function Dot() {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
      style={{ backgroundColor: "#FACC15" }}
    />
  );
}

function BrowserFrame() {
  return (
    <div
      className="rounded-lg overflow-hidden shadow-2xl"
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        backgroundColor: "#FFFFFF",
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{
          backgroundColor: "#F3F1EE",
          borderBottom: "1px solid #E2DDD6",
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
            backgroundColor: "#FFFFFF",
            color: "#3D4556",
            border: "1px solid #E2DDD6",
          }}
        >
          telegraphcommons.com/floor-plans
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
      <span className="font-serif text-[14px] font-semibold">Telegraph Commons</span>
      <span className="flex-1" />
      <span className="hidden sm:flex gap-5 font-mono text-[10px]" style={{ color: "#3D4556" }}>
        <span>Home</span>
        <span style={{ color: "#0F1523", fontWeight: 600 }}>Floor plans</span>
        <span>Amenities</span>
        <span>Gallery</span>
        <span>Contact</span>
      </span>
      <span
        className="ml-5 font-mono text-[10px] px-3 py-1.5 rounded"
        style={{ backgroundColor: "#2A52BE", color: "white" }}
      >
        APPLY NOW
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
      <p className="font-serif text-[22px] leading-[1.1]">
        Floor plans steps from
        <br />
        Sproul Plaza.
      </p>
    </div>
  );
}

function MockFloorplans() {
  const plans = [
    { name: "Studio",    sqft: "380",  rent: "$1,995", beds: "1", available: 3 },
    { name: "1 Bedroom", sqft: "520",  rent: "$2,350", beds: "1", available: 5 },
    { name: "2 Bedroom", sqft: "760",  rent: "$3,100", beds: "2", available: 2 },
    { name: "3 Bedroom", sqft: "1,020",rent: "$4,150", beds: "3", available: 1 },
  ];
  return (
    <div className="px-5 py-6" style={{ backgroundColor: "#FFFFFF" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="font-serif text-[14px]" style={{ color: "#0F1523" }}>Floor plans</p>
        <p
          className="font-mono text-[10px]"
          style={{ color: "#059669" }}
        >
          &#9679; 11 available &middot; live from AppFolio
        </p>
      </div>
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
      >
        {plans.map((p) => (
          <div
            key={p.name}
            className="px-3 py-2.5"
            style={{ border: "1px solid #E2DDD6", borderRadius: "6px" }}
          >
            <p className="font-serif text-[12px]" style={{ color: "#0F1523" }}>
              {p.name}
            </p>
            <p className="font-mono text-[10px]" style={{ color: "#3D4556" }}>
              {p.sqft} sqft &middot; {p.beds} bed
            </p>
            <div
              className="mt-2 flex items-center justify-between"
              style={{ borderTop: "1px dashed #E2DDD6", paddingTop: "6px" }}
            >
              <span className="font-mono text-[10px]" style={{ color: "#0F1523" }}>
                {p.rent}
              </span>
              <span
                className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: "#EEF2FB", color: "#2A52BE" }}
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
