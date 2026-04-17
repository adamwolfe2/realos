import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAgency, ForbiddenError } from "@/lib/tenancy/scope";
import { provisionCursiveForOrg } from "@/lib/build/provision-cursive";

const body = z.object({ hostname: z.string().min(3).max(253).optional() });

// POST /api/admin/clients/[id]/provision-pixel
// Agency-only. Provisions a Cursive pixel for the tenant, using either the
// hostname passed in the body or the tenant's primary DomainBinding /
// fallback subdomain. Idempotent: if the tenant already has an integration
// row with cursivePixelId, returns it without re-calling Cursive.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      domains: { orderBy: { isPrimary: "desc" } },
    },
  });
  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const hostname =
    parsed.data.hostname ??
    org.domains[0]?.hostname ??
    fallbackSubdomain(org.slug);

  if (!hostname) {
    return NextResponse.json(
      { error: "Could not determine hostname, attach a domain first." },
      { status: 400 }
    );
  }

  try {
    const result = await provisionCursiveForOrg(org.id, hostname);
    return NextResponse.json({ ok: true, hostname, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function fallbackSubdomain(slug: string): string | null {
  const platform =
    process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "").split("/")[0];
  if (!platform) return null;
  return `${slug}.${platform}`;
}
