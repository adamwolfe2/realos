"use server";

import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";

// Prospect search — used by the new-proposal picker. Cross-source query
// over IntakeSubmission / Lead / Organization.

export type ProspectSuggestion = {
  source: "intake" | "lead" | "organization";
  id: string;
  name: string;
  email: string;
  company: string | null;
  intakeId: string | null;
  orgId: string | null;
};

export async function searchProspects(args: {
  q: string;
}): Promise<ProspectSuggestion[]> {
  await requireAgency();
  const q = (args.q ?? "").trim();
  if (q.length < 2) return [];

  const [intakes, leads, orgs] = await Promise.all([
    prisma.intakeSubmission.findMany({
      where: {
        OR: [
          { primaryContactEmail: { contains: q, mode: "insensitive" } },
          { primaryContactName: { contains: q, mode: "insensitive" } },
          { companyName: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { submittedAt: "desc" },
      take: 8,
      select: {
        id: true,
        primaryContactName: true,
        primaryContactEmail: true,
        companyName: true,
        orgId: true,
      },
    }),
    prisma.lead.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    }),
    prisma.organization.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, name: true, slug: true },
    }),
  ]);

  // review-fix: build the suggestion list via immutable composition.
  // Previously this used `.push()` into a mutable `out` array, which
  // violates the global immutability rule and makes the source/lead/org
  // ordering invisible to a reader scanning the file. The spread-based
  // composition both fixes the mutation AND surfaces the deterministic
  // order: intake → lead → organization.
  return [
    ...intakes.map<ProspectSuggestion>((r) => ({
      source: "intake",
      id: r.id,
      name: r.primaryContactName,
      email: r.primaryContactEmail,
      company: r.companyName,
      intakeId: r.id,
      orgId: r.orgId ?? null,
    })),
    ...leads.map<ProspectSuggestion>((r) => ({
      source: "lead",
      id: r.id,
      name:
        [r.firstName, r.lastName].filter(Boolean).join(" ").trim() ||
        r.email ||
        "Lead",
      email: r.email ?? "",
      company: null,
      intakeId: null,
      orgId: null,
    })),
    ...orgs.map<ProspectSuggestion>((r) => ({
      source: "organization",
      id: r.id,
      name: r.name,
      email: "",
      company: r.name,
      intakeId: null,
      orgId: r.id,
    })),
  ];
}
