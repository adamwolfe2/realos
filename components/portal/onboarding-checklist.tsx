import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { dismissOnboarding } from "@/lib/actions/onboarding";

// ---------------------------------------------------------------------------
// First-login onboarding checklist for the client portal.
//
// Renders above the dashboard stats on /portal. Each step's "done" status is
// derived from existing data (no extra columns). Once the operator dismisses
// the card or all 4 steps are complete, the component returns null — unless
// ?showSetup=1 is present, which forces it to render so they can revisit.
// ---------------------------------------------------------------------------

type Step = {
  key: "appfolio" | "cursive" | "chatbot" | "team";
  title: string;
  description: string;
  href: string;
  done: boolean;
};

export async function OnboardingChecklist({
  showSetup = false,
}: {
  showSetup?: boolean;
}) {
  const scope = await requireScope();

  const [org, userCount] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: {
        onboardingDismissed: true,
        appfolioIntegration: { select: { lastSyncAt: true } },
        cursiveIntegration: {
          select: { cursivePixelId: true, lastEventAt: true },
        },
        tenantSiteConfig: { select: { chatbotEnabled: true } },
      },
    }),
    prisma.user.count({ where: { orgId: scope.orgId } }),
  ]);

  if (!org) return null;

  const steps: Step[] = [
    {
      key: "appfolio",
      title: "Connect AppFolio",
      description:
        "Sync properties, units, and availability from your AppFolio instance.",
      href: "/portal/settings/integrations",
      done: org.appfolioIntegration?.lastSyncAt != null,
    },
    {
      key: "cursive",
      title: "Install the Cursive pixel",
      description:
        "Drop the visitor-identification script on your site and confirm events flow in.",
      href: "/portal/settings/integrations",
      done:
        org.cursiveIntegration?.cursivePixelId != null &&
        org.cursiveIntegration?.lastEventAt != null,
    },
    {
      key: "chatbot",
      title: "Configure the chatbot",
      description:
        "Set your persona, knowledge base, and capture behavior, then turn it on.",
      href: "/portal/chatbot",
      done: org.tenantSiteConfig?.chatbotEnabled === true,
    },
    {
      key: "team",
      title: "Invite your team",
      description:
        "Add teammates so leads, tours, and conversations don't pile up on one inbox.",
      href: "/portal/settings",
      done: userCount > 1,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = completed === total;

  // Hidden unless the operator explicitly asked to see it.
  if ((org.onboardingDismissed || allDone) && !showSetup) {
    return null;
  }

  async function handleDismiss() {
    "use server";
    await dismissOnboarding();
  }

  return (
    <section className="border rounded-md p-5" aria-labelledby="onboarding-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="onboarding-heading"
            className="font-serif text-xl font-bold"
          >
            Welcome to RealEstaite
          </h2>
          <p className="text-xs opacity-60 mt-1">
            A few quick steps to get your stack connected.
          </p>
        </div>
        <form action={handleDismiss}>
          <button
            type="submit"
            className="text-xs underline opacity-60 hover:opacity-100"
          >
            Hide this
          </button>
        </form>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs opacity-70 tabular-nums">
            {completed} of {total} complete
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded overflow-hidden" aria-hidden="true">
          <div
            className="h-full bg-foreground transition-all"
            style={{ width: `${(completed / total) * 100}%` }}
          />
        </div>
      </div>

      <ul className="mt-5 divide-y">
        {steps.map((step) => (
          <li
            key={step.key}
            className="py-3 flex items-start gap-3"
          >
            <span
              className="shrink-0 mt-0.5"
              aria-label={step.done ? "Complete" : "Not complete"}
            >
              {step.done ? (
                <CheckCircle2 className="w-5 h-5 text-foreground" />
              ) : (
                <Circle className="w-5 h-5 opacity-40" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className={
                  step.done
                    ? "text-sm font-medium line-through opacity-50"
                    : "text-sm font-medium"
                }
              >
                {step.title}
              </div>
              <div className="text-xs opacity-60 mt-0.5">
                {step.description}
              </div>
            </div>
            {!step.done ? (
              <Link
                href={step.href}
                className="shrink-0 inline-flex items-center gap-1 text-xs underline opacity-80 hover:opacity-100 whitespace-nowrap"
              >
                Do this
                <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            ) : null}
          </li>
        ))}
      </ul>

      {completed === 0 ? (
        <p className="mt-4 text-xs opacity-60">
          Not sure where to start?{" "}
          <a
            href="mailto:adam@realestaite.co"
            className="underline hover:opacity-100"
          >
            Book a setup call
          </a>
        </p>
      ) : null}
    </section>
  );
}
