import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";

export function ReputationFallback({
  message,
  diagnostic,
}: {
  message: string;
  diagnostic?: {
    error: string;
    stack: string;
    metricsCount: number;
    feedCount: number;
  };
}) {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Brand health" title="Reputation" />
      <div className="rounded-[2px] border border-border bg-secondary px-4 py-3 text-sm text-foreground">
        <p className="font-semibold">
          Reputation view temporarily unavailable.
        </p>
        <p className="mt-1 text-xs leading-snug">{message}</p>
        <p className="mt-2 text-xs">
          You can still drill into reviews per property at{" "}
          <Link href="/portal/properties" className="underline font-medium">
            Properties
          </Link>{" "}
          → choose a property → Reputation tab.
        </p>
      </div>

      {/* Diagnostic block — surfaces the actual error so we can debug from
          a screenshot instead of round-tripping through Vercel logs. Gated to
          non-production so operators never see raw error/stack traces. */}
      {diagnostic && process.env.NODE_ENV !== "production" ? (
        <details
          open
          className="rounded-[2px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive"
        >
          <summary className="cursor-pointer font-semibold">
            Diagnostic — share with engineering
          </summary>
          <div className="mt-2 space-y-2">
            <div>
              <span className="font-semibold">Error: </span>
              <code className="font-mono break-all">{diagnostic.error}</code>
            </div>
            <div>
              <span className="font-semibold">Data: </span>
              <code className="font-mono">
                {diagnostic.metricsCount} mentions · {diagnostic.feedCount} feed
                items
              </code>
            </div>
            {diagnostic.stack ? (
              <div>
                <span className="font-semibold">Stack: </span>
                <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] font-mono opacity-80">
                  {diagnostic.stack}
                </pre>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
