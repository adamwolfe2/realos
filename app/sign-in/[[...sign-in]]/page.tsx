import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | Wholesail",
  description: "Sign in to your Wholesail account.",
};

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Header */}
      <header className="border-b border-shell px-6 py-4">
        <Link
          href="/"
          className="font-serif font-bold text-xl text-ink tracking-tight hover:opacity-70 transition-opacity"
        >
          Wholesail
        </Link>
      </header>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="mb-8 text-center">
            <h1 className="font-serif text-3xl font-normal text-ink mb-2">
              Sign in
            </h1>
            <p className="text-sm text-ink/50">
              Welcome back. You&apos;ll be routed to your portal automatically.
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
              elements: {
                rootBox: "w-full",
                card: "w-full shadow-none border border-shell bg-white rounded-none p-6",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton:
                  "border border-shell bg-white hover:bg-cream text-ink text-sm font-normal rounded-none h-10 transition-colors",
                dividerLine: "bg-shell",
                dividerText: "text-ink/40 text-xs",
                formFieldLabel: "text-xs font-medium text-ink/70 mb-1",
                formFieldInput:
                  "border border-shell bg-white focus:border-ink focus:ring-0 rounded-none h-10 text-sm text-ink placeholder:text-ink/30",
                formButtonPrimary:
                  "bg-ink hover:bg-ink/80 text-cream rounded-none h-10 text-sm font-medium transition-colors",
                footerActionLink: "text-ink underline underline-offset-2 hover:opacity-70",
                identityPreviewEditButton: "text-ink underline underline-offset-2",
                otpCodeFieldInput: "border border-shell rounded-none text-ink",
                alertText: "text-sm",
                formFieldErrorText: "text-xs text-red-600",
              },
            }}
          />

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-ink/40">
            Not a partner yet?{" "}
            <Link href="/partner" className="text-ink underline underline-offset-2 hover:opacity-70">
              Apply for wholesale access
            </Link>
          </p>
        </div>
      </div>

      {/* Bottom strip */}
      <footer className="border-t border-shell px-6 py-3">
        <p className="text-[11px] text-ink/30 text-center">
          Wholesail &mdash; Wholesale Portal
        </p>
      </footer>
    </div>
  );
}
