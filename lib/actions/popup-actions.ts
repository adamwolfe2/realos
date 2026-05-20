"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  AuditAction,
  PopupPosition,
  PopupStatus,
  PopupTheme,
  PopupTrigger,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditPayload, requireScope } from "@/lib/tenancy/scope";
import { getPopupTemplate } from "@/lib/popups/templates";

// ---------------------------------------------------------------------------
// Popup module server actions.
//
// Back the /portal/popups editor. Every mutation:
//   1. Resolves the actor via requireScope() — never trusts client orgId
//   2. Validates input with zod (we use safeParse so malformed input
//      becomes a typed error rather than throwing)
//   3. Writes a Prisma row scoped on orgId (defense-in-depth even though
//      the route handler is already auth-gated)
//   4. Writes an AuditEvent so /admin sees who changed what when
//   5. revalidatePath so the portal nav badge + list refresh
// ---------------------------------------------------------------------------

export type ActionResult<T = Record<string, never>> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Scheme allow-list for any URL field the embed will assign to
// `location.href`. Pre-fix this schema accepted ANY z.string() for
// ctaUrl which meant an operator (or compromised operator account)
// could publish `javascript:fetch(...)` and execute arbitrary JS on
// every third-party site running the popup embed — full XSS on the
// embedding domain. Same shape applied to heroImageUrl so a `data:
// text/html` URI can't render in the popup's hero `<img>`.
const SAFE_CTA_SCHEMES = ["http:", "https:", "mailto:", "tel:"] as const;
const SAFE_IMG_SCHEMES = ["http:", "https:"] as const;

function makeSchemeGate(allowed: readonly string[]) {
  return (raw: string) => {
    const trimmed = raw.trim();
    // Same-origin / relative URLs ("/apply", "#contact", "?utm=…")
    // are safe — the browser resolves them against the embedding
    // site's origin, not the operator's. Allow these unchanged.
    if (trimmed === "" || trimmed === "#") return true;
    if (trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("?"))
      return true;
    try {
      const u = new URL(trimmed);
      return allowed.includes(u.protocol);
    } catch {
      return false;
    }
  };
}

const ctaUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(makeSchemeGate(SAFE_CTA_SCHEMES), {
    message:
      "CTA URL must use http://, https://, mailto:, tel:, or be a relative path like /apply",
  })
  .default("#");

// Icon enum-as-string. Kept loose (`z.string()`) at the column level so the
// renderer can ignore an unknown value gracefully, but pinned to a known
// vocab at the input schema for the editor.
const ICON_ENUM = ["calendar", "phone", "external", "arrow", "none"] as const;
const iconSchema = z
  .enum(ICON_ENUM)
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

// Up to 4 gradient stops, each a valid hex color. Empty / null means
// "use the legacy treatment" (no gradient bar).
const gradientColorsSchema = z
  .array(z.string().regex(HEX_COLOR))
  .max(4)
  .nullable()
  .optional();

const heroImageUrlSchema = z
  .string()
  .trim()
  .url("Hero image must be a valid URL")
  .refine(makeSchemeGate(SAFE_IMG_SCHEMES), {
    message: "Hero image must use http:// or https://",
  })
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

