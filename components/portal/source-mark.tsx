import type { LeadSource } from "@prisma/client";
import Image from "next/image";
import { FileText, Mail, MousePointerClick, Share2, UserPlus, Circle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BRAND_LOGOS } from "@/components/portal/integrations/brand-logos";
import { humanLeadSource } from "@/lib/format";
import { FLOW_STAGES, type SourceFlowRow } from "@/lib/leads/source-flow";

// Lead-source marks (the real logo of the tool a lead came through) and a
// compact source list.

const SOURCE_LOGO: Partial<Record<LeadSource, string>> = {
  GOOGLE_ADS: "google-ads",
  META_ADS: "meta-ads",
  ORGANIC: "gsc",
};
const SOURCE_ICON: Partial<Record<LeadSource, LucideIcon>> = {
  FORM: FileText,
  EMAIL_CAMPAIGN: Mail,
  COLD_EMAIL: Mail,
  REFERRAL: Share2,
  DIRECT: MousePointerClick,
  MANUAL: UserPlus,
};

/** Logo tile for a lead source: the tool's real mark where we have one. */
export function SourceMark({ source, size = 22 }: { source: LeadSource | string; size?: number }) {
  const tile = "grid shrink-0 place-items-center rounded-[6px] border border-[var(--t-border)] bg-white";
  const inner = Math.round(size * 0.6);
  if (source === "CHATBOT") {
    return (
      <span className={tile} style={{ width: size, height: size }}>
        <Image src="/favicon.svg" alt="" width={inner} height={inner} unoptimized />
      </span>
    );
  }
  const slug = source === "APPFOLIO" ? "appfolio" : SOURCE_LOGO[source as LeadSource];
  const logo = slug ? BRAND_LOGOS[slug] : undefined;
  if (logo) {
    return (
      <span className={tile} style={{ width: size, height: size }}>
        <span
          className="[&_svg]:h-full [&_svg]:w-full"
          style={{ width: inner, height: inner, color: logo.brandColor, fill: logo.brandColor }}
        >
          {logo.render()}
        </span>
      </span>
    );
  }
  const Icon = SOURCE_ICON[source as LeadSource] ?? Circle;
  return (
    <span className={tile} style={{ width: size, height: size }}>
      <Icon className="text-[var(--t-muted)]" style={{ width: inner, height: inner }} />
    </span>
  );
}

/** Lead sources as a quiet list: tool logo, name, and how far its leads got. */
export function SourceList({ rows }: { rows: SourceFlowRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-[13px] text-muted-foreground">
        Sources appear here as leads arrive.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.source} className="flex items-center gap-3 py-2.5">
          <SourceMark source={r.source} size={28} />
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">
            {humanLeadSource(r.source)}
          </span>
          {FLOW_STAGES.slice(0, 3).map((stage, i) => (
            <span key={stage} className="w-20 text-right text-[13px] tabular-nums text-muted-foreground">
              <span className="font-medium text-foreground">{r.counts[i]}</span> {i === 0 && r.counts[0] === 1 ? "lead" : stage.toLowerCase()}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}
