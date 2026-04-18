import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireScope } from "@/lib/tenancy/scope";
import { deriveSetupProgress } from "@/lib/setup/derive-progress";

// ---------------------------------------------------------------------------
// SetupBanner
//
// Compact progress banner shown on /portal. Links to /portal/setup. Hides
// itself automatically when all steps are done or the operator dismissed the
// onboarding. When force-shown via ?showSetup=1 on the dashboard, it still
// renders — mirrors the old OnboardingChecklist behaviour for the footer
// link that points operators back to setup.
// ---------------------------------------------------------------------------

export async function SetupBanner({
  forceShow = false,
}: {
  forceShow?: boolean;
}) {
  const scope = await requireScope();
  const progress = await deriveSetupProgress(scope.orgId);
  if (!progress) return null;

  const { completedCount, totalCount, org } = progress;
  const allDone = completedCount === totalCount;

  if (!forceShow && (allDone || org.onboardingDismissed)) {
    return null;
  }

  const percent = Math.round((completedCount / totalCount) * 100);

  return (
    <Link
      href="/portal/setup"
      className="group block rounded-[12px] border border-[var(--border-cream)] bg-[var(--ivory)] p-5 transition-colors duration-200 hover:border-[var(--terracotta)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--parchment)]"
      aria-label={`Continue setup — ${completedCount} of ${totalCount} steps complete`}
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-lg font-medium text-[var(--near-black)]">
              Setup
            </span>
            <span className="text-xs text-[var(--stone-gray)] tabular-nums">
              {completedCount} of {totalCount} complete
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-[var(--warm-sand)] overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-[var(--terracotta)] transition-all duration-700"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-[var(--terracotta)] px-4 py-2 text-sm font-medium text-white transition-colors duration-200 group-hover:bg-[var(--terracotta-hover)]">
          Continue setup
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
