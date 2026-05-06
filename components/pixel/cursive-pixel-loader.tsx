import Script from "next/script";
import { findCursiveIntegrationForProperty } from "@/lib/integrations/per-property";

// Server component. Renders the Cursive pixel script when the tenant has a
// provisioned pixel. Renders nothing when the pixel isn't set up yet, so
// tenants who flip the module on before the agency provisions don't ship a
// broken <script> tag.
//
// Pixel scoping: each LeaseStack property typically has its own marketing
// site at its own domain, so each property gets its own pixel. Pass the
// `propertyId` to render that property's pixel script. When omitted (e.g.
// the marketing site doesn't yet know which property the visitor came in
// for) we fall back to the legacy org-wide pixel for backward compat.
export async function CursivePixelLoader({
  orgId,
  propertyId,
}: {
  orgId: string;
  propertyId?: string | null;
}) {
  const integration = await findCursiveIntegrationForProperty(
    orgId,
    propertyId ?? null,
  );
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
