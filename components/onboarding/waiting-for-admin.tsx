import Link from "next/link";
import { Clock } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import { BRAND_NAME } from "@/lib/brand";

// Shown on /onboarding to a viewer or leasing agent invited into an org whose
// owner/admin hasn't finished setup. The wizard API 403s non-admin seats
// (AUTHZ-WIZ) and the portal layout bounces every seat here until setup is
// done, so without this screen they'd sit on a wizard that can't save.
export function WaitingForAdmin({
  orgName,
  adminName,
}: {
  orgName: string;
  adminName: string | null;
}) {
  return (
    <div
      style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}
      className="flex items-center justify-center px-4"
    >
      <div
        className="w-full max-w-[480px] rounded-[2px] p-6 sm:p-8"
        style={{
          backgroundColor: "var(--color-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        <Clock
          className="w-5 h-5 mb-4"
          strokeWidth={1.75}
          style={{ color: "var(--color-muted-foreground)" }}
          aria-hidden="true"
        />
        <h1
          style={{
            color: "var(--color-foreground)",
            fontSize: "20px",
            fontWeight: 600,
            letterSpacing: "-0.012em",
          }}
        >
          Waiting for your admin
        </h1>
        <p
          className="mt-2"
          style={{ color: "var(--color-muted-foreground)", fontSize: "14px", lineHeight: 1.55 }}
        >
          {adminName ?? "An owner or admin"} is still setting up {orgName} on{" "}
          {BRAND_NAME}. You&apos;ll get access as soon as setup is finished.
          Nothing to do on your side.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link href="/portal" className="btn-primary">
            Check again
          </Link>
          <SignOutButton redirectUrl="/">
            <button type="button" className="btn-secondary">
              Sign out
            </button>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
}
