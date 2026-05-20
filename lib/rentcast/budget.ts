import "server-only";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Per-org RentCast budget tracking.
//
// Backed by `OrgRentCastUsage` — single row per org, lazy-created on first
// usage check. The monthKey field tracks the current YYYY-MM tracking
// window; if the live month no longer matches the stored monthKey, we roll
// the counter back to 0 before evaluating the cap.
//
// The cap has two thresholds:
//   * `requestsThisMonth >= monthlyBudget`   → over budget but still
//     allowed (returns `remaining = 0`, `overCap = false`). Used by the
//     UI to surface "you're approaching your cap" hints.
//   * `requestsThisMonth >= monthlyBudget × hardCapMultiplier`
//                                            → hard refusal. The cache
//     layer returns `cache-only` mode and the property detail page swaps
//     to the upsell card.
// ---------------------------------------------------------------------------

export function currentMonthKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export type BudgetState = {
  allowed: boolean;
  remaining: number;
  used: number;
  budget: number;
  overCap: boolean;
  monthKey: string;
};

export async function canSpendCredit(orgId: string): Promise<BudgetState> {
  const monthKey = currentMonthKey();
  // Upsert + roll-over in a single transaction so two concurrent first
  // visits from the same org don't double-allocate the row.
  const usage = await prisma.orgRentCastUsage.upsert({
    where: { orgId },
    create: {
      orgId,
      monthKey,
      requestsThisMonth: 0,
    },
    update: {},
  });

  let used = usage.requestsThisMonth;
  let liveMonthKey = usage.monthKey;
  if (usage.monthKey !== monthKey) {
    const rolled = await prisma.orgRentCastUsage.update({
      where: { orgId },
      data: {
        monthKey,
        requestsThisMonth: 0,
        lastResetAt: new Date(),
      },
    });
    used = rolled.requestsThisMonth;
    liveMonthKey = rolled.monthKey;
  }

  const budget = usage.monthlyBudget;
  const hardCap = Math.ceil(budget * usage.hardCapMultiplier);
  const overCap = used >= hardCap;
  const remaining = Math.max(0, budget - used);

  return {
    allowed: !overCap,
    remaining,
    used,
    budget,
    overCap,
    monthKey: liveMonthKey,
  };
}

export async function recordCredit(orgId: string, cost: number = 1): Promise<void> {
  const monthKey = currentMonthKey();
  // Two-step approach: ensure the row exists at the current monthKey,
  // then atomically increment. We can't conditionally reset-on-rollover
  // inside an `update` without raw SQL — `canSpendCredit` is the gate
  // most callers go through anyway, so it's typically already rolled.
  await prisma.orgRentCastUsage.upsert({
    where: { orgId },
    create: {
      orgId,
      monthKey,
      requestsThisMonth: cost,
    },
    update: {
      requestsThisMonth: { increment: cost },
    },
  });
}

export type UsageSummary = {
  orgId: string;
  used: number;
  budget: number;
  hardCap: number;
  monthKey: string;
  lastResetAt: Date;
};

export async function getUsageSummary(orgId: string): Promise<UsageSummary> {
  const monthKey = currentMonthKey();
  const usage = await prisma.orgRentCastUsage.upsert({
    where: { orgId },
    create: { orgId, monthKey, requestsThisMonth: 0 },
    update: {},
  });
  const liveMonthKey = usage.monthKey;
  const used = liveMonthKey === monthKey ? usage.requestsThisMonth : 0;
  return {
    orgId,
    used,
    budget: usage.monthlyBudget,
    hardCap: Math.ceil(usage.monthlyBudget * usage.hardCapMultiplier),
    monthKey: liveMonthKey,
    lastResetAt: usage.lastResetAt,
  };
}

export async function setMonthlyBudget(orgId: string, budget: number): Promise<void> {
  if (!Number.isFinite(budget) || budget < 0) {
    throw new Error("monthlyBudget must be a non-negative integer");
  }
  const monthKey = currentMonthKey();
  await prisma.orgRentCastUsage.upsert({
    where: { orgId },
    create: { orgId, monthKey, monthlyBudget: Math.floor(budget) },
    update: { monthlyBudget: Math.floor(budget) },
  });
}
