import { captureWithContext } from "@/lib/sentry";

/**
 * Drop-in `.catch` handler for reads that should degrade to a fallback
 * instead of failing the page, without hiding the failure:
 *
 *   prisma.lead.count(...).catch(soft(0, "portal.leads.total"))
 *
 * Logs and reports to Sentry, then returns the fallback.
 */
export function soft<T>(fallback: T, tag: string) {
  return (err: unknown): T => {
    console.error(`[soft:${tag}]`, err);
    captureWithContext(err, { softFallback: tag });
    return fallback;
  };
}
