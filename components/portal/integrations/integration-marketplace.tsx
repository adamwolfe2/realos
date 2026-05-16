"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CATEGORY_LABEL,
  INTEGRATIONS,
  type IntegrationCategory,
  type IntegrationDefinition,
} from "@/lib/integrations/catalog";
import type {
  IntegrationState,
  IntegrationStatus,
} from "@/lib/integrations/status";
import { IntegrationTile } from "./integration-tile";
import { IntegrationIcon } from "./integration-icon";
import { RequestActivationButton } from "./request-activation-button";
import { cn } from "@/lib/utils";

type Filter = "all" | "installed" | IntegrationCategory;

export function IntegrationMarketplace({
  statuses,
  manageSlots,
}: {
  statuses: IntegrationStatus[];
  // Slot content for integrations that have a dedicated "Manage" UI. The page
  // renders the existing server components (ConnectPixelForm, ConnectAppfolioForm,
  // etc.) and passes them in by slug. The drawer just embeds whatever we pass.
  manageSlots: Record<string, React.ReactNode>;
}) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [openSlug, setOpenSlug] = React.useState<string | null>(null);

  const byStatus = React.useMemo(() => {
    const m = new Map<string, IntegrationState>();
    for (const s of statuses) m.set(s.slug, s.state);
    return m;
  }, [statuses]);

  const LIVE = React.useMemo(() => INTEGRATIONS.filter((i) => !i.comingSoon), []);

  const filtered = React.useMemo(() => {
    if (filter === "all") return LIVE;
    if (filter === "installed") {
      // Only true 'connected' integrations count as installed. 'managed'
      // means provisioning-in-progress and 'plan_locked' means upgrade
      // required — neither is actually installed.
      return LIVE.filter((i) => byStatus.get(i.slug) === "connected");
    }
    return LIVE.filter((i) => i.category === filter);
  }, [filter, byStatus, LIVE]);

  const installedCount = LIVE.filter(
    (i) => byStatus.get(i.slug) === "connected"
  ).length;

  const openDef = openSlug ? LIVE.find((i) => i.slug === openSlug) : null;
  const openState = openDef ? byStatus.get(openDef.slug) ?? "available" : null;

  return (
    <>
      <nav
        className="flex flex-wrap gap-1.5 -mx-0.5"
        aria-label="Filter integrations"
      >
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
          count={LIVE.length}
        />
        <FilterChip
          active={filter === "installed"}
          onClick={() => setFilter("installed")}
          label="Installed"
          count={installedCount}
        />
        {(Object.keys(CATEGORY_LABEL) as IntegrationCategory[]).filter((cat) =>
          LIVE.some((i) => i.category === cat)
        ).map((cat) => (
          <FilterChip
            key={cat}
            active={filter === cat}
            onClick={() => setFilter(cat)}
            label={CATEGORY_LABEL[cat]}
          />
        ))}
      </nav>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((def) => (
          <IntegrationTile
            key={def.slug}
            def={def}
            state={byStatus.get(def.slug) ?? "available"}
            onOpen={setOpenSlug}
          />
        ))}
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No integrations match this filter.
            </p>
          </div>
        ) : null}
      </section>

      <Sheet
        open={!!openDef}
        onOpenChange={(v) => {
          if (!v) setOpenSlug(null);
        }}
      >
        <SheetContent className="sm:max-w-[520px] overflow-y-auto">
          {openDef && openState ? (
            <IntegrationDrawerBody
              def={openDef}
              state={openState}
              manageSlot={manageSlots[openDef.slug] ?? null}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground border-border hover:bg-muted/50",
      )}
    >
      {label}
      {count != null ? (
        <span
          className={cn(
            "ml-1.5 tabular-nums text-[11px]",
            active ? "opacity-80" : "text-muted-foreground",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function IntegrationDrawerBody({
  def,
  state,
  manageSlot,
}: {
  def: IntegrationDefinition;
  state: IntegrationState;
  manageSlot: React.ReactNode;
}) {
  return (
    <>
      <SheetHeader className="gap-4">
        <div className="flex items-start gap-3">
          <IntegrationIcon def={def} size="lg" />
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-lg">{def.name}</SheetTitle>
            <SheetDescription className="text-xs mt-0.5">
              {CATEGORY_LABEL[def.category]}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="px-4 pb-4 space-y-6">
        <p className="text-sm text-foreground leading-relaxed">
          {def.description}
        </p>

        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <h4 className="text-xs font-semibold text-foreground mb-2">
            What lands in your portal
          </h4>
          <ul className="flex flex-wrap gap-1.5">
            {def.landsIn.map((item) => (
              <li
                key={item}
                className="rounded-full bg-card border border-border px-2 py-0.5 text-[11px] text-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <DrawerAction def={def} state={state} manageSlot={manageSlot} />
      </div>
    </>
  );
}

function DrawerAction({
  def,
  state,
  manageSlot,
}: {
  def: IntegrationDefinition;
  state: IntegrationState;
  manageSlot: React.ReactNode;
}) {
  if (state === "connected") {
    if (manageSlot) return <div className="space-y-3">{manageSlot}</div>;
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
        <p className="text-sm font-medium text-primary">
          {def.name} is connected and live.
        </p>
        <p className="text-xs text-primary mt-1">
          Your agency team manages this integration. Contact support to change
          how it&apos;s configured.
        </p>
      </div>
    );
  }

  if (state === "managed") {
    // Provisioning in progress. Always render the manage slot when
    // available (e.g. ConnectPixelForm or PixelRequestPending) so the
    // operator gets the real status, never a generic blurb.
    if (manageSlot) return <div className="space-y-3">{manageSlot}</div>;
    return <PlanGateBlock def={def} provisioning />;
  }

  if (state === "plan_locked") {
    // Module isn't on the tenant's plan. Audit BUG #4 caught the prior
    // copy was "Talk to your account manager" with no action — now
    // renders an actual mailto + 'View pricing' link.
    return <PlanGateBlock def={def} />;
  }

  if (state === "available" && def.auth === "self_serve") {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">
          Connect {def.name}
        </h4>
        {manageSlot}
      </div>
    );
  }

  if (state === "available" && def.auth === "api_key") {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">
          Connect via API key
        </h4>
        <p className="text-sm text-muted-foreground">
          Generate a scoped API key in settings, then paste it into {def.name}
          &apos;s HTTP / webhook action. The portal accepts posts to the
          <code className="ml-1 rounded bg-muted px-1 py-0.5 text-[11px]">
            /api/ingest/*
          </code>{" "}
          endpoints.
        </p>
        <Link
          href="/portal/settings/api-keys"
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          Go to API keys →
        </Link>
      </div>
    );
  }

  if (state === "available" || state === "requested") {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">
          {state === "requested"
            ? "Activation in progress"
            : `Activate ${def.name}`}
        </h4>
        {state === "available" ? (
          <p className="text-sm text-muted-foreground">
            Your agency team will set this up for you. Click below and we&apos;ll
            handle the OAuth handshake, account mapping, and first sync.
          </p>
        ) : null}
        <RequestActivationButton
          slug={def.slug}
          name={def.name}
          state={state}
        />
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      {def.name} is on our roadmap. Drop in again soon — or ask your account
      manager to prioritize it.
    </p>
  );
}

// Replaces the previous static "talk to your account manager" copy across
// every plan-gated integration with a real, actionable two-button block.
// Audit caught this copy on the Cursive pixel surface (BUG #4); same
// component now serves every integration in either provisioning-pending
// or plan-locked state.
function PlanGateBlock({
  def,
  provisioning = false,
}: {
  def: IntegrationDefinition;
  provisioning?: boolean;
}) {
  const subject = encodeURIComponent(
    provisioning
      ? `[LeaseStack] Status update on ${def.name} provisioning`
      : `[LeaseStack] Add ${def.name} to my plan`
  );
  const body = encodeURIComponent(
    provisioning
      ? `Hi — checking in on the status of ${def.name} provisioning for our portal. Anything you need from us to keep it moving?\n\nThanks!`
      : `Hi — interested in adding ${def.name} to our LeaseStack plan. What's involved and what would the upgrade look like?\n\nThanks!`
  );
  const tone = provisioning
    ? {
        bg: "border-amber-200 bg-amber-50 text-amber-900",
        accent: "text-amber-900",
      }
    : {
        bg: "border-border bg-muted/30 text-foreground",
        accent: "text-foreground",
      };
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${tone.bg}`}>
      <div>
        <p className={`text-sm font-semibold ${tone.accent}`}>
          {provisioning
            ? `${def.name} is being provisioned by your account team.`
            : `${def.name} isn't on your current plan.`}
        </p>
        <p className="text-xs mt-1 leading-snug opacity-90">
          {provisioning
            ? "We typically have new pixels live within one business day. You'll get an email with the install snippet once it's ready."
            : `Adding ${def.name} unlocks the data feed shown above. Reach your account team using one of the actions below.`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`mailto:hello@leasestack.co?subject=${subject}&body=${body}`}
          className="inline-flex items-center rounded-md bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-3 py-1.5 text-xs font-semibold hover:opacity-90"
        >
          {provisioning ? "Email account team" : "Email account team"}
        </a>
        {!provisioning ? (
          <Link
            href="/portal/settings"
            className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
          >
            View current plan
          </Link>
        ) : null}
      </div>
    </div>
  );
}
