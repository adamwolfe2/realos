// ---------------------------------------------------------------------------
// Property-level RBAC for ClientReport. ONE guard for every surface that
// reads or mutates a report (server actions, the detail page, the [id] API
// route, POST /api/portal/reports) so the create-path gate can never drift
// from its siblings.
//
// Rules for a restricted scope (allowedPropertyIds non-null):
//   - org-wide reports (propertyId null) are admin surface → denied. The
//     snapshot rolls up every property and the shareToken makes it
//     world-readable, so a restricted user must not view, share, email,
//     archive, or generate one.
//   - per-property reports are accessible only for granted property ids.
//
// Agency and impersonation scopes always resolve allowedPropertyIds=null
// (lib/tenancy/scope.ts), so they are never gated here.
// ---------------------------------------------------------------------------

// Shared with POST /api/portal/reports so the two user-facing messages
// cannot drift.
export const REPORT_PORTFOLIO_ACCESS_ERROR =
  "Report generation requires portfolio-wide access. Ask an admin to remove the property restriction on your account.";

export function canAccessReport(
  scope: { allowedPropertyIds: string[] | null },
  reportPropertyId: string | null,
): boolean {
  if (!scope.allowedPropertyIds) return true;
  return (
    reportPropertyId !== null &&
    scope.allowedPropertyIds.includes(reportPropertyId)
  );
}

// ---------------------------------------------------------------------------
// Draft-status gate. lib/actions/reports.ts documents "operator review is
// mandatory so nothing here ever auto-sends" — a real CLIENT_* user must
// never see a report before an operator has reviewed it and flipped it to
// "shared". Agency scopes (the operators doing that review) and impersonating
// scopes (an agency user supporting a client) keep full visibility, same as
// the property gate above.
// ---------------------------------------------------------------------------

export function isReportStatusRestricted(scope: {
  isAgency: boolean;
  isImpersonating: boolean;
}): boolean {
  return !scope.isAgency && !scope.isImpersonating;
}
