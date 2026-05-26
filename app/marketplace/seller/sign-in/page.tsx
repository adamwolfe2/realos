import { redirect } from "next/navigation";
import { getSellerSession } from "@/lib/marketplace/seller-auth";
import { SellerSignInForm } from "@/components/marketplace/seller-sign-in-form";

export const dynamic = "force-dynamic";

export default async function SellerSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const seller = await getSellerSession();
  if (seller) redirect("/marketplace/seller");

  const sp = await searchParams;
  const errorMessage =
    sp.error === "invalid_or_expired"
      ? "That link is invalid or expired. Request a fresh one below."
      : sp.error === "missing_token"
        ? "Missing sign-in token. Request a new link below."
        : sp.error === "send_failed"
          ? "Could not send the email. Try again in a moment."
          : null;

  return (
    <div className="min-h-[calc(100vh-9rem)] flex items-center justify-center px-4 py-12">
      <div
        className="w-full max-w-md p-8 md:p-10"
        style={{
          backgroundColor: "#fff",
          borderRadius: "16px",
          boxShadow: "0 0 0 1px #E2E8F0, 0 20px 60px rgba(30, 42, 58,0.08)",
        }}
      >
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
          Marketplace · Seller sign-in
        </p>
        <h1
          className="mt-3"
          style={{
            color: "#1E2A3A",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(26px, 3vw, 32px)",
            fontWeight: 500,
            lineHeight: 1.12,
            letterSpacing: "-0.01em",
          }}
        >
          Bring leads, earn payouts.
        </h1>
        <p
          className="mt-3"
          style={{
            color: "#64748B",
            fontFamily: "var(--font-sans)",
            fontSize: "14.5px",
            lineHeight: 1.55,
          }}
        >
          Sign in to import leads via CSV or a Cursive segment. Every lead
          you bring earns a 70% share of every sale. We handle browse,
          checkout, and PII delivery.
        </p>
        {errorMessage && (
          <div
            className="mt-5 p-3"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.20)",
              borderRadius: "8px",
              color: "#B91C1C",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            {errorMessage}
          </div>
        )}
        <div className="mt-6">
          <SellerSignInForm />
        </div>
      </div>
    </div>
  );
}
