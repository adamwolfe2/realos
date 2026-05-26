import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSellerSession } from "@/lib/marketplace/seller-auth";

export const dynamic = "force-dynamic";

export default async function SellerDashboardPage() {
  const seller = await getSellerSession();
  if (!seller) redirect("/marketplace/seller/sign-in");

  const [leads, recentSales, pendingPayouts] = await Promise.all([
    prisma.marketplaceLead.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        market: true,
        propertyType: true,
        intentScore: true,
        priceCents: true,
        status: true,
        photoUrl: true,
        createdAt: true,
        soldAt: true,
      },
    }),
    prisma.marketplacePurchase.findMany({
      where: {
        sellerIdAtSale: seller.id,
        status: "PAID",
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            market: true,
            propertyType: true,
            photoUrl: true,
            intentScore: true,
          },
        },
      },
    }),
    prisma.marketplaceSellerPayout.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const availableCount = leads.filter((l) => l.status === "AVAILABLE").length;
  const soldCount = leads.filter((l) => l.status === "SOLD").length;
  const expiredCount = leads.filter((l) => l.status === "EXPIRED").length;

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-10 md:py-14">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
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
            Seller dashboard
          </p>
          <h1
            className="mt-2"
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px, 3.5vw, 40px)",
              fontWeight: 500,
              lineHeight: 1.12,
              letterSpacing: "-0.012em",
            }}
          >
            {seller.fullName ?? seller.email}
          </h1>
          <p
            className="mt-2 font-mono text-xs text-slate-400 uppercase tracking-wider"
          >
            {seller.revShareBps / 100}% revenue share · {seller.status}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/marketplace/seller/import"
            style={{
              padding: "10px 16px",
              borderRadius: "10px",
              backgroundColor: "#2563EB",
              color: "#fff",
              fontFamily: "var(--font-sans)",
              fontSize: "13.5px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Import leads →
          </Link>
          <form action="/api/marketplace/seller-auth/sign-out" method="POST">
            <button
              type="submit"
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
                backgroundColor: "#fff",
                color: "#1E2A3A",
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Contributed" value={seller.totalLeadsContributed.toLocaleString()} />
        <Tile label="Sold" value={seller.totalLeadsSold.toLocaleString()} accent />
        <Tile label="Lifetime accrued" value={`$${(seller.accruedCents / 100).toFixed(2)}`} />
        <Tile label="Unpaid balance" value={`$${(seller.unpaidOwedCents / 100).toFixed(2)}`} hot />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <section>
          <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
            <h2
              style={{
                color: "#1E2A3A",
                fontFamily: "var(--font-display)",
                fontSize: "20px",
                fontWeight: 500,
              }}
            >
              Your leads
            </h2>
            <span className="font-mono text-xs text-slate-400 uppercase tracking-wider">
              {availableCount} available · {soldCount} sold · {expiredCount} expired
            </span>
          </div>

          {leads.length === 0 ? (
            <div
              className="p-6 text-center"
              style={{
                backgroundColor: "#F1F5F9",
                border: "1px dashed #E2E8F0",
                borderRadius: "12px",
              }}
            >
              <p
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14.5px",
                  fontWeight: 500,
                }}
              >
                No leads contributed yet.
              </p>
              <p
                className="mt-1"
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                }}
              >
                Upload a CSV or wire an audience segment to get started.
              </p>
              <Link
                href="/marketplace/seller/import"
                className="inline-block mt-3"
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  backgroundColor: "#2563EB",
                  color: "#fff",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Import your first batch
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {leads.slice(0, 20).map((l) => {
                const name =
                  [l.firstName, l.lastName].filter(Boolean).join(" ").trim() ||
                  "Unknown";
                return (
                  <li
                    key={l.id}
                    className="p-3 flex items-center gap-3 flex-wrap"
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: "10px",
                      boxShadow: "0 0 0 1px #E2E8F0",
                    }}
                  >
                    {l.photoUrl && (
                      <img
                        src={l.photoUrl}
                        alt={name}
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        style={{
                          color: "#1E2A3A",
                          fontFamily: "var(--font-sans)",
                          fontSize: "13.5px",
                          fontWeight: 600,
                        }}
                      >
                        {name} <span className="text-slate-400 font-normal">· {l.market}</span>
                      </p>
                      <p
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "10.5px",
                          color: "#94A3B8",
                          marginTop: "1px",
                        }}
                      >
                        {l.propertyType} · intent {l.intentScore} · ${(l.priceCents / 100).toFixed(0)}
                      </p>
                    </div>
                    <LeadStatusBadge status={l.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-5">
          <div
            className="p-5"
            style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              boxShadow: "0 0 0 1px #E2E8F0",
            }}
          >
            <p
              style={{
                color: "#2563EB",
                fontFamily: "var(--font-mono)",
                fontSize: "10.5px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Recent sales
            </p>
            {recentSales.length === 0 ? (
              <p
                className="mt-3"
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                }}
              >
                No sales yet. Your leads start earning as soon as buyers
                check out.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {recentSales.slice(0, 6).map((p) => {
                  const name =
                    [p.lead.firstName, p.lead.lastName]
                      .filter(Boolean)
                      .join(" ")
                      .trim() || "Unknown";
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className="truncate"
                          style={{
                            color: "#1E2A3A",
                            fontFamily: "var(--font-sans)",
                            fontSize: "13px",
                            fontWeight: 500,
                          }}
                        >
                          {name} · {p.lead.market}
                        </p>
                        <p
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "10px",
                            color: "#94A3B8",
                          }}
                        >
                          {new Date(p.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "14.5px",
                          color: "#059669",
                          fontWeight: 600,
                        }}
                      >
                        +${((p.sellerShareCents ?? 0) / 100).toFixed(2)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div
            className="p-5"
            style={{
              backgroundColor: "#F1F5F9",
              borderRadius: "12px",
            }}
          >
            <p
              style={{
                color: "#2563EB",
                fontFamily: "var(--font-mono)",
                fontSize: "10.5px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Payouts
            </p>
            {pendingPayouts.length === 0 ? (
              <p
                className="mt-3"
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                }}
              >
                No payouts yet. Your unpaid balance accrues on every sale
                and clears via weekly payout.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {pendingPayouts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        color: "#64748B",
                      }}
                    >
                      {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "14px",
                        color: p.status === "PAID" ? "#059669" : "#1E2A3A",
                        fontWeight: 600,
                      }}
                    >
                      ${(p.amountCents / 100).toFixed(2)} · {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  accent = false,
  hot = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  hot?: boolean;
}) {
  return (
    <div
      className="p-4"
      style={{
        backgroundColor: "#fff",
        borderRadius: "12px",
        boxShadow: "0 0 0 1px #E2E8F0",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#94A3B8",
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      <p
        className="mt-1.5"
        style={{
          color: hot ? "#059669" : accent ? "#2563EB" : "#1E2A3A",
          fontFamily: "var(--font-display)",
          fontSize: "24px",
          fontWeight: 500,
          lineHeight: 1,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function LeadStatusBadge({ status }: { status: string }) {
  const palette: Record<string, { bg: string; fg: string }> = {
    AVAILABLE: { bg: "rgba(16,185,129,0.10)", fg: "#059669" },
    RESERVED: { bg: "rgba(245,158,11,0.10)", fg: "#D97706" },
    SOLD: { bg: "rgba(37,99,235,0.10)", fg: "#2563EB" },
    EXPIRED: { bg: "rgba(148,163,184,0.20)", fg: "#64748B" },
    RETIRED: { bg: "rgba(148,163,184,0.20)", fg: "#64748B" },
  };
  const p = palette[status] ?? palette.EXPIRED;
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "9.5px",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: p.fg,
        backgroundColor: p.bg,
        padding: "2px 7px",
        borderRadius: "4px",
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {status}
    </span>
  );
}
