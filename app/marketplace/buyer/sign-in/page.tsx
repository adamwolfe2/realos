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
        className="w-full max-w-md p-8 md:p-10 bg-card rounded-2xl"
        style={{
          boxShadow: "0 0 0 1px #E2E8F0, 0 20px 60px rgba(30, 42, 58,0.08)",
        }}
      >
        <p className="font-mono text-[11px] tracking-[0.18em] uppercase font-semibold text-primary">
          Marketplace · Buyer sign-in
        </p>
        <h1 className="mt-3 font-display text-[clamp(26px,3vw,32px)] font-medium leading-[1.12] tracking-[-0.01em] text-foreground">
          Sign in to buy leads.
        </h1>
        <p className="mt-3 font-sans text-[14.5px] leading-[1.55] text-muted-foreground">
          Enter your email and we'll send you a one-time sign-in link. No
          passwords. No portal account required.
        </p>

        {errorMessage && (
          <div className="mt-5 p-3 bg-destructive/[0.08] border border-destructive/20 rounded-lg text-red-700 text-[13px] leading-[1.5]">
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
