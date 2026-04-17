import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: { template: `%s | ${BRAND_NAME} Portal`, default: `${BRAND_NAME} Portal` },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Client portal shell.
// - Requires authentication (middleware redirects unauthenticated visitors
//   to /sign-in before this layout runs).
// - Agency impersonators land here via requireAgency() + startImpersonation();
//   the layout surfaces an "Impersonating {org}" banner so we never forget.
// - Portal-specific nav + structure is filled in by Sprint 05.
// ---------------------------------------------------------------------------

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const scope = await getScope();
  if (!scope) redirect("/sign-in");

  // Pull the effective org so we can brand the shell.
  const org = await prisma.organization.findUnique({
    where: { id: scope.orgId },
    select: { id: true, name: true, slug: true, orgType: true, logoUrl: true },
  });

  // Agency users without an impersonation target shouldn't see the portal.
  // Redirect them to /admin so they don't get confused.
  if (scope.isAgency && !scope.isImpersonating) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      {scope.isImpersonating ? (
        <div
          role="status"
          className="bg-amber-100 border-b border-amber-300 text-amber-900 text-xs md:text-sm px-4 py-2 flex items-center justify-between gap-3"
        >
          <span>
            Impersonating {org?.name ?? "tenant"}. Changes are attributed to
            you in the audit log.
          </span>
          <form action="/api/admin/impersonate/end" method="post">
            <button
              type="submit"
              className="underline underline-offset-2 font-medium"
            >
              End impersonation
            </button>
          </form>
        </div>
      ) : null}
      <header className="border-b border-shell px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/portal" className="font-serif font-bold text-lg">
            {BRAND_NAME}
          </Link>
          {org ? (
            <span className="hidden md:inline text-xs opacity-60">
              {org.name}
            </span>
          ) : null}
        </div>
        <UserButton />
      </header>
      <main id="main-content" className="flex-1 p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