// Zod schema mirrors the PopupCampaign model. Anything optional in the
// schema must be optional here AND in the action signature; we use
// `nullable()` where the DB column is nullable (NOT `optional()`) so
// the operator can deliberately clear a field by sending null.
const upsertSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  status: z.nativeEnum(PopupStatus).default(PopupStatus.DRAFT),
  headline: z.string().trim().min(1, "Headline is required").max(120),
  body: z.string().trim().min(1, "Body is required").max(600),
  ctaText: z.string().trim().min(1, "CTA text is required").max(40),
  ctaUrl: ctaUrlSchema,
  offerCode: z.string().trim().max(40).nullable().optional(),
  secondaryText: z.string().trim().max(40).nullable().optional(),
  trigger: z.nativeEnum(PopupTrigger).default(PopupTrigger.EXIT_INTENT),
  triggerThreshold: z.coerce.number().int().min(0).max(600).default(0),
  targetUrlPatterns: z.array(z.string().trim().max(200)).default([]),
  frequency: z.enum(["session", "always", "once_per_day"]).default("session"),
  position: z.nativeEnum(PopupPosition).default(PopupPosition.CENTER),
  primaryColor: z.string().regex(HEX_COLOR).default("#2563EB"),
  textColor: z.string().regex(HEX_COLOR).default("#0F172A"),
  backgroundColor: z.string().regex(HEX_COLOR).default("#FFFFFF"),
  heroImageUrl: heroImageUrlSchema,
  captureEmail: z.boolean().default(true),
  capturePhone: z.boolean().default(false),
  propertyId: z.string().min(1).nullable().optional(),

  // Phase 1 — design parity additions. All nullable so an operator
  // can clear a field by submitting null / "".
  eyebrowText: z.string().trim().max(60).nullable().optional(),
  accentColor: z.string().regex(HEX_COLOR).nullable().optional(),
  theme: z.nativeEnum(PopupTheme).default(PopupTheme.LIGHT),
  template: z.string().trim().max(80).nullable().optional(),
  featuredLabel: z.string().trim().max(60).nullable().optional(),
  featuredValue: z.string().trim().max(40).nullable().optional(),
  featuredUnit: z.string().trim().max(20).nullable().optional(),
  featuredCaption: z.string().trim().max(120).nullable().optional(),
  secondaryCtaText: z.string().trim().max(40).nullable().optional(),
  secondaryCtaUrl: ctaUrlSchema.nullable().optional(),
  secondaryCtaIcon: iconSchema,
  primaryCtaIcon: iconSchema,
  dismissText: z.string().trim().max(60).nullable().optional(),
  gradientColors: gradientColorsSchema,
});

export async function createPopup(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const scope = await requireScope();
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodError(parsed.error) };
  }

  // If the operator picked a property, sanity-check it belongs to the
  // org. Without this, a malicious client could pass an arbitrary
  // propertyId and link the popup to another tenant's property.
  if (parsed.data.propertyId) {
    const propertyOwned = await prisma.property.findFirst({
      where: { id: parsed.data.propertyId, orgId: scope.orgId },
      select: { id: true },
    });
    if (!propertyOwned) {
      return {
        ok: false,
        error: "Property does not belong to this organization.",
      };
    }
  }

  const created = await prisma.popupCampaign.create({
    data: {
      orgId: scope.orgId,
      ...toPrismaData(parsed.data),
    },
    select: { id: true },
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.CREATE,
      entityType: "PopupCampaign",
      entityId: created.id,
      description: `Created popup "${parsed.data.name}"`,
    }),
  });

  revalidatePath("/portal/popups");
  return { ok: true, data: { id: created.id } };
}

export async function updatePopup(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const scope = await requireScope();
  if (!id || typeof id !== "string") {
    return { ok: false, error: "Missing popup id." };
  }
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodError(parsed.error) };
  }

  // IDOR defense — refuse to update a popup that doesn't belong to the
  // caller's org. updateMany returns affected count; 0 means scope
  // mismatch.
  if (parsed.data.propertyId) {
    const propertyOwned = await prisma.property.findFirst({
      where: { id: parsed.data.propertyId, orgId: scope.orgId },
      select: { id: true },
    });
    if (!propertyOwned) {
      return {
        ok: false,
        error: "Property does not belong to this organization.",
      };
    }
  }

  const updated = await prisma.popupCampaign.updateMany({
    where: { id, orgId: scope.orgId },
    data: toPrismaData(parsed.data),
  });
  if (updated.count === 0) {
    return { ok: false, error: "Popup not found." };
  }

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.UPDATE,
      entityType: "PopupCampaign",
      entityId: id,
      description: `Updated popup "${parsed.data.name}"`,
      diff: parsed.data as Prisma.InputJsonValue,
    }),
  });

  revalidatePath("/portal/popups");
  revalidatePath(`/portal/popups/${id}`);
  return { ok: true };
}

export async function setPopupStatus(
  id: string,
  status: PopupStatus,
): Promise<ActionResult> {
  const scope = await requireScope();

  // State-machine guard. DRAFT is a pre-publish state; you cannot
  // un-publish back to it once a campaign has been live. Use PAUSED
  // to temporarily stop a live campaign, or ARCHIVED to retire it
  // for good. This prevents a UI mishap (clicking the wrong status
  // pill) from silently hiding a live popup and wrecking attribution.
  if (status === PopupStatus.DRAFT) {
    const current = await prisma.popupCampaign.findFirst({
      where: { id, orgId: scope.orgId },
      select: { status: true },
    });
    if (!current) return { ok: false, error: "Popup not found." };
    if (current.status !== PopupStatus.DRAFT) {
      return {
        ok: false,
        error:
          "A popup that's been published can't go back to Draft. Use Pause to stop it or Archive to retire it.",
      };
    }
  }

  const updated = await prisma.popupCampaign.updateMany({
    where: { id, orgId: scope.orgId },
    data: { status },
  });
  if (updated.count === 0) {
    return { ok: false, error: "Popup not found." };
  }
  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.UPDATE,
      entityType: "PopupCampaign",
      entityId: id,
      description: `Popup status set to ${status}`,
    }),
  });
  revalidatePath("/portal/popups");
  revalidatePath(`/portal/popups/${id}`);
  return { ok: true };
}

