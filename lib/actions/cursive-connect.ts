"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import {
  archiveCursivePixel,
  provisionCursivePixel,
} from "@/lib/integrations/cursive";
import { OrgType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Portal-side Cursive/AudienceLab pixel server actions.
//
// `connectPixel` provisions a new AL pixel for the CLIENT org and persists
// the returned install snippet on CursiveIntegration. `disconnectPixel`
// archives the pixel in AL and clears the integration row. Both require the
// caller's effective org to be a CLIENT (agency impersonators are allowed).
// ---------------------------------------------------------------------------

const PORTAL_PATH = "/portal/settings/integrations";

const connectSchema = z.object({
  websiteName: z
    .string()
    .trim()
    .min(1, "Website name is required")
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  websiteUrl: z
    .string()
    .trim()
    .min(1, "Website URL is required")
    .max(500),
});

export type ConnectPixelResult = {
  ok: boolean;
  error?: string;
};

function normalizeUrl(raw: string): URL {
  const trimmed = raw.trim();
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  // Throws on invalid URL — caller wraps in try/catch.
  return new URL(withScheme);
}

async function requireClientScope() {
  const scope = await requireScope();
  if (scope.orgType !== OrgType.CLIENT) {
    throw new ForbiddenError("Client context required");
  }
  return scope;
}

export async function connectPixel(
  formData: FormData
): Promise<ConnectPixelResult> {
  let scope;
  try {
    scope = await requireClientScope();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Not authorized";
    return { ok: false, error: message };
  }

  const parsed = connectSchema.safeParse({
    websiteName: formData.get("websiteName")?.toString() ?? "",
    websiteUrl: formData.get("websiteUrl")?.toString() ?? "",
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input";
    return { ok: false, error: first };
  }

  const org = await prisma.organization.findUnique({
    where: { id: scope.orgId },
    select: { id: true, name: true, modulePixel: true, moduleChatbot: true },
  });
  if (!org) return { ok: false, error: "Organization not found" };
  if (!org.modulePixel && !org.moduleChatbot) {
    return {
      ok: false,
      error:
        "Pixel module is not enabled for your workspace. Contact your account manager.",
    };
  }

  let websiteUrl: URL;
  try {
    websiteUrl = normalizeUrl(parsed.data.websiteUrl);
  } catch {
    return { ok: false, error: "Please enter a valid website URL." };
  }
  if (websiteUrl.protocol !== "https:" && websiteUrl.protocol !== "http:") {
    return { ok: false, error: "Website URL must be http or https." };
  }

  const appBase = process.env.NEXT_PUBLIC_APP_URL;
  if (!appBase) {
    return {
      ok: false,
      error:
        "NEXT_PUBLIC_APP_URL is not configured; cannot build webhook URL.",
    };
  }
  let webhookUrl: string;
  try {
    webhookUrl = new URL("/api/webhooks/cursive", appBase).toString();
  } catch {
    return { ok: false, error: "Invalid NEXT_PUBLIC_APP_URL configuration." };
  }

  const websiteName = parsed.data.websiteName ?? org.name;

  try {
    const provisioned = await provisionCursivePixel({
      websiteName,
      websiteUrl: websiteUrl.toString(),
      webhookUrl,
    });

    await prisma.cursiveIntegration.upsert({
      where: { orgId: org.id },
      create: {
        orgId: org.id,
        cursivePixelId: provisioned.pixelId,
        pixelScriptUrl: provisioned.installUrl,
        installedOnDomain: websiteUrl.hostname,
        provisionedAt: new Date(),
      },
      update: {
        cursivePixelId: provisioned.pixelId,
        pixelScriptUrl: provisioned.installUrl,
        installedOnDomain: websiteUrl.hostname,
        provisionedAt: new Date(),
      },
    });

    await prisma.organization.update({
      where: { id: org.id },
      data: { modulePixel: true },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Pixel provisioning failed";
    return { ok: false, error: message };
  }

  revalidatePath(PORTAL_PATH);
  return { ok: true };
}

export async function disconnectPixel(): Promise<ConnectPixelResult> {
  let scope;
  try {
    scope = await requireClientScope();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Not authorized";
    return { ok: false, error: message };
  }

  const integration = await prisma.cursiveIntegration.findUnique({
    where: { orgId: scope.orgId },
    select: { id: true, cursivePixelId: true },
  });
  if (!integration || !integration.cursivePixelId) {
    return { ok: true };
  }

  try {
    await archiveCursivePixel(integration.cursivePixelId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Pixel archive failed";
    return { ok: false, error: message };
  }

  await prisma.cursiveIntegration.update({
    where: { orgId: scope.orgId },
    data: {
      cursivePixelId: null,
      pixelScriptUrl: null,
      installedOnDomain: null,
    },
  });

  await prisma.organization.update({
    where: { id: scope.orgId },
    data: { modulePixel: false },
  });

  revalidatePath(PORTAL_PATH);
  return { ok: true };
}
