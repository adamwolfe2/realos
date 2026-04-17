import Script from "next/script";
import { prisma } from "@/lib/db";

// Server component. Renders the Cursive pixel script when the tenant has a
// provisioned pixel. Renders nothing when the pixel isn't set up yet, so
// tenants who flip the module on before the agency provisions don't ship a
// broken <script> tag.
export async function CursivePixelLoader({ orgId }: { orgId: string }) {
  const integration = await prisma.cursiveIntegration.findUnique({
    where: { orgId },
    select: { pixelScriptUrl: true, cursivePixelId: true },
  });
  if (!integration?.pixelScriptUrl) return null;

  return (
    <Script
      id="cursive-pixel"
      strategy="afterInteractive"
      src={integration.pixelScriptUrl}
      data-pixel-id={integration.cursivePixelId ?? undefined}
    />
  );
}
