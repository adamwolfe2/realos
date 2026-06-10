"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireWritableWorkspace } from "@/lib/tenancy/scope";

// ---------------------------------------------------------------------------
// Update the report cadence + recipients + auto-send toggle for the
// caller's org. Norman bug #100: operators need a way to opt into
// automatic daily/weekly/monthly report delivery to a custom mailing
// list — the default white-glove flow ("we draft, you ship") doesn't
// fit teams who want a hands-off cadence.
//
// Validation:
//   - cadence ∈ {none, daily, weekly, monthly}
//   - recipients: max 25 valid emails, each ≤ 200 chars
//   - autoSend: boolean
//
// We do NOT enforce that recipients be non-empty when autoSend=true
// here — the cron handler skips orgs without recipients and logs a
// reason, so a half-configured org is visible in the cron run log
// rather than silently never shipping. The UI separately disables
// the autoSend toggle when recipients are empty.
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputSchema = z.object({
  cadence: z.enum(["none", "daily", "weekly", "monthly"]),
  autoSend: z.boolean(),
  recipients: z
    .array(z.string().trim().max(200))
    .max(25)
    .transform((arr) => {
      // Dedupe + lowercase + drop blanks
      const seen = new Set<string>();
      const out: string[] = [];
      for (const r of arr) {
        const v = r.toLowerCase().trim();
        if (!v) continue;
        if (!EMAIL_RE.test(v)) continue;
        if (seen.has(v)) continue;
        seen.add(v);
        out.push(v);
      }
      return out;
    }),
});

export type SaveReportCadenceResult =
  | { ok: true; cadence: string; recipientCount: number }
  | { ok: false; error: string };

export async function saveReportCadence(
  raw: unknown,
): Promise<SaveReportCadenceResult> {
  const scope = await requireWritableWorkspace();
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Invalid report cadence payload.",
    };
  }

  const data = parsed.data;
  await prisma.organization.update({
    where: { id: scope.orgId },
    data: {
      reportCadence: data.cadence,
      reportRecipients: data.recipients,
      reportAutoSend: data.autoSend,
    },
  });

  revalidatePath("/portal/reports/settings");
  revalidatePath("/portal");
  return {
    ok: true,
    cadence: data.cadence,
    recipientCount: data.recipients.length,
  };
}
