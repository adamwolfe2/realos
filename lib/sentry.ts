import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

/**
 * Capture an exception with user/org context for better Sentry debugging.
 */
export function captureWithContext(
  error: unknown,
  context?: {
    userId?: string;
    orgId?: string;
    [key: string]: unknown;
  },
) {
  Sentry.withScope((scope) => {
    if (context?.userId) scope.setUser({ id: context.userId });
    if (context?.orgId) scope.setTag("organizationId", context.orgId);
    if (context) {
      const { userId, orgId, ...extras } = context;
      scope.setExtras(extras);
    }
    Sentry.captureException(
      error instanceof Error ? error : new Error(String(error)),
    );
  });
}

/**
 * Wraps an API route handler. Catches uncaught exceptions, logs to Sentry
 * with route + tenant context, and returns a clean 500 response so we never
 * leak stack traces in production. Use as:
 *
 *   export const GET = withApiSentry("get-leads", async (req) => { ... });
 *
 * The route name shows up as a Sentry tag for grouping.
 */
export function withApiSentry<
  TArgs extends unknown[],
  TReturn extends Response | NextResponse,
>(
  routeName: string,
  handler: (...args: TArgs) => Promise<TReturn>,
): (...args: TArgs) => Promise<TReturn | NextResponse> {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (err) {
      captureWithContext(err, { route: routeName });
      // eslint-disable-next-line no-console
      console.error(`[api:${routeName}]`, err);
      return NextResponse.json(
        {
          error: "Internal server error",
          requestId: crypto.randomUUID?.() ?? null,
        },
        { status: 500 },
      ) as NextResponse;
    }
  };
}
