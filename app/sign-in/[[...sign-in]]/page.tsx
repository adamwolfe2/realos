import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { PlatformShowcase } from "@/components/auth/platform-showcase";

export const metadata: Metadata = {
  title: `Sign in | ${BRAND_NAME}`,
  description: `Sign in to your ${BRAND_NAME} account.`,
};

// Two-pane sign-in layout. LEFT = compact branded auth form. RIGHT =
// animated <PlatformShowcase /> with KPI tiles ticking up, conversion
// funnel filling, lead-source donut chart, property card with shimmer,
// and a live activity feed. The showcase reads as a real LeaseStack
// dashboard so prospects see what they're signing into.

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-white text-foreground flex flex-col lg:flex-row lg:items-stretch">
      {/* LEFT: Auth form. Narrow column on desktop so the showcase
          dominates the visible canvas. Brand-blue rail at top mirrors
          the LeaseStack accent.

          Adam 2026-05-29: `lg:min-h-screen` is the key bit. Without it,
          the column collapses to its natural content height when the
          right showcase is shorter than the viewport — and the
          `justify-center` inside has nothing to center in, so the form
          looks pinned to the top at zoomed-out / tall-viewport sizes.
          Forcing each column to min-h-screen guarantees vertical
          centering at any zoom level. */}
      <main className="w-full lg:w-[42%] xl:w-[38%] 2xl:w-[34%] lg:min-h-screen flex flex-col bg-white border-r border-border border-t-[3px] border-t-primary">
        {/* Adam 2026-07-24: the top-right "Create account →" link used to
            float here, orphaned above the whole form — it had nothing to
            do with the logo next to it and competed with the real footer
            action below the form. Header is now logo-only; the sign-up
            path lives as a proper footer line under the primary action. */}
        <header className="px-6 lg:px-10 py-5 lg:py-6 flex items-center">
          <Link
            href="/"
            aria-label={BRAND_NAME}
            className="inline-flex items-center hover:opacity-80 transition-opacity"
          >
            <Image
              src="/logos/leasestack-wordmark.png"
              alt={BRAND_NAME}
              width={180}
              height={40}
              priority
              className="h-9 w-auto"
            />
          </Link>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-6 lg:px-10 py-10">
          <div className="w-full max-w-[420px]">
            <div className="mb-7">
              <p className="mb-3 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.22em] uppercase font-bold text-primary">
                Sign in
              </p>
              <h1 className="font-sans text-[clamp(28px,3.4vw,36px)] font-bold tracking-[-0.025em] leading-[1.08] text-foreground">
                Welcome back.
              </h1>
              <p className="mt-2 font-sans text-[14.5px] leading-[1.5] text-muted-foreground">
                Sign in to your {BRAND_NAME} portal.
              </p>
            </div>

            <SignIn
              // 2026-05-30 (Norman bug): switched from fallbackRedirectUrl
              // to forceRedirectUrl so stale `?redirect_url=` query params
              // (left in the browser by a prior session, or by Clerk's
              // password-reset flow itself) can never override our smart
              // /auth/redirect router. Without this, Clerk honors the
              // query-string redirect first, which can dump returning
              // users on the wrong subdomain or a stale invite URL.
              forceRedirectUrl="/auth/redirect"
              signUpUrl="/sign-up"
              appearance={{
                layout: {
                  logoPlacement: "none",
                  socialButtonsVariant: "blockButton",
                },
                variables: {
                  // LeaseStack brand blue (#2563EB) drives Clerk's primary
                  // accents — Continue button, focus rings, footer links.
                  // Matches the marketing nav + pricing page so the auth
                  // surface doesn't read as a stock all-black template.
                  colorPrimary: "#2563EB",
                  colorText: "#0A0A0A",
                  colorTextSecondary: "#5C5E62",
                  colorBackground: "#FFFFFF",
                  colorInputBackground: "#FFFFFF",
                  colorInputText: "#0A0A0A",
                  colorDanger: "#DC2626",
                  borderRadius: "8px",
                  fontFamily:
                    "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
                  fontSize: "14px",
                },
                elements: {
                  rootBox: "w-full",
                  card: "w-full shadow-none border border-input bg-card rounded-xl p-7",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton:
                    "border border-input bg-card hover:bg-muted text-foreground text-sm font-medium rounded-md h-11 transition-colors",
                  dividerLine: "bg-border",
                  dividerText:
                    "text-muted-foreground text-xs uppercase tracking-wider",
                  formFieldLabel:
                    "text-[11px] font-semibold text-foreground mb-1.5 uppercase tracking-wider",
                  formFieldInput:
                    "border border-input bg-card focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none rounded-md h-11 text-sm text-foreground placeholder:text-muted-foreground transition-colors",
                  formButtonPrimary:
                    "!bg-primary hover:!bg-primary-dark !text-white !shadow-none !border-0 rounded-md h-11 text-sm font-semibold transition-colors",
                  footerActionLink:
                    "!text-primary font-semibold hover:underline underline-offset-2",
                  identityPreviewEditButton:
                    "!text-primary underline underline-offset-2",
                  otpCodeFieldInput:
                    "border border-input rounded-md text-foreground focus:border-primary",
                  alertText: "text-sm",
                  formFieldErrorText: "text-xs text-destructive",
                },
              }}
            />

            {/* Terms sits directly under the primary action — it belongs
                to the form, not floating between the form and unrelated
                content below it. */}
            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              By continuing you agree to our{" "}
              <Link
                href="/terms"
                className="text-primary underline hover:no-underline"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-primary underline hover:no-underline"
              >
                Privacy
              </Link>
              .
            </p>

            {/* Primary footer action — the "Create account" path that used
                to float orphaned at the top now lives here, directly under
                the form it relates to. */}
            <p className="mt-5 text-center text-[12.5px] text-muted-foreground">
              New here?{" "}
              <Link
                href="/sign-up"
                className="font-semibold text-primary hover:underline underline-offset-4"
              >
                Create an account →
              </Link>
            </p>

            {/* Invitee recovery hint, collapsed to one subtle line instead
                of a boxed slab — it's a secondary note, not a competing
                action. Content/link unchanged, just de-weighted visually.
                Clerk's "Couldn't find your account" message is a dead-end
                for invitees who arrive here instead of clicking the
                email's Accept Invitation button — they have a pending DB
                row but no Clerk account yet. */}
            <p className="mt-3 text-center text-[11px] text-muted-foreground leading-snug">
              Invited to {BRAND_NAME}? Use the{" "}
              <span className="font-medium text-foreground">
                Accept invitation
              </span>{" "}
              button in your email, or{" "}
              <Link
                href="/sign-up"
                className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
              >
                create an account
              </Link>{" "}
              with the same address.
            </p>
          </div>
        </div>

        <footer className="px-6 lg:px-10 py-4 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            &copy; {new Date().getFullYear()} {BRAND_NAME}
          </span>
          <a
            href="mailto:team@leasestack.co"
            className="hover:text-foreground"
          >
            team@leasestack.co
          </a>
        </footer>
      </main>

      {/* RIGHT: Animated platform showcase. Hidden on mobile (<lg) so
          the form gets the full screen without showcase noise.
          `lg:min-h-screen` mirrors the left column so both sides
          independently fill viewport height — even at low zoom levels
          where the natural content height would otherwise leave dead
          space below the dashboard mockup. */}
      <aside className="hidden lg:block flex-1 lg:min-h-screen relative">
        <PlatformShowcase />
      </aside>
    </div>
  );
}
