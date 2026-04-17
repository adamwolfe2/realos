import "server-only";
import { prisma } from "@/lib/db";
import { provisionCursivePixel } from "@/lib/integrations/cursive";

// Idempotent provisioning helper. Called when an agency operator clicks
// "Provision pixel" on the client detail page, or by the tenant build
// pipeline once a primary domain is set. Returns the existing integration
// if the pixel is already provisioned.
export async function provisionCursiveForOrg(
  orgId: string,
  hostname: string
): Promise<{
  provisioned: boolean;
  integrationId: string;
  pixelId: string;
  scriptUrl: string | null;
}> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { cursiveIntegration: true },
  });
  if (!org) throw new Error("Organization not found");
  if (!org.modulePixel) {
    throw new Error(
      "Pixel module is disabled for this tenant; enable it in module flags first."
    );
  }

  if (org.cursiveIntegration?.cursivePixelId) {
    return {
      provisioned: false,
      integrationId: org.cursiveIntegration.id,
      pixelId: org.cursiveIntegration.cursivePixelId,
      scriptUrl: org.cursiveIntegration.pixelScriptUrl ?? null,
    };
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const webhookUrl = `${base}/api/webhooks/cursive`;

  const provisioned = await provisionCursivePixel({
    domain: hostname,
    orgName: org.name,
    webhookUrl,
  });

  const integration = await prisma.cursiveIntegration.upsert({
    where: { orgId },
    create: {
      orgId,
      cursivePixelId: provisioned.pixelId,
      cursiveAccountId: provisioned.accountId,
      pixelScriptUrl: provisioned.scriptUrl,
      installedOnDomain: hostname,
      provisionedAt: new Date(),
    },
    update: {
      cursivePixelId: provisioned.pixelId,
      cursiveAccountId: provisioned.accountId,
      pixelScriptUrl: provisioned.scriptUrl,
      installedOnDomain: hostname,
      provisionedAt: new Date(),
    },
  });

  // Flip the site-config pixel toggle on so the loader actually emits
  // the script. Operator can still disable later via /portal/site-builder.
  await prisma.tenantSiteConfig.upsert({
    where: { orgId },
    update: { enablePixel: true },
    create: { orgId, enablePixel: true },
  });

  return {
    provisioned: true,
    integrationId: integration.id,
    pixelId: provisioned.pixelId,
    scriptUrl: provisioned.scriptUrl,
  };
}
