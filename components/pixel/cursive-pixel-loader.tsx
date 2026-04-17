import { prisma } from "@/lib/db";

// Placeholder. Sprint 08 swaps this for a real CursiveIntegration lookup
// and emits the Cursive pixel <script> tag. For now we render nothing
// visible and flag the module is on.
export async function CursivePixelLoader({ orgId }: { orgId: string }) {
  const integration = await prisma.cursiveIntegration.findUnique({
    where: { orgId },
    select: { pixelScriptUrl: true, cursivePixelId: true },
  });
  if (!integration?.pixelScriptUrl) return null;

  // TODO(Sprint 08): render the Cursive pixel script with async + crossorigin.
  return (
    <script
      src={integration.pixelScriptUrl}
      async
      data-pixel-id={integration.cursivePixelId ?? undefined}
    />
  );
}
