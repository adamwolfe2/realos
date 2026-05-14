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
    <div className="min-h-screen bg-white text-foreground flex flex-col lg:flex-row">
      {/* LEFT: Auth form. Thin brand-blue rail at the top reinforces the
          LeaseStack accent so the panel doesn't read as a generic stock
          template. */}
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
            href="/sign-in"
            className="text-xs font-semibold text-[#2563EB] hover:underline underline-offset-4"
          >
            Sign in →
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
                Create account
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
                Start the pilot.
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
              fallbackRedirectUrl="/auth/redirect"
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
              By creating an account you agree to our{" "}
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

      {/* RIGHT: Animated platform showcase */}
      <aside className="hidden lg:block flex-1 relative">
        <PlatformShowcase />
      </aside>
    </div>
  );
}
