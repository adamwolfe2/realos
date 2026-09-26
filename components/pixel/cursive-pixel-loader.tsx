import Script from "next/script";
import { prisma } from "@/lib/db";
import { findCursiveIntegrationForProperty } from "@/lib/integrations/per-property";
import { idpixelScriptUrl } from "@/lib/pixel/detect-install";

// Server component. Renders the Cursive pixel script when the tenant has a
// provisioned pixel. Renders nothing when the pixel isn't set up yet, so
// tenants who flip the module on before the agency provisions don't ship a
// broken <script> tag.
//
// Pixel scoping: each LeaseStack property typically has its own marketing
// site at its own domain, so each property gets its own pixel. Pass the
// `propertyId` to render that property's pixel script. When omitted we use
// the legacy org-wide pixel, else the org's only pixel if it has exactly one
// (self-serve connects always write a per-property row).
//
// Nothing writes `pixelScriptUrl` (V4 pixels are provisioned in the upstream
// UI), so the URL is derived from the pixel ID when the column is empty.
export async function CursivePixelLoader({
  orgId,
  propertyId,
}: {
  orgId: string;
  propertyId?: string | null;
}) {
  let integration = await findCursiveIntegrationForProperty(
    orgId,
    propertyId ?? null,
  );
  if (!integration?.cursivePixelId && !integration?.pixelScriptUrl && !propertyId) {
    const rows = await prisma.cursiveIntegration.findMany({
      where: { orgId, cursivePixelId: { not: null } },
      take: 2,
    });
    // ponytail: multi-pixel orgs on the org-level hosted site load nothing
    // rather than guess a property; pass propertyId once the site knows it.
    if (rows.length === 1) integration = rows[0];
  }
  const src =
    integration?.pixelScriptUrl ??
    (integration?.cursivePixelId
      ? idpixelScriptUrl(integration.cursivePixelId)
      : null);
  if (!src) return null;

  return (
    <Script
      id="cursive-pixel"
      strategy="afterInteractive"
      src={src}
      data-pixel-id={integration?.cursivePixelId ?? undefined}
    />
  );
}
