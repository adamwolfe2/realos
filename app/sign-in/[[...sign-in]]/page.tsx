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
    <div className="min-h-screen bg-white text-foreground flex flex-col lg:flex-row">
      {/* LEFT: Auth form. Narrow column on desktop so the showcase
          dominates the visible canvas. Brand-blue rail at top mirrors
          the LeaseStack accent. */}
      <main className="w-full lg:w-[42%] xl:w-[38%] 2xl:w-[34%] flex flex-col bg-white border-r border-[#EEEEEE] border-t-[3px] border-t-[#2563EB]">
        <header className="px-6 lg:px-10 py-5 lg:py-6 flex items-center justify-between">
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
          <Link
            href="/sign-up"
            className="text-xs font-semibold text-[#2563EB] hover:underline underline-offset-4"
          >
            Create account →
          </Link>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-6 lg:px-10 py-10">
          <div className="w-full max-w-[420px]">
            <div className="mb-7">
              <p
                className="mb-3 inline-flex items-center gap-1.5"
                style={{
                  color: "#2563EB",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                Sign in
              </p>
              <h1
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-sans)",
                  fontSize: "clamp(28px, 3.4vw, 36px)",
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                  lineHeight: 1.08,
                }}
              >
                Welcome back.
              </h1>
              <p
                className="mt-2"
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14.5px",
                  lineHeight: 1.5,
                }}
              >
                Sign in to your {BRAND_NAME} portal.
              </p>
            </div>

            <SignIn
              fallbackRedirectUrl="/auth/redirect"
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
                  card: "w-full shadow-none border border-[#E5E5E5] bg-white rounded-xl p-7",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton:
                    "border border-[#E5E5E5] bg-white hover:bg-[#F7F7F7] text-foreground text-sm font-medium rounded-md h-11 transition-colors",
                  dividerLine: "bg-[#EEEEEE]",
                  dividerText:
                    "text-[#8E8E8E] text-xs uppercase tracking-wider",
                  formFieldLabel:
                    "text-[11px] font-semibold text-[#393C41] mb-1.5 uppercase tracking-wider",
                  formFieldInput:
                    "border border-[#D4D4D4] bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:outline-none rounded-md h-11 text-sm text-foreground placeholder:text-[#8E8E8E] transition-colors",
                  formButtonPrimary:
                    "!bg-[#2563EB] hover:!bg-[#1d4ed8] !text-white !shadow-none !border-0 rounded-md h-11 text-sm font-semibold transition-colors",
                  footerActionLink:
                    "!text-[#2563EB] font-semibold hover:underline underline-offset-2",
                  identityPreviewEditButton:
                    "!text-[#2563EB] underline underline-offset-2",
                  otpCodeFieldInput:
                    "border border-[#D4D4D4] rounded-md text-foreground focus:border-[#2563EB]",
                  alertText: "text-sm",
                  formFieldErrorText: "text-xs text-[#DC2626]",
                },
              }}
            />

            <p className="mt-5 text-center text-[11px] text-muted-foreground">
              By continuing you agree to our{" "}
              <Link
                href="/terms"
                className="text-[#2563EB] underline hover:no-underline"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-[#2563EB] underline hover:no-underline"
              >
                Privacy
              </Link>
              .
            </p>

            {/* Invitee recovery hint. Clerk's "Couldn't find your account"
                message is a dead-end for invitees who arrive here instead
                of clicking the email's Accept Invitation button — they
                have a pending DB row but no Clerk account yet. */}
            <div className="mt-5 rounded-lg border border-[#EEEEEE] bg-[#F9F9F9] px-4 py-3">
              <p className="text-xs font-semibold text-foreground">
                Were you invited to {BRAND_NAME}?
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                Click the{" "}
                <span className="font-semibold">Accept invitation</span>{" "}
                button in your invitation email — or{" "}
                <Link
                  href="/sign-up"
                  className="font-semibold text-foreground underline underline-offset-2 hover:no-underline"
                >
                  create an account
                </Link>{" "}
                with the same email. We&apos;ll route you to the right portal
                automatically.
              </p>
            </div>
          </div>
        </div>

        <footer className="px-6 lg:px-10 py-4 border-t border-[#EEEEEE] flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            &copy; {new Date().getFullYear()} {BRAND_NAME}
          </span>
          <a
            href="mailto:hello@leasestack.co"
            className="hover:text-foreground"
          >
            hello@leasestack.co
          </a>
        </footer>
      </main>

      {/* RIGHT: Animated platform showcase. Hidden on mobile (<lg) so
          the form gets the full screen without showcase noise. */}
      <aside className="hidden lg:block flex-1 relative">
        <PlatformShowcase />
      </aside>
    </div>
  );
}
