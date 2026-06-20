import { notFound } from "next/navigation";
import Link from "next/link";
import { getBuyerSession } from "@/lib/marketplace/auth";
import {
  getBuyerPurchaseForLead,
  getFullLead,
  getMaskedLead,
} from "@/lib/marketplace/repo";
import { BuyLeadButton } from "@/components/marketplace/buy-lead-button";
import { LeadAvatar } from "@/components/marketplace/initials-avatar";

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

  // Determine ownership BEFORE fetching any PII. The masked view is the only
  // shape an unauthenticated visitor or non-buyer ever sees; the full-PII
  // record is fetched solely when a paid purchase is proven, so gender /
  // income / contact details can never reach the render layer otherwise.
  const purchase = buyer ? await getBuyerPurchaseForLead(buyer.id, id) : null;
  const owned = !!purchase;

  const masked = await getMaskedLead(id);
  if (!masked) notFound();

  const full = owned ? await getFullLead(id) : null;

  // Unified view object. Raw PII fields are present ONLY when `owned`
  // (full !== null); for everyone else they are null and the render falls
  // back to the masked "revealed on purchase" placeholders. Existence flags
  // (`has`) drive which teaser rows appear without exposing the values.
  const lead = {
    id: masked.id,
    market: masked.market,
    age: masked.age,
    photoUrl: masked.photoUrl,
    displayName: masked.displayName,
    intentScore: masked.intentScore,
    propertyType: masked.propertyType,
    timeline: masked.timeline,
    priceCents: masked.priceCents,
    signal: masked.signal,
    budgetLabel: masked.budgetLabel,
    has: masked.has,
    // Raw PII — null unless owned.
    fullName: full?.fullName ?? masked.displayName,
    email: full?.email ?? null,
    businessEmail: full?.businessEmail ?? null,
    phone: full?.phone ?? null,
    mobilePhone: full?.mobilePhone ?? null,
    city: full?.city ?? null,
    state: full?.state ?? null,
    postalCode: full?.postalCode ?? null,
    companyName: full?.companyName ?? null,
    companyState: full?.companyState ?? null,
    linkedinUrl: full?.linkedinUrl ?? null,
    incomeRange: full?.incomeRange ?? null,
    gender: full?.gender ?? null,
  };

  const isAvailable =
    masked.status === "AVAILABLE" || masked.status === "RESERVED";

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
            <LeadAvatar
              mode={owned ? "revealed" : "blurred"}
              photoUrl={lead.photoUrl}
              displayName={owned ? lead.fullName : lead.displayName}
              seed={lead.id}
              size={84}
            />
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

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
            <Row label="Personal email" value={owned ? (lead.email ?? "—") : "•••••@•••••.com (revealed on purchase)"} masked={!owned} />
            {(owned || lead.has.businessEmail) && (
              <Row label="Business email" value={owned ? (lead.businessEmail ?? "—") : "••••@company.com (revealed on purchase)"} masked={!owned} />
            )}
            <Row label="Personal phone" value={owned ? (lead.phone ?? "—") : "•• (•••) •••-•••• (revealed on purchase)"} masked={!owned} />
            {(owned || lead.has.mobilePhone) && (
              <Row label="Mobile phone" value={owned ? (lead.mobilePhone ?? "—") : "•• (•••) •••-•••• (revealed on purchase)"} masked={!owned} />
            )}
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

          {(owned ||
            lead.has.company ||
            lead.has.linkedin ||
            lead.has.income ||
            lead.has.gender) && (
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
                Professional profile
              </h2>
              {owned && lead.linkedinUrl && (
                <div
                  className="mt-3 mb-1 p-3 rounded-md flex items-center justify-between gap-3"
                  style={{
                    backgroundColor: "rgba(37,99,235,0.06)",
                    border: "1px solid rgba(37,99,235,0.18)",
                  }}
                >
                  <div className="min-w-0">
                    <p
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "10px",
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "#2563EB",
                        fontWeight: 700,
                      }}
                    >
                      Verify identity
                    </p>
                    <p
                      className="mt-1"
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "13px",
                        color: "#1E2A3A",
                      }}
                    >
                      Click through to confirm this is the right person before
                      reaching out.
                    </p>
                  </div>
                  <a
                    href={lead.linkedinUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      backgroundColor: "#2563EB",
                      color: "#fff",
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      fontWeight: 600,
                      textDecoration: "none",
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    View on LinkedIn ↗
                  </a>
                </div>
              )}
              <ul className="mt-3 space-y-0">
                {(owned || lead.has.company) && (
                  <Row
                    label="Company"
                    value={
                      owned
                        ? [lead.companyName, lead.companyState].filter(Boolean).join(" · ") || "—"
                        : "•••••• (revealed on purchase)"
                    }
                    masked={!owned}
                  />
                )}
                {!owned && lead.has.linkedin && (
                  <Row
                    label="LinkedIn"
                    value="linkedin.com/in/••••• (revealed on purchase)"
                    masked={true}
                  />
                )}
                {(owned || lead.has.income) && (
                  <Row
                    label="Income range"
                    value={owned ? (lead.incomeRange ?? "—") : "••• (revealed on purchase)"}
                    masked={!owned}
                  />
                )}
                {(owned || lead.has.gender) && (
                  <Row
                    label="Gender"
                    value={owned ? (lead.gender ?? "—") : "••• (revealed on purchase)"}
                    masked={!owned}
                  />
                )}
                {lead.age != null && (
                  <Row
                    label="Age"
                    value={String(lead.age)}
                  />
                )}
              </ul>
            </>
          )}

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
  link = null,
}: {
  label: string;
  value: string;
  masked?: boolean;
  strong?: boolean;
  link?: string | null;
}) {
  const contentStyle: React.CSSProperties = {
    fontFamily: "var(--font-sans)",
    fontSize: "14px",
    color: masked ? "#94A3B8" : strong ? "#2563EB" : "#1E2A3A",
    fontStyle: masked ? "italic" : "normal",
    fontWeight: strong ? 600 : 500,
    textAlign: "right",
    flex: 1,
    wordBreak: "break-word",
  };
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
          minWidth: "120px",
        }}
      >
        {label}
      </span>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer noopener"
          style={{ ...contentStyle, color: "#2563EB", textDecoration: "none" }}
        >
          {value} ↗
        </a>
      ) : (
        <span style={contentStyle}>{value}</span>
      )}
    </li>
  );
}

function prettyType(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}
