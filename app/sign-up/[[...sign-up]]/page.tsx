import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Create account | ${BRAND_NAME}`,
  description: `Create your ${BRAND_NAME} account.`,
};

export default function SignUpPage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#FFFFFF" }}
    >
      <header
        className="px-6 py-4"
        style={{ borderBottom: "1px solid #EEEEEE" }}
      >
        <Link
          href="/"
          className="inline-flex items-center hover:opacity-80 transition-opacity"
          style={{
            color: "#171A20",
            fontFamily: "var(--font-sans)",
            fontSize: "17px",
            fontWeight: 500,
          }}
        >
          {BRAND_NAME}
        </Link>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1
              className="mb-2"
              style={{
                color: "#171A20",
                fontFamily: "var(--font-sans)",
                fontSize: "28px",
                fontWeight: 500,
              }}
            >
              Create account
            </h1>
            <p
              style={{
                color: "#5C5E62",
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
              }}
            >
              Set up your operator account.
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
                card: "w-full shadow-none border border-[#EEEEEE] bg-white rounded-md p-6",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton:
                  "border border-[#EEEEEE] bg-white hover:bg-[#F4F4F4] text-[#171A20] text-sm font-medium rounded-md h-10 transition-colors",
                dividerLine: "bg-[#EEEEEE]",
                dividerText: "text-[#8E8E8E] text-xs",
                formFieldLabel: "text-xs font-medium text-[#393C41] mb-1",
                formFieldInput:
                  "border border-[#EEEEEE] bg-white focus:border-[#3E6AE1] focus:ring-0 rounded-md h-10 text-sm text-[#171A20] placeholder:text-[#8E8E8E]",
                formButtonPrimary:
                  "bg-[#3E6AE1] hover:bg-[#3457C8] text-white rounded-md h-10 text-sm font-medium transition-colors",
                footerActionLink:
                  "text-[#3E6AE1] hover:text-[#3457C8] underline underline-offset-2",
                identityPreviewEditButton:
                  "text-[#3E6AE1] underline underline-offset-2",
                otpCodeFieldInput: "border border-[#EEEEEE] rounded-md text-[#171A20]",
                alertText: "text-sm",
                formFieldErrorText: "text-xs text-[#b53333]",
              },
            }}
          />
        </div>
      </div>

      <footer
        className="px-6 py-3"
        style={{ borderTop: "1px solid #EEEEEE" }}
      >
        <p
          className="text-center"
          style={{
            color: "#8E8E8E",
            fontFamily: "var(--font-sans)",
            fontSize: "11px",
          }}
        >
          &copy; {new Date().getFullYear()} {BRAND_NAME}
        </p>
      </footer>
    </div>
  );
}
