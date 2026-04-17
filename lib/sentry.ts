import * as Sentry from "@sentry/nextjs";

/**
 * Capture an exception with user/org context for better Sentry debugging.
 */
export function captureWithContext(
  error: unknown,
  context?: {
    userId?: string;
    orgId?: string;
    [key: string]: unknown;
  }
) {
  Sentry.withScope((scope) => {
    if (context?.userId) scope.setUser({ id: context.userId });
    if (context?.orgId) scope.setTag("organizationId", context.orgId);
    if (context) {
      const { userId, orgId, ...extras } = context;
      scope.setExtras(extras);
    }
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
  });
}
