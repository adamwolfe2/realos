import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getBuyerSession } from "@/lib/marketplace/auth";
import { StreamForm } from "@/components/marketplace/stream-form";

export const dynamic = "force-dynamic";

export default async function BuyerStreamsPage() {
  const buyer = await getBuyerSession();
  if (!buyer) redirect("/marketplace/buyer/sign-in");

  const streams = await prisma.marketplaceStream.findMany({
    where: { buyerId: buyer.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-[960px] mx-auto px-4 md:px-8 py-10 md:py-14">
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
        Buyer · Stream subscriptions
      </p>
      <h1
        className="mt-2"
        style={{
          color: "#1E2A3A",
          fontFamily: "var(--font-display)",
          fontSize: "clamp(26px, 3vw, 36px)",
          fontWeight: 500,
          lineHeight: 1.12,
          letterSpacing: "-0.012em",
        }}
      >
        Auto-buy every lead that matches your filter.
      </h1>
      <p
        className="mt-3 max-w-[640px]"
        style={{
          color: "#64748B",
          fontFamily: "var(--font-sans)",
          fontSize: "15px",
          lineHeight: 1.55,
        }}
      >
        Save a filter as a stream and we'll auto-purchase every new lead
        that matches — capped by your weekly budget — and deliver it to
        your inbox the moment it scores.
      </p>

      <section
        className="mt-8 p-6 md:p-8"
        style={{
          backgroundColor: "#fff",
          borderRadius: "16px",
          boxShadow: "0 0 0 1px #E2E8F0",
        }}
      >
        <h2
          className="mb-4"
          style={{
            color: "#1E2A3A",
            fontFamily: "var(--font-display)",
            fontSize: "18px",
            fontWeight: 500,
          }}
        >
          New stream
        </h2>
        <StreamForm />
      </section>

      <section className="mt-10">
        <h2
          className="mb-4"
          style={{
            color: "#1E2A3A",
            fontFamily: "var(--font-display)",
            fontSize: "18px",
            fontWeight: 500,
          }}
        >
          Your streams
        </h2>
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
                color: "#64748B",
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
              }}
            >
              No streams yet. Create one above.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {streams.map((s) => (
              <li
                key={s.id}
                className="p-5"
                style={{
                  backgroundColor: "#fff",
                  borderRadius: "12px",
                  boxShadow: "0 0 0 1px #E2E8F0",
                }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p
                      style={{
                        color: "#1E2A3A",
                        fontFamily: "var(--font-sans)",
                        fontSize: "15px",
                        fontWeight: 600,
                      }}
                    >
                      {s.name}
                    </p>
                    <p
                      className="mt-1"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11.5px",
                        color: "#64748B",
                      }}
                    >
                      {s.market ?? "Any market"} · {s.propertyType ?? "Any type"} · intent ≥ {s.minIntent} · max ${(s.maxPriceCents / 100).toFixed(0)}/lead · budget ${(s.weeklyBudgetCents / 100).toFixed(0)}/wk
                    </p>
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: s.enabled ? "#059669" : "#94A3B8",
                      backgroundColor: s.enabled
                        ? "rgba(16,185,129,0.10)"
                        : "rgba(148,163,184,0.15)",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      fontWeight: 700,
                    }}
                  >
                    {s.enabled ? "Live" : "Paused"}
                  </span>
                </div>
                <p
                  className="mt-3"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    color: "#94A3B8",
                  }}
                >
                  {s.totalPurchases} auto-purchases lifetime
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
