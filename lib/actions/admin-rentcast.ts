"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAgency, ForbiddenError } from "@/lib/tenancy/scope";
import { setMonthlyBudget } from "@/lib/rentcast/budget";

// ---------------------------------------------------------------------------
// Admin-only server action — update a client org's RentCast monthly budget.
// Surfaced as a tiny editable row on /admin/clients/[id]. The cache layer
// reads `monthlyBudget` (and the hardCapMultiplier default of 1.5) to gate
// fetches and trigger the upsell card.
// ---------------------------------------------------------------------------

const inputSchema = z.object({
  orgId: z.string().min(1),
  monthlyBudget: z.number().int().nonnegative(),
});

export type UpdateRentCastBudgetResult =
  | { ok: true; monthlyBudget: number }
  | { ok: false; error: string };

export async function updateRentCastBudget(
  raw: unknown,
): Promise<UpdateRentCastBudgetResult> {
  try {
    await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid budget value." };
  }
  const { orgId, monthlyBudget } = parsed.data;

  try {
    await setMonthlyBudget(orgId, monthlyBudget);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update budget.",
    };
  }

  revalidatePath(`/admin/clients/${orgId}`);
  return { ok: true, monthlyBudget };
}
