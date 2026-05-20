import type { NeighborhoodPageStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  NeighborhoodPageFaq,
  NeighborhoodPageSection,
  StoredNeighborhoodPage,
} from "@/lib/actions/neighborhood-pages";

// Pure-sync transformer for narrowing Prisma's raw row shape into the
// app's StoredNeighborhoodPage view-model. Lives in this helpers file —
// NOT inside neighborhood-pages.ts — because that file is marked
// `"use server"`, and Next.js requires every exported member in a
// server-actions module to be an async function. Sync helpers belong
// in a sibling file.
//
// Callers (server components rendering tenant + portal pages) import
// this directly; nothing else in the codebase needs to await it.
export function parseStored(
  raw: Awaited<
    ReturnType<typeof prisma.neighborhoodPage.findFirst>
  > extends infer T
    ? T
    : never,
): StoredNeighborhoodPage | null {
  if (!raw) return null;
  const r = raw as unknown as Record<string, unknown>;
  return {
    id: r.id as string,
    orgId: r.orgId as string,
    propertyId: (r.propertyId as string | null) ?? null,
    city: r.city as string,
    state: (r.state as string | null) ?? null,
    neighborhood: r.neighborhood as string,
    slug: r.slug as string,
    title: r.title as string,
    metaDescription: r.metaDescription as string,
    intro: r.intro as string,
    sections: Array.isArray(r.sections)
      ? (r.sections as NeighborhoodPageSection[])
      : [],
    faqs: Array.isArray(r.faqs) ? (r.faqs as NeighborhoodPageFaq[]) : [],
    aiCitations: Array.isArray(r.aiCitations)
      ? (r.aiCitations as string[])
      : null,
    status: r.status as NeighborhoodPageStatus,
    publishedAt: (r.publishedAt as Date | null) ?? null,
    updatedAt: r.updatedAt as Date,
  };
}
