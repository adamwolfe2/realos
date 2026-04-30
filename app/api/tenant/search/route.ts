import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/tenant/search?q=...
//
// Cross-entity tenant search powering the Cmd+K modal. Searches leads,
// visitors, properties, and chatbot conversations (by captured name/email).
// Capped at 6 results per entity type so the modal stays scrollable.
//
// Tenant-scoped via tenantWhere(scope) — never returns rows from another
// org regardless of role.

const PER_ENTITY_LIMIT = 6;

export async function GET(req: NextRequest) {
  const scope = await requireScope();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], q });
  }

  const where = tenantWhere(scope);

  const [leads, visitors, properties, conversations] = await Promise.all([
    prisma.lead.findMany({
      where: {
        ...where,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { lastActivityAt: "desc" },
      take: PER_ENTITY_LIMIT,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        source: true,
        lastActivityAt: true,
      },
    }),
    prisma.visitor.findMany({
      where: {
        ...where,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { lastSeenAt: "desc" },
      take: PER_ENTITY_LIMIT,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        intentScore: true,
        lastSeenAt: true,
      },
    }),
    prisma.property.findMany({
      where: {
        ...where,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { addressLine1: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { name: "asc" },
      take: PER_ENTITY_LIMIT,
      select: {
        id: true,
        name: true,
        addressLine1: true,
        city: true,
        state: true,
        availableCount: true,
        totalUnits: true,
      },
    }),
    prisma.chatbotConversation.findMany({
      where: {
        ...where,
        OR: [
          { capturedName: { contains: q, mode: "insensitive" } },
          { capturedEmail: { contains: q, mode: "insensitive" } },
          { capturedPhone: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { lastMessageAt: "desc" },
      take: PER_ENTITY_LIMIT,
      select: {
        id: true,
        capturedName: true,
        capturedEmail: true,
        status: true,
        messageCount: true,
        lastMessageAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    q,
    results: { leads, visitors, properties, conversations },
  });
}
