"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAgency, ForbiddenError } from "@/lib/tenancy/scope";
import { PixelRequestStatus } from "@prisma/client";

// Server actions for the /admin/pixel-requests queue. Fulfillment happens
// implicitly when ops pastes a pixel_id into the admin Cursive panel
// (saveCursiveSettings in lib/actions/admin-cursive.ts), so the only manual
// transition we expose here is cancellation.

const cancelSchema = z.object({
  requestId: z.string().min(1).max(100),
});

export type CancelResult = { ok: true } | { ok: false; error: string };

export async function cancelPixelRequest(raw: unknown): Promise<CancelResult> {
  try {
    await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = cancelSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid request id" };
  }

  await prisma.pixelProvisionRequest.update({
    where: { id: parsed.data.requestId },
    data: { status: PixelRequestStatus.CANCELLED },
  });

  revalidatePath("/admin/pixel-requests");
  return { ok: true };
}