export async function deletePopup(id: string): Promise<ActionResult> {
  const scope = await requireScope();
  const target = await prisma.popupCampaign.findFirst({
    where: { id, orgId: scope.orgId },
    select: { name: true },
  });
  if (!target) return { ok: false, error: "Popup not found." };

  await prisma.popupCampaign.deleteMany({
    where: { id, orgId: scope.orgId },
  });
  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.DELETE,
      entityType: "PopupCampaign",
      entityId: id,
      description: `Deleted popup "${target.name}"`,
    }),
  });
  revalidatePath("/portal/popups");
  return { ok: true };
}

/**
 * Form-action thin wrapper for creating a popup from the new-popup
 * page. Consumed via `<form action={createPopupFromForm}>` so we don't
 * need a client component just to call createPopup. Redirects into the
 * editor on success.
 */
export async function createPopupFromForm(formData: FormData): Promise<void> {
  const rawName = (formData.get("name") ?? "").toString().trim();
  const templateId = (formData.get("templateId") ?? "").toString().trim() || null;
  const template = getPopupTemplate(templateId);

  // Blank-create defaults — preserved verbatim from v1 so the "Start from
  // scratch" path produces the exact same row as it did before phase 1.
  const blankDefaults = {
    name: rawName || "Untitled popup",
    status: PopupStatus.DRAFT,
    headline: rawName || "Untitled popup",
    body: "Tell visitors why they should claim this offer.",
    ctaText: "Claim offer",
    ctaUrl: "#",
  } as const;

  // Templated create — merge template defaults on top of blank defaults
  // and override `name` if the operator typed one in the picker.
  const payload = template
    ? { ...template.defaults, name: rawName || template.defaults.name }
    : blankDefaults;

  const result = await createPopup(payload);
  if (result.ok && result.data) {
    redirect(`/portal/popups/${result.data.id}`);
  }
  // Errors fall through — the page renders with no new row and the
  // operator can retry. We avoid throwing so we don't trigger the
  // global error boundary on a soft validation failure.
}

function firstZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Validation failed.";
  return issue.message ?? "Validation failed.";
}

/**
 * Bridge between zod's parsed shape and Prisma's strict input types.
 *
 * Two specific reshapes:
 *   1. JSON columns (`targetUrlPatterns`, `gradientColors`) — Prisma's
 *      nullable Json input type demands either omitting the field, sending
 *      a real value, or `Prisma.JsonNull`. A plain `null` from zod is a
 *      type error, even though it persists as DB NULL.
 *   2. `propertyId` — zod expresses "clear this field" as `null`, but
 *      Prisma's update payload types `null` as `undefined`. We coerce it
 *      to `undefined` (which means "don't change"); UI clears the value
 *      by sending an empty string which zod normalizes to undefined.
 */
type UpsertInput = z.infer<typeof upsertSchema>;
function toPrismaData(d: UpsertInput) {
  // Strip the two JSON columns + propertyId so we can re-add them with the
  // Prisma-safe shape. Spread keeps every other field intact.
  const {
    targetUrlPatterns,
    gradientColors,
    propertyId: _propertyId,
    ...rest
  } = d;

  return {
    ...rest,
    // propertyId — surface only when set (otherwise leave unchanged on update,
    // unset on create). The IDOR check above already gates non-null values.
    ...(d.propertyId !== undefined ? { propertyId: d.propertyId } : {}),
    // targetUrlPatterns — always an array; cast to InputJsonValue to satisfy
    // Prisma's branded JSON type.
    targetUrlPatterns: targetUrlPatterns as Prisma.InputJsonValue,
    // gradientColors — null → Prisma.JsonNull, array → InputJsonValue,
    // undefined → omit (no-op on update).
    ...(gradientColors === undefined
      ? {}
      : gradientColors === null
        ? { gradientColors: Prisma.JsonNull }
        : { gradientColors: gradientColors as Prisma.InputJsonValue }),
  };
}
