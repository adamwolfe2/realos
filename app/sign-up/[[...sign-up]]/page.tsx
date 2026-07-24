import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { PlatformShowcase } from "@/components/auth/platform-showcase";

export const metadata: Metadata = {
  title: `Create account | ${BRAND_NAME}`,
  description: `Create your ${BRAND_NAME} account.`,
};

// Light validation — Clerk does the real check; we just prevent obvious
// junk from being passed into initialValues which would render
// 'undefined@undefined' style strings in the UI.
function isLikelyEmail(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.trim();
  return s.length > 3 && s.length < 200 && /.+@.+\..+/.test(s);
}

// Two-pane sign-up layout. LEFT = compact branded auth form. RIGHT =
// animated <PlatformShowcase /> (same component used on /sign-in).

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  // Pre-fill the email when invitees arrive via /sign-up?email=… (set by the
  // invite endpoint's fallback URL). Removes the "I have an invite but no
  // account" dead-end entirely — the email is already in the form so they
  // just pick a password and our /api/auth/role claims the pre-created
  // User row by email on first sign-in.
  const params = await searchParams;
  const prefillEmail = isLikelyEmail(params.email)
    ? params.email!.trim()
    : undefined;

  return (
    <div className="min-h-screen bg-white text-foreground flex flex-col lg:flex-row lg:items-stretch">
      {/* LEFT: Auth form. Thin brand-blue rail at the top reinforces the
          LeaseStack accent so the panel doesn't read as a generic stock
          template.

          Adam 2026-05-29: `lg:min-h-screen` makes each column fill the
          viewport height independently, so `justify-center` inside has
          space to center the form at any zoom level. Without it the
          column collapses to content height and the form sits at the
          top with dead space below at low zoom. */}
      <main className="w-full lg:w-[42%] xl:w-[38%] 2xl:w-[34%] lg:min-h-screen flex flex-col bg-white border-r border-border border-t-[3px] border-t-primary">
        {/* Adam 2026-07-24: mirrors /sign-in — header is logo-only, the
            "Sign in →" path now lives as a footer line under the primary
            action instead of floating orphaned next to the logo. */}
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
                Create account
              </p>
              <h1 className="font-sans text-[clamp(28px,3.4vw,36px)] font-bold tracking-[-0.025em] leading-[1.08] text-foreground">
                Start the pilot.
              </h1>
              <p className="mt-2 font-sans text-[14.5px] leading-[1.5] text-muted-foreground">
                Set up your {BRAND_NAME} operator portal in under a minute.
              </p>
            </div>

            {prefillEmail ? (
              <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="text-xs font-semibold text-blue-900">
                  Accepting an invitation
                </p>
                <p className="text-[11px] text-blue-900/80 mt-0.5 leading-snug">
                  Pick a password to finish creating your account for{" "}
                  <span className="font-mono">{prefillEmail}</span>. We&apos;ll
                  drop you into the right portal as soon as you sign up.
                </p>
              </div>
            ) : null}

            <SignUp
              // 2026-05-30 (Norman bug): force the redirect so an
              // invite-flow `?redirect_url=` (which Clerk sets to the
              // invite's stored URL) can't override our smart router.
              // Christine's invite was created when redirect_url pointed
              // at the bare-apex leasestack.co, which DNS-resolves to a
              // GoDaddy parking page — forcing the redirect routes her
              // through our app code instead.
              forceRedirectUrl="/auth/redirect"
              signInUrl="/sign-in"
              initialValues={
                prefillEmail ? { emailAddress: prefillEmail } : undefined
              }
              appearance={{
                layout: {
                  logoPlacement: "none",
                  socialButtonsVariant: "blockButton",
                },
                variables: {
                  // LeaseStack brand blue (#2563EB) drives Clerk's primary
                  // accents — Continue button, focus rings, footer links.
                  // Matches the marketing nav + pricing page so the auth
                  // surface doesn't look like a stock all-black template.
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

            {/* Terms directly under the primary action, matching /sign-in. */}
            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              By creating an account you agree to our{" "}
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

            {/* Primary footer action — the "Sign in" path that used to
                float orphaned at the top now lives here, directly under
                the form it relates to. */}
            <p className="mt-5 text-center text-[12.5px] text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/sign-in"
                className="font-semibold text-primary hover:underline underline-offset-4"
              >
                Sign in →
              </Link>
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

      {/* RIGHT: Animated platform showcase.
          `lg:min-h-screen` mirrors the left column so both sides
          independently fill viewport height — eliminates the dead
          space below the dashboard mockup at low zoom levels. */}
      <aside className="hidden lg:block flex-1 lg:min-h-screen relative">
        <PlatformShowcase />
      </aside>
    </div>
  );
}
