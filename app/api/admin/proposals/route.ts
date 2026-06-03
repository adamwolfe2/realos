import { NextResponse } from "next/server";
import { Prisma, ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";
import { createDraft } from "@/app/admin/proposals/actions";

// ---------------------------------------------------------------------------
// POST /api/admin/proposals
//   Body: { prospect: { name, email, company?, intakeId?, orgId? } }
//   Wraps createDraft so the prospect picker (or any future external caller)
//   can hit a stable URL instead of the Server Action.
//
// GET /api/admin/proposals?status=DRAFT&take=50
//   Paginated list for the catalog editor or future external tooling.
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  await requireAgency();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("prospect" in body) ||
    typeof (body as { prospect: unknown }).prospect !== "object"
  ) {
    return NextResponse.json({ error: "Missing prospect" }, { status: 400 });
  }

  const prospect = (body as { prospect: Record<string, unknown> }).prospect;
  const name = typeof prospect.name === "string" ? prospect.name : "";
  const email = typeof prospect.email === "string" ? prospect.email : "";
  const company =
    typeof prospect.company === "string" ? prospect.company : null;
  const intakeId =
    typeof prospect.intakeId === "string" ? prospect.intakeId : null;
  const orgId = typeof prospect.orgId === "string" ? prospect.orgId : null;

  if (!name && !email) {
    return NextResponse.json(
      { error: "Prospect name or email required" },
      { status: 400 },
    );
  }

  const { proposalId } = await createDraft({
    prospect: { name, email, company, intakeId, orgId },
  });
  return NextResponse.json({ proposalId });
}

export async function GET(req: Request) {
  await requireAgency();
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const take = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("take") ?? "50")),
  );
  const cursor = url.searchParams.get("cursor");

  const where: Prisma.ProposalWhereInput = {};
  if (
    statusParam &&
    (Object.values(ProposalStatus) as string[]).includes(statusParam)
  ) {
    where.status = statusParam as ProposalStatus;
  }

  const rows = await prisma.proposal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      number: true,
      status: true,
      prospectName: true,
      prospectEmail: true,
      prospectCompany: true,
      recurringSubtotalCents: true,
      oneTimeSubtotalCents: true,
      createdAt: true,
      sentAt: true,
      acceptedAt: true,
    },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return NextResponse.json({
    items: page,
    nextCursor: hasMore ? page[page.length - 1]?.id : null,
  });
}
