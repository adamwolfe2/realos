// ---------------------------------------------------------------------------
// PropertyAccessDeniedBanner
//
// Rendered on every portal page that gates by property when the URL is
// requesting a property the current user has no access to. Without this
// banner, a restricted user who clicks a stale link or hand-types a
// `?properties=<id>` value sits in front of a blank page and assumes
// the app is broken — when really the access gate is working as designed.
//
// Pages compose this with `isAccessDenied(scope, propertyIds)` from
// lib/tenancy/property-filter.ts:
//
//   const denied = isAccessDenied(scope, propertyIds);
//   ...
//   {denied ? <PropertyAccessDeniedBanner /> : null}
//
// The banner is purely informational — pages should still render their
// normal (empty) state below it so navigation works. Click the link to
// reset the URL to the user's allowed default view.
// ---------------------------------------------------------------------------

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export function PropertyAccessDeniedBanner({
  pathname,
}: {
  /**
   * Route to clear the property filter against. Pass the current
   * pathname so the link bounces back to the same page minus the
   * `?properties=` selection. Defaults to `/portal` if omitted.
   */
  pathname?: string;
}) {
  const resetHref = pathname ?? "/portal";
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
      <ShieldAlert
        className="h-4 w-4 text-amber-700 mt-0.5 shrink-0"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-900 leading-tight">
          You don&apos;t have access to that property.
        </p>
        <p className="text-xs text-amber-800 mt-0.5 leading-snug">
          Your account is restricted to a subset of properties for this
          organization. Contact your account owner if you believe this is
          a mistake.{" "}
          <Link
            href={resetHref}
            className="underline underline-offset-2 hover:text-amber-900"
          >
            Show your properties
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
