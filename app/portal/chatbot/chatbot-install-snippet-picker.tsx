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
}: {
  properties: PropertyOption[];
  snippetHost: string;
  orgSlug: string;
  status: ConnectionStatus;
  lastActivityLabel: string | null;
  defaultCollapsed: boolean;
}) {
  const [selectedId, setSelectedId] = React.useState<string>("");
  const selected = properties.find((p) => p.id === selectedId) ?? null;

  const snippet = chatbotSnippet(snippetHost, orgSlug, selected?.slug);

  return (
    <div className="space-y-3">
      <div className="ls-card p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Which property is this snippet for?
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Each building gets its own snippet so the widget serves that
            property&apos;s persona, greeting, and knowledge base.
          </p>
        </div>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="ls-select px-3 py-2 text-sm w-full sm:w-auto sm:min-w-[280px]"
        >
          <option value="">Org default (no property scoping)</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <div className="text-[11px] text-muted-foreground leading-relaxed space-y-1.5 border-t border-border pt-3">
          <p className="font-medium text-foreground">Where to paste it</p>
          <p>
            <span className="font-medium text-foreground">
              Each property has its own site:
            </span>{" "}
            paste that building&apos;s snippet in the site-wide{" "}
            <code>&lt;head&gt;</code> — every page on the site keeps the same{" "}
            <code>data-property</code>.
          </p>
          <p>
            <span className="font-medium text-foreground">
              One corporate site, one community:
            </span>{" "}
            paste the property-scoped snippet only on that community&apos;s
            pages, not site-wide — the widget only mounts where the tag is
            present.
          </p>
          <p>
            <span className="font-medium text-foreground">
              One corporate site, all communities:
            </span>{" "}
            you&apos;d need a different <code>data-property</code> templated
            per community page. Without that, paste the org-default snippet
            and the widget falls back to matching the property slug in the
            page URL — it only works if the URL actually contains the slug.
          </p>
        </div>
      </div>

      <InstallSnippet
        snippet={snippet}
        status={status}
        lastActivityLabel={lastActivityLabel}
        defaultCollapsed={defaultCollapsed}
      />
    </div>
  );
}
