"use client";

import * as React from "react";
import { InstallSnippet } from "./install-snippet";
import type { ConnectionStatus } from "@/components/portal/ui/status-chip";
import { chatbotSnippet } from "@/lib/chatbot/snippet";

// ---------------------------------------------------------------------------
// Multi-property chatbot install snippet (Wave 3 phase 6).
//
// A multi-property org needs a DIFFERENT snippet per building
// (data-property="<slug>") so /api/public/chatbot/config resolves to that
// property's persona/knowledge base instead of the org default. Single-
// property orgs never see this — chatbot/page.tsx renders the plain
// <InstallSnippet> unchanged in that case.
// ---------------------------------------------------------------------------

type PropertyOption = { id: string; name: string; slug: string };

export function ChatbotInstallSnippetPicker({
  properties,
  snippetHost,
  orgSlug,
  status,
  lastActivityLabel,
  defaultCollapsed,
  step,
  bare,
}: {
  properties: PropertyOption[];
  snippetHost: string;
  orgSlug: string;
  status: ConnectionStatus;
  lastActivityLabel: string | null;
  defaultCollapsed: boolean;
  step?: number;
  bare?: boolean;
}) {
  const [selectedId, setSelectedId] = React.useState<string>("");
  const selected = properties.find((p) => p.id === selectedId) ?? null;

  const snippet = chatbotSnippet(snippetHost, orgSlug, selected?.slug);

  return (
    <InstallSnippet
      snippet={snippet}
      status={status}
      lastActivityLabel={lastActivityLabel}
      defaultCollapsed={defaultCollapsed}
      step={step}
      bare={bare}
      picker={
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12.5px] font-medium text-[var(--t-text)]">Property</span>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-9 rounded-[8px] border border-[var(--t-border)] bg-white px-3 text-[13.5px] sm:min-w-[260px]"
          >
            <option value="">All properties (matches the page URL)</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="text-[12px] text-[var(--t-muted)]">
            Each property&apos;s snippet loads its own name, greeting and knowledge.
          </span>
        </div>
      }
    />
  );
}
