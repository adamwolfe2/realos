import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { LeaseStackWordmark } from "@/components/brand/leasestack-wordmark";

export const metadata: Metadata = {
  title: `Create account | ${BRAND_NAME}`,
  description: `Create your ${BRAND_NAME} account.`,
};

const VALUE_PROPS = [
  {
    title: "Operations dashboard, mirrored from AppFolio",
    body: "Residents, renewals, work orders, and rent roll surfaced beside leads, tours, and applications.",
  },
  {
    title: "Visitor identification + reputation in one place",
    body: "Resolved website visitors, Google reviews, Reddit mentions — every brand signal worth acting on.",
  },
  {
    title: "Built for student-housing operators",
    body: "Purpose-built for university-adjacent properties, leasing seasons, and roommate-matching workflows.",
  },
];

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-white text-foreground flex flex-col md:flex-row">
      <aside className="hidden md:flex md:w-[44%] lg:w-[40%] xl:w-[36%] flex-col justify-between p-12 bg-[#0A0A0A] text-white">
        <Link
          href="/"
          aria-label={BRAND_NAME}
          className="inline-flex hover:opacity-90 transition-opacity"
        >
          <LeaseStackWordmark tone="light" className="text-[20px]" />
        </Link>

        <div className="space-y-8 max-w-md">
          <div>
            <p className="text-[11px] tracking-[0.18em] uppercase font-semibold text-white/55">
              Real estate operator portal
            </p>
            <h2
              className="mt-3 text-[34px] leading-[1.1] font-semibold tracking-tight"
              style={{
                fontFamily:
                  "var(--font-fraunces, Georgia, 'Times New Roman', serif)",
              }}
            >
              Marketing, leasing, and
              <br />
              operations in a single
              <br />
              dashboard.
            </h2>
          </div>

          <ul className="space-y-5">
            {VALUE_PROPS.map((vp) => (
              <li key={vp.title} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/70 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">{vp.title}</p>
                  <p className="text-xs text-white/65 mt-0.5 leading-relaxed">
                    {vp.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-white/45 tracking-wide">
          &copy; {new Date().getFullYear()} {BRAND_NAME}
        </p>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="px-6 md:px-10 py-5 md:py-6 border-b border-[#EEEEEE] flex items-center justify-between">
          <Link
            href="/"
            aria-label={BRAND_NAME}
            className="inline-flex hover:opacity-80 transition-opacity"
          >
            <LeaseStackWordmark tone="dark" className="text-[18px]" />
          </Link>
          <Link
            href="/sign-in"
            className="text-xs font-semibold text-foreground hover:underline underline-offset-4"
          >
            Sign in →
          </Link>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-[420px]">
            <div className="mb-8">
              <h1
                className="text-[32px] leading-tight font-semibold tracking-tight text-foreground mb-2"
                style={{
                  fontFamily:
                    "var(--font-fraunces, Georgia, 'Times New Roman', serif)",
                }}
              >
                Create your account
              </h1>
              <p className="text-sm text-muted-foreground">
                Set up your {BRAND_NAME} operator portal in under a minute.
              </p>
            </div>

            <SignUp
              fallbackRedirectUrl="/auth/redirect"
              signInUrl="/sign-in"
              appearance={{
                layout: {
                  logoPlacement: "none",
                  socialButtonsVariant: "blockButton",
                },
                variables: {
                  colorPrimary: "#0A0A0A",
                  colorText: "#0A0A0A",
                  colorTextSecondary: "#5C5E62",
                  colorBackground: "#FFFFFF",
                  colorInputBackground: "#FFFFFF",
                  colorInputText: "#0A0A0A",
                  colorDanger: "#b53333",
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
                  dividerText: "text-[#8E8E8E] text-xs uppercase tracking-wider",
                  formFieldLabel:
                    "text-[11px] font-semibold text-[#393C41] mb-1.5 uppercase tracking-wider",
                  formFieldInput:
                    "border border-[#D4D4D4] bg-white focus:border-[#0A0A0A] focus:ring-2 focus:ring-[#0A0A0A]/10 focus:outline-none rounded-md h-11 text-sm text-foreground placeholder:text-[#8E8E8E] transition-colors",
                  formButtonPrimary:
                    "!bg-[#0A0A0A] hover:!bg-[#1f1f1f] !text-white !shadow-none !border-0 rounded-md h-11 text-sm font-semibold transition-colors",
                  footerActionLink:
                    "text-foreground font-semibold hover:underline underline-offset-2",
                  identityPreviewEditButton:
                    "text-foreground underline underline-offset-2",
                  otpCodeFieldInput:
                    "border border-[#D4D4D4] rounded-md text-foreground",
                  alertText: "text-sm",
                  formFieldErrorText: "text-xs text-[#b53333]",
                },
              }}
            />

            <p className="mt-6 text-center text-[11px] text-muted-foreground">
              By creating an account you agree to our{" "}
              <Link href="/terms" className="underline hover:text-foreground">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline hover:text-foreground">
                Privacy
              </Link>
              .
            </p>
          </div>
        </div>

        <footer className="px-6 md:px-10 py-4 border-t border-[#EEEEEE] flex items-center justify-between text-[11px] text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} {BRAND_NAME}</span>
          <a
            href="mailto:hello@leasestack.co"
            className="hover:text-foreground"
          >
            hello@leasestack.co
          </a>
        </footer>
      </main>
    </div>
  );
}
