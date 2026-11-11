"use client";

import * as React from "react";
import { setCampaignProperty } from "./campaign-property-actions";

// Inline picker in the campaigns table. The sync links most campaigns by
// name; this covers the rest ("TC - Leads") and portfolio-wide campaigns.
export function CampaignPropertySelect({
  campaignId,
  propertyId,
  properties,
}: {
  campaignId: string;
  propertyId: string | null;
  properties: { id: string; name: string }[];
}) {
  const [value, setValue] = React.useState(propertyId ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function onChange(next: string) {
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await setCampaignProperty(campaignId, next || null);
      if ("error" in result) {
        setValue(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="min-w-[9.5rem]">
      <select
        aria-label="Property for this campaign"
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-[12rem] truncate rounded-[3px] border border-transparent bg-transparent py-1 pl-1.5 pr-6 text-xs text-[var(--t-ink)] hover:border-[var(--t-divider)] focus:border-[var(--t-accent)] focus:outline-none disabled:opacity-60"
      >
        <option value="">Whole portfolio</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {error ? <p role="alert" className="mt-0.5 text-[11px] text-[#b91c1c]">{error}</p> : null}
    </div>
  );
}
