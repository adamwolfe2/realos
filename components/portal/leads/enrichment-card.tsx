import Image from "next/image";
import type { Visitor } from "@prisma/client";
import { Briefcase, ExternalLink, MapPin } from "lucide-react";
import { extractIdentity } from "@/lib/visitors/enrichment";

// ---------------------------------------------------------------------------
// Enrichment card — shows company/title pulled from the Cursive pixel. Renders
// a muted prompt when no visitor is linked or no enrichment is present.
// ---------------------------------------------------------------------------

function readLinkedIn(enriched: unknown): string | null {
  if (!enriched || typeof enriched !== "object") return null;
  const rec = enriched as Record<string, unknown>;
  for (const key of ["LINKEDIN_URL", "LINKEDIN", "linkedin_url", "linkedin"]) {
    const value = rec[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export function EnrichmentCard({ visitor }: { visitor: Visitor | null }) {
  if (!visitor) {
    return (
      <SidebarCard label="Enrichment">
        <p className="text-xs leading-relaxed text-[var(--stone-gray)]">
          Install the Cursive pixel to enrich this lead with company and role
          information.
        </p>
      </SidebarCard>
    );
  }

  const identity = extractIdentity(visitor);
  const linkedIn = readLinkedIn(visitor.enrichedData);
  const hasAny =
    identity.companyName ||
    identity.jobTitle ||
    identity.location ||
    linkedIn;

  if (!hasAny) {
    return (
      <SidebarCard label="Enrichment">
        <p className="text-xs leading-relaxed text-[var(--stone-gray)]">
          This visitor is resolved but has no company enrichment yet. Enrichment
          arrives within a few hours of the first pixel hit.
        </p>
      </SidebarCard>
    );
  }

  return (
    <SidebarCard label="Enrichment">
      <div className="space-y-3">
        {identity.companyName ? (
          <div className="flex items-center gap-2">
            {identity.logoUrl ? (
              <div className="h-7 w-7 shrink-0 rounded-[8px] bg-[var(--white)] ring-1 ring-[var(--border-cream)] overflow-hidden flex items-center justify-center">
                <Image
                  src={identity.logoUrl}
                  alt={identity.companyName}
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain"
                  unoptimized
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--near-black)] truncate">
                {identity.companyName}
              </p>
              {identity.jobTitle ? (
                <p className="text-xs text-[var(--charcoal-warm)] truncate flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {identity.jobTitle}
                </p>
              ) : null}
            </div>
          </div>
        ) : identity.jobTitle ? (
          <p className="text-xs text-[var(--charcoal-warm)] flex items-center gap-1">
            <Briefcase className="h-3 w-3" />
            {identity.jobTitle}
          </p>
        ) : null}

        {identity.location ? (
          <p className="text-xs text-[var(--charcoal-warm)] flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {identity.location}
          </p>
        ) : null}

        {linkedIn ? (
          <a
            href={linkedIn}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--terracotta)] hover:text-[var(--terracotta-hover)] transition-colors duration-200"
          >
            LinkedIn profile
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}

        <p className="pt-2 border-t border-[var(--border-cream)] text-[11px] text-[var(--stone-gray)]">
          Enriched via Cursive pixel
        </p>
      </div>
    </SidebarCard>
  );
}

export function SidebarCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--border-cream)] bg-[var(--ivory)] p-4">
      <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--stone-gray)] mb-3">
        {label}
      </p>
      {children}
    </div>
  );
}
