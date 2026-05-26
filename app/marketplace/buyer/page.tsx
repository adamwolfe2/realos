import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getBuyerSession } from "@/lib/marketplace/auth";
import { InitialsAvatar } from "@/components/marketplace/initials-avatar";

export const dynamic = "force-dynamic";

export default async function BuyerDashboardPage() {
  const buyer = await getBuyerSession();
  if (!buyer) redirect("/marketplace/buyer/sign-in");

  const [purchases, streams, totalSpentCents] = await Promise.all([
    prisma.marketplacePurchase.findMany({
      where: { buyerId: buyer.id, status: "PAID" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            market: true,
            propertyType: true,
            intentScore: true,
            signal: true,
            timeline: true,
            budgetLabel: true,
            photoUrl: true,
          },
        },
      },
    }),
    prisma.marketplaceStream.findMany({
      where: { buyerId: buyer.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.marketplacePurchase
      .aggregate({
        where: { buyerId: buyer.id, status: "PAID" },
        _sum: { priceCents: true },
      })
      .then((r) => r._sum.priceCents ?? 0),
  ]);

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
            Buyer dashboard
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
            {buyer.fullName ?? buyer.email}
          </h1>
        </div>
        <SignOutButton />
      </div>

      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Leads purchased" value={purchases.length.toLocaleString()} accent />
        <Tile label="Total spent" value={`$${(totalSpentCents / 100).toFixed(2)}`} />
        <Tile label="Active streams" value={streams.filter((s) => s.enabled).length.toString()} />
        <Tile label="Auto-purchased (streams)" value={purchases.filter((p) => p.origin === "STREAM").length.toString()} />
      </div>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-3 mb-4">
          <h2
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-display)",
              fontSize: "20px",
              fontWeight: 500,
            }}
          >
            Stream subscriptions
          </h2>
          <Link
            href="/marketplace/buyer/streams"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 600,
              color: "#2563EB",
              textDecoration: "none",
            }}
          >
            Manage streams →
          </Link>
        </div>
        {streams.length === 0 ? (
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
              You don't have any stream subscriptions yet.
            </p>
            <p
              className="mt-1"
              style={{
                color: "#64748B",
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
              }}
            >
              Save a filter as a stream and we'll auto-purchase every new
              matching lead and deliver it to your CRM.
            </p>
            <Link
              href="/marketplace/buyer/streams"
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
              Create your first stream
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {streams.slice(0, 4).map((s) => (
              <li
                key={s.id}
                className="p-4"
                style={{
                  backgroundColor: "#fff",
                  borderRadius: "12px",
                  boxShadow: "0 0 0 1px #E2E8F0",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p
                    style={{
                      color: "#1E2A3A",
                      fontFamily: "var(--font-sans)",
                      fontSize: "14.5px",
                      fontWeight: 600,
                    }}
                  >
                    {s.name}
                  </p>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "9.5px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: s.enabled ? "#059669" : "#94A3B8",
                      backgroundColor: s.enabled
                        ? "rgba(16,185,129,0.10)"
                        : "rgba(148,163,184,0.15)",
                      padding: "2px 7px",
                      borderRadius: "4px",
                      fontWeight: 700,
                    }}
                  >
                    {s.enabled ? "Live" : "Paused"}
                  </span>
                </div>
                <p
                  className="mt-1.5"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11.5px",
                    color: "#64748B",
                  }}
                >
                  {s.market ?? "Any market"} · {s.propertyType ?? "Any type"} · intent ≥ {s.minIntent} · max ${(s.maxPriceCents / 100).toFixed(0)}/lead
                </p>
                <p
                  className="mt-2"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    color: "#94A3B8",
                  }}
                >
                  {s.totalPurchases} auto-purchased lifetime
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2
          className="mb-4"
          style={{
            color: "#1E2A3A",
            fontFamily: "var(--font-display)",
            fontSize: "20px",
            fontWeight: 500,
          }}
        >
          Purchased leads
        </h2>
        {purchases.length === 0 ? (
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
              }}
            >
              You haven't purchased any leads yet.{" "}
              <Link href="/marketplace" style={{ color: "#2563EB", fontWeight: 600 }}>
                Browse the marketplace
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {purchases.map((p) => {
              const fullName =
                [p.lead.firstName, p.lead.lastName].filter(Boolean).join(" ").trim() ||
                "Unknown";
              return (
                <li
                  key={p.id}
                  className="p-4 flex items-center gap-4 flex-wrap"
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: "12px",
                    boxShadow: "0 0 0 1px #E2E8F0",
                  }}
                >
                  <InitialsAvatar
                    firstName={p.lead.firstName}
                    lastName={p.lead.lastName}
                    displayName={fullName}
                    seed={p.lead.id}
                    size={40}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      style={{
                        color: "#1E2A3A",
                        fontFamily: "var(--font-sans)",
                        fontSize: "14.5px",
                        fontWeight: 600,
                      }}
                    >
                      {fullName} · {p.lead.market}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        color: "#64748B",
                        marginTop: "2px",
                      }}
                    >
                      {p.lead.email ?? "no email"} · {p.lead.phone ?? "no phone"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "16px",
                        color: "#1E2A3A",
                        fontWeight: 500,
                      }}
                    >
                      ${(p.priceCents / 100).toFixed(0)}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "10px",
                        color: "#94A3B8",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {p.origin === "STREAM" ? "STREAM" : "DIRECT"} ·{" "}
                      {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Link
                    href={`/marketplace/${p.lead.id}`}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: "1px solid #E2E8F0",
                      color: "#1E2A3A",
                      fontFamily: "var(--font-sans)",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      textDecoration: "none",
                      flexShrink: 0,
                    }}
                  >
                    View
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({
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
          color: accent ? "#2563EB" : "#1E2A3A",
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

function SignOutButton() {
  return (
    <form action="/api/marketplace/auth/sign-out" method="POST">
      <button
        type="submit"
        style={{
          padding: "8px 14px",
          borderRadius: "8px",
          border: "1px solid #E2E8F0",
          backgroundColor: "#fff",
          color: "#1E2A3A",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Sign out
      </button>
    </form>
  );
}
