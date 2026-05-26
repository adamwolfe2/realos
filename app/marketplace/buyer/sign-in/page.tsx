import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getBuyerSession } from "@/lib/marketplace/auth";
import { SignInForm } from "@/components/marketplace/sign-in-form";

export const dynamic = "force-dynamic";

export default async function MarketplaceSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const session = await getBuyerSession();
  if (session) {
    redirect("/marketplace/buyer");
  }

  const sp = await searchParams;
  const error = sp.error;
  const errorMessage =
    error === "invalid_or_expired"
      ? "That link is invalid or expired. Request a fresh one below."
      : error === "missing_token"
        ? "Missing sign-in token. Request a new link below."
        : error === "send_failed"
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
          Marketplace · Buyer sign-in
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
          Sign in to buy leads.
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
          Enter your email and we'll send you a one-time sign-in link. No
          passwords. No portal account required.
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
          <Suspense fallback={null}>
            <SignInForm next={sp.next ?? null} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
