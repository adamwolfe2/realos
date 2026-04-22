import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  Database,
  Facebook,
  LineChart,
  Lock,
  LogIn,
  Mail,
  Palette,
  Radar,
  Search,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ResolvedSetupStep } from "@/lib/setup/derive-progress";

// ---------------------------------------------------------------------------
// Setup step card. One row of the Setup Hub timeline.
//
// Status dot (done / current / pending / locked) + card (icon, title, badge,
// time chip, description, CTA). Locked cards swap the CTA for an upgrade
// prompt and get a subtle opacity reduction. Done cards stay full-opacity —
// they should feel proud, not faded. The status dot rail is hidden on mobile
// (stacked cards only) to reduce visual noise at 375px.
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  LogIn,
  Database,
  Radar,
  Bot,
  Users,
  Search,
  Facebook,
  LineChart,
  Palette,
  Mail,
};

function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? LogIn;
}

type Props = {
  step: ResolvedSetupStep;
};

export function SetupStepCard({ step }: Props) {
  const Icon = resolveIcon(step.icon);
  const isLocked = step.status === "locked";
  const isDone = step.status === "done";
  const isCurrent = step.status === "current";

  return (
    <div className="relative flex items-stretch gap-4 md:gap-5">
      {/* Status dot — sits on the vertical rail. Hidden on mobile. */}
      <div
        className="hidden md:flex shrink-0 w-5 pt-5 justify-center"
        aria-hidden="true"
      >
        <StatusDot status={step.status} />
      </div>

      {/* Card */}
      <div
        className={[
          "flex-1 rounded-[12px] border p-5 transition-colors duration-200",
          isLocked
            ? "border-border bg-card opacity-60 cursor-not-allowed"
            : "border-border bg-card hover:border-primary/40",
          isDone ? "opacity-100" : "",
        ].join(" ")}
      >
        <div className="flex items-start gap-4">
          <IconTile Icon={Icon} status={step.status} imageSrc={step.id === "cursive" ? "/logos/cursive-logo.png" : undefined} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-lg font-medium text-foreground leading-tight">
                {step.title}
              </h3>
              <StatusBadge status={step.status} lockedLabel={step.lockedLabel} />
              <span className="ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-muted text-foreground">
                {step.estimateMinutes === 0
                  ? "Instant"
                  : `${step.estimateMinutes} min`}
              </span>
            </div>

            <p className="mt-1.5 font-sans text-sm text-muted-foreground leading-[1.6]">
              {step.description}
            </p>

            <StepAction step={step} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Status dot ──────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ResolvedSetupStep["status"] }) {
  if (status === "done") {
    return (
      <span className="relative z-10 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-[0_0_0_3px_hsl(var(--background))]">
        <Check className="w-3 h-3 text-white" aria-hidden="true" />
      </span>
    );
  }
  if (status === "current") {
    return (
      <span className="relative z-10 w-5 h-5 rounded-full ring-2 ring-primary ring-offset-2 ring-offset-background bg-card animate-pulse" />
    );
  }
  if (status === "locked") {
    return (
      <span className="relative z-10 w-5 h-5 rounded-full bg-muted flex items-center justify-center shadow-[0_0_0_3px_hsl(var(--background))]">
        <Lock className="w-2.5 h-2.5 text-muted-foreground" aria-hidden="true" />
      </span>
    );
  }
  // pending
  return (
    <span className="relative z-10 w-5 h-5 rounded-full border-2 border-border bg-card shadow-[0_0_0_3px_hsl(var(--background))]" />
  );
}

// ── Icon tile (coloured square next to title row) ──────────────────────────

function IconTile({
  Icon,
  status,
  imageSrc,
}: {
  Icon: LucideIcon;
  status: ResolvedSetupStep["status"];
  imageSrc?: string;
}) {
  const tone =
    status === "done"
      ? "bg-primary/10 text-primary"
      : status === "current"
      ? "bg-primary/15 text-primary"
      : status === "locked"
      ? "bg-muted text-muted-foreground"
      : "bg-muted text-foreground";

  if (imageSrc) {
    return (
      <span
        className="shrink-0 w-8 h-8 rounded-[10px] flex items-center justify-center bg-white border border-border overflow-hidden p-1"
        aria-hidden="true"
      >
        <Image src={imageSrc} alt="" width={48} height={20} className="w-full h-auto object-contain" unoptimized />
      </span>
    );
  }

  return (
    <span
      className={`shrink-0 w-8 h-8 rounded-[10px] flex items-center justify-center ${tone}`}
      aria-hidden="true"
    >
      <Icon className="w-4 h-4" />
    </span>
  );
}

// ── Inline status badge (next to the title) ────────────────────────────────

function StatusBadge({
  status,
  lockedLabel,
}: {
  status: ResolvedSetupStep["status"];
  lockedLabel?: string;
}) {
  if (status === "pending") return null;

  if (status === "done") {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-primary/10 text-primary">
        Done
      </span>
    );
  }

  if (status === "current") {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-primary/15 text-primary">
        Up next
      </span>
    );
  }

  // locked
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground">
      {lockedLabel ?? "Coming soon"}
    </span>
  );
}

// ── Action row (CTA button or upgrade link) ────────────────────────────────

function StepAction({ step }: { step: ResolvedSetupStep }) {
  if (step.status === "done") return null;
  if (step.hideAction) return null;

  if (step.status === "locked") {
    const tier = step.lockedLabel?.replace(" required", "") ?? "a higher plan";
    return (
      <div className="mt-4">
        <span className="inline-flex items-center gap-1.5 font-sans text-sm text-muted-foreground">
          Upgrade to {tier} to unlock
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <Link
        href={step.actionHref}
        className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[hsl(var(--primary)/0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {step.actionLabel}
        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
