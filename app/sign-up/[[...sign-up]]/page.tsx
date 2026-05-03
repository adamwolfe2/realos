import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";

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
    body: "Resolved website visitors, Google reviews, Reddit mentions — all the brand signals worth acting on.",
  },
  {
    title: "Built for student-housing operators",
    body: "Purpose-built for university-adjacent properties, leasing seasons, and roommate matching workflows.",
  },
];

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-white text-foreground flex flex-col md:flex-row">
      <aside className="hidden md:flex md:w-[44%] lg:w-[40%] xl:w-[36%] flex-col justify-between p-12 bg-[#0A0A0A] text-white">
        <Link href="/" aria-label={BRAND_NAME} className="inline-flex items-center hover:opacity-90">
          <Image
            src="/logos/leasestack-wordmark.png"
            alt={BRAND_NAME}
            width={200}
            height={36}
            priority
            className="h-8 w-auto"
            style={{ filter: "invert(1)" }}
          />
        </Link>

        <div className="space-y-8 max-w-md">
          <div>
            <p className="text-[11px] tracking-[0.18em] uppercase font-semibold text-white/60">
              Real estate operator portal
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight">
              Marketing, leasing, and operations
              <br />
              in a single dashboard.
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

        <p className="text-[11px] text-white/50">
          &copy; {new Date().getFullYear()} {BRAND_NAME}
        </p>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="md:hidden px-6 py-5 border-b border-[#EEEEEE]">
          <Link
            href="/"
            aria-label={BRAND_NAME}
            className="inline-flex items-center hover:opacity-80 transition-opacity"
          >
            <Image
              src="/logos/leasestack-wordmark.png"
              alt={BRAND_NAME}
              width={150}
              height={28}
              priority
              className="h-7 w-auto"
            />
          </Link>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-1">
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
                elements: {
                  rootBox: "w-full",
                  card: "w-full shadow-none border border-[#EEEEEE] bg-white rounded-lg p-6",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton:
                    "border border-[#EEEEEE] bg-white hover:bg-[#F4F4F4] text-[#141413] text-sm font-medium rounded-md h-10 transition-colors",
                  dividerLine: "bg-[#EEEEEE]",
                  dividerText: "text-[#8E8E8E] text-xs",
                  formFieldLabel: "text-xs font-medium text-[#393C41] mb-1",
                  formFieldInput:
                    "border border-[#EEEEEE] bg-white focus:border-[#0A0A0A] focus:ring-0 rounded-md h-10 text-sm text-[#141413] placeholder:text-[#8E8E8E]",
                  formButtonPrimary:
                    "bg-[#0A0A0A] hover:bg-[#1f1f1f] text-white rounded-md h-10 text-sm font-semibold transition-colors",
                  footerActionLink:
                    "text-[#0A0A0A] font-semibold hover:underline underline-offset-2",
                  identityPreviewEditButton:
                    "text-[#0A0A0A] underline underline-offset-2",
                  otpCodeFieldInput:
                    "border border-[#EEEEEE] rounded-md text-[#141413]",
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

        <footer className="md:hidden px-6 py-4 border-t border-[#EEEEEE]">
          <p className="text-center text-[11px] text-muted-foreground">
            &copy; {new Date().getFullYear()} {BRAND_NAME}
          </p>
        </footer>
      </main>
    </div>
  );
}
