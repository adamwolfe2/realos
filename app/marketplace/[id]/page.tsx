import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getBuyerSession } from "@/lib/marketplace/auth";
import { getBuyerPurchaseForLead, getFullLead } from "@/lib/marketplace/repo";
import { BuyLeadButton } from "@/components/marketplace/buy-lead-button";

export const dynamic = "force-dynamic";

export default async function MarketplaceLeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ canceled?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const buyer = await getBuyerSession();
  const lead = await getFullLead(id);
  if (!lead) notFound();

  // Has the signed-in buyer purchased this lead?
  const purchase = buyer
    ? await getBuyerPurchaseForLead(buyer.id, lead.id)
    : null;
  const owned = !!purchase;

  // Also fetch the raw status — used to decide whether to show the "buy"
  // CTA. A SOLD or EXPIRED lead is never purchasable.
  const status = await prisma.marketplaceLead.findUnique({
    where: { id: lead.id },
    select: { status: true },
  });

  const isAvailable =
    status?.status === "AVAILABLE" || status?.status === "RESERVED";

  return (
    <div className="max-w-[1080px] mx-auto px-4 md:px-8 py-10 md:py-14">
      <Link
        href="/marketplace"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#64748B",
          fontWeight: 600,
        }}
      >
        ← Back to marketplace
      </Link>

      {sp.canceled && (
        <div
          className="mt-5 p-3 rounded-lg"
          style={{
            backgroundColor: "rgba(245, 158, 11, 0.10)",
            border: "1px solid rgba(245, 158, 11, 0.25)",
            color: "#92400E",
            fontSize: "13.5px",
            lineHeight: 1.5,
          }}
        >
          Checkout was canceled. The lead is still available — try again
          when you're ready.
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        <section
          className="p-7 md:p-9"
          style={{
            backgroundColor: "#fff",
            borderRadius: "16px",
            boxShadow: "0 0 0 1px #E2E8F0, 0 20px 60px rgba(30,42,58,0.06)",
          }}
        >
          <div className="flex items-start gap-5 flex-wrap">
            {lead.photoUrl && (
              <img
                src={lead.photoUrl}
                alt={owned ? lead.fullName : lead.displayName}
                style={{
                  width: "84px",
                  height: "84px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  boxShadow: "0 0 0 1px #E2E8F0",
                  flexShrink: 0,
                }}
              />
            )}
            <div className="min-w-0">
              <p
                style={{
                  color: owned ? "#2563EB" : "#94A3B8",
                  fontFamily: "var(--font-mono)",
                  fontSize: "10.5px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                {owned ? "Purchased · PII released" : "Masked preview"}
              </p>
              <h1
                className="mt-1"
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(26px, 3vw, 36px)",
                  fontWeight: 500,
                  lineHeight: 1.12,
                  letterSpacing: "-0.012em",
                }}
              >
                {owned ? lead.fullName : lead.displayName}
                {lead.age != null && (
                  <span style={{ color: "#94A3B8", fontWeight: 400 }}> · {lead.age}</span>
                )}
              </h1>
              <p
                className="mt-1"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.08em",
                  color: "#94A3B8",
                  fontWeight: 500,
                }}
              >
                LD-{lead.id.slice(-8).toUpperCase()} · {lead.market}
              </p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="Intent" value={`${lead.intentScore}`} accent />
            <StatTile label="Type" value={prettyType(lead.propertyType)} />
            {lead.timeline && <StatTile label="Timeline" value={lead.timeline} />}
            <StatTile label="Price" value={`$${(lead.priceCents / 100).toFixed(0)}`} />
          </div>

          <hr style={{ border: 0, borderTop: "1px solid #F1F5F9", margin: "28px 0" }} />

          <h2
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-display)",
              fontSize: "18px",
              fontWeight: 500,
            }}
          >
            Contact details
          </h2>

          <ul className="mt-3 space-y-0">
            <Row label="Name"  value={owned ? lead.fullName : `${lead.displayName} (full name on purchase)`} masked={!owned} />
            <Row label="Email" value={owned ? (lead.email ?? "—") : "•••••@•••••.com (revealed on purchase)"} masked={!owned} />
            <Row label="Phone" value={owned ? (lead.phone ?? "—") : "•• (•••) •••-•••• (revealed on purchase)"} masked={!owned} />
            <Row
              label="Address"
              value={
                owned
                  ? [lead.city, lead.state, lead.postalCode].filter(Boolean).join(", ") || "—"
                  : `${lead.market} (full address on purchase)`
              }
              masked={!owned}
            />
          </ul>

          {(lead.signal || lead.budgetLabel) && (
            <>
              <hr style={{ border: 0, borderTop: "1px solid #F1F5F9", margin: "28px 0" }} />
              <h2
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-display)",
                  fontSize: "18px",
                  fontWeight: 500,
                }}
              >
                Intent overlay
              </h2>
              <ul className="mt-3 space-y-0">
                {lead.signal && <Row label="Signal" value={lead.signal} />}
                {lead.budgetLabel && <Row label="Budget" value={lead.budgetLabel} />}
                {lead.timeline && <Row label="Timeline" value={lead.timeline} strong />}
              </ul>
            </>
          )}
        </section>

        <aside
          className="p-6"
          style={{
            backgroundColor: "#F1F5F9",
            borderRadius: "16px",
            alignSelf: "start",
            position: "sticky",
            top: "84px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10.5px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#94A3B8",
              fontWeight: 700,
            }}
          >
            {owned ? "You own this lead" : isAvailable ? "Buy now" : "Unavailable"}
          </p>
          <p
            className="mt-2"
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-display)",
              fontSize: "36px",
              fontWeight: 500,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ${(lead.priceCents / 100).toFixed(0)}
          </p>
          <p
            className="mt-1"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
            }}
          >
            One-time charge · full PII released on payment
          </p>

          <div className="mt-5">
            {owned ? (
              <Link
                href="/marketplace/buyer"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "11px 18px",
                  borderRadius: "10px",
                  backgroundColor: "#fff",
                  border: "1px solid #E2E8F0",
                  color: "#1E2A3A",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Open in dashboard →
              </Link>
            ) : !isAvailable ? (
              <p
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13.5px",
                  lineHeight: 1.5,
                }}
              >
                This lead has been sold or aged out. Browse{" "}
                <Link href="/marketplace" style={{ color: "#2563EB", fontWeight: 600 }}>
                  similar leads
                </Link>{" "}
                or start a stream subscription.
              </p>
            ) : buyer ? (
              <BuyLeadButton leadId={lead.id} priceCents={lead.priceCents} />
            ) : (
              <Link
                href={`/marketplace/buyer/sign-in?next=${encodeURIComponent(`/marketplace/${lead.id}`)}`}
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "11px 18px",
                  borderRadius: "10px",
                  backgroundColor: "#2563EB",
                  color: "#fff",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Sign in to buy
              </Link>
            )}
          </div>

          <ul className="mt-6 space-y-2.5">
            {[
              "Verified email + phone match",
              "Identity-resolved (not cookie-based)",
              "Re-enriched every 7 days",
              "Refund within 48h on bad contact",
            ].map((s) => (
              <li
                key={s}
                className="flex items-start gap-2"
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  lineHeight: 1.45,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    marginTop: "5px",
                    width: "5px",
                    height: "5px",
                    borderRadius: "1px",
                    backgroundColor: "#2563EB",
                  }}
                />
                {s}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className="p-3"
      style={{
        backgroundColor: "#F1F5F9",
        borderRadius: "10px",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9.5px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#94A3B8",
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      <p
        className="mt-1"
        style={{
          color: accent ? "#2563EB" : "#1E2A3A",
          fontFamily: "var(--font-display)",
          fontSize: "20px",
          fontWeight: 500,
          lineHeight: 1,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  masked = false,
  strong = false,
}: {
  label: string;
  value: string;
  masked?: boolean;
  strong?: boolean;
}) {
  return (
    <li
      className="flex items-baseline justify-between gap-3 py-2.5"
      style={{ borderBottom: "1px solid #F1F5F9" }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10.5px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#94A3B8",
          fontWeight: 600,
          minWidth: "84px",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          color: masked ? "#94A3B8" : strong ? "#2563EB" : "#1E2A3A",
          fontStyle: masked ? "italic" : "normal",
          fontWeight: strong ? 600 : 500,
          textAlign: "right",
          flex: 1,
        }}
      >
        {value}
      </span>
    </li>
  );
}

function prettyType(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}
