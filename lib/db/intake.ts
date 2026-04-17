import { prisma } from "./index";
import type { Prisma } from "@prisma/client";

export type CreateIntakeData = Omit<
  Prisma.IntakeSubmissionCreateInput,
  "createdAt" | "updatedAt"
>;

export async function createIntakeSubmission(data: CreateIntakeData) {
  return prisma.intakeSubmission.create({ data });
}

export async function getIntakeSubmissions(opts?: {
  reviewed?: boolean;
  converted?: boolean;
}) {
  return prisma.intakeSubmission.findMany({
    where: {
      reviewedAt:
        opts?.reviewed === true
          ? { not: null }
          : opts?.reviewed === false
          ? null
          : undefined,
      convertedAt:
        opts?.converted === true
          ? { not: null }
          : opts?.converted === false
          ? null
          : undefined,
    },
    orderBy: { submittedAt: "desc" },
    include: { org: { select: { id: true, status: true, slug: true } } },
    take: 200,
  });
}

export async function getIntakeSubmissionById(id: string) {
  return prisma.intakeSubmission.findUnique({
    where: { id },
    include: { org: true },
  });
}

export async function markIntakeReviewed(id: string) {
  return prisma.intakeSubmission.update({
    where: { id },
    data: { reviewedAt: new Date() },
  });
}

export async function markIntakeConverted(id: string, orgId: string) {
  return prisma.intakeSubmission.update({
    where: { id },
    data: { convertedAt: new Date(), orgId, status: "converted" },
  });
}
