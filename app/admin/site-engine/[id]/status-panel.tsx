"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { SiteRequestStatus } from "@prisma/client";
import {
  transitionStatus,
  updateInternalNotes,
  updateBuildArtifacts,
} from "./actions";

// ---------------------------------------------------------------------------
// Status / notes / artifacts panel for the admin detail page. Mutations go
// through the server actions in ./actions.ts. The panel is intentionally
// the only mutable surface on the detail page — every other section is
// read-only.
// ---------------------------------------------------------------------------

const ALL_STATUSES: SiteRequestStatus[] = [
  "SUBMITTED",
  "TRIAGE",
  "NEEDS_INFO",
  "DISQUALIFIED",
  "QUALIFIED",
  "INSPIRATION_EXTRACTION",
  "SPEC_REVIEW",
  "READY_TO_BUILD",
  "IN_BUILD",
  "PREVIEW_READY",
  "CLIENT_REVIEW",
  "REVISION_REQUESTED",
  "APPROVED",
  "DEPLOYED",
  "MAINTENANCE",
  "PAUSED",
  "CHURNED",
];

export interface StatusPanelProps {
  id: string;
  currentStatus: SiteRequestStatus;
  internalNotes: string | null;
  githubRepoUrl: string | null;
  vercelProjectId: string | null;
  vercelPreviewUrl: string | null;
  productionUrl: string | null;
}

export function StatusPanel(props: StatusPanelProps) {
  const router = useRouter();
  const [transitioning, setTransitioning] = React.useState(false);
  const [transitionMessage, setTransitionMessage] = React.useState("");
  const [pickerStatus, setPickerStatus] = React.useState<SiteRequestStatus>(
    props.currentStatus,
  );

  const [notes, setNotes] = React.useState(props.internalNotes ?? "");
  const [savingNotes, setSavingNotes] = React.useState(false);

  const [github, setGithub] = React.useState(props.githubRepoUrl ?? "");
  const [vercelProj, setVercelProj] = React.useState(props.vercelProjectId ?? "");
  const [preview, setPreview] = React.useState(props.vercelPreviewUrl ?? "");
  const [prod, setProd] = React.useState(props.productionUrl ?? "");
  const [savingArtifacts, setSavingArtifacts] = React.useState(false);

  const onTransition = async () => {
    setTransitioning(true);
    try {
      await transitionStatus(props.id, pickerStatus, transitionMessage || undefined);
      setTransitionMessage("");
      router.refresh();
    } finally {
      setTransitioning(false);
    }
  };

  const onSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await updateInternalNotes(props.id, notes);
      router.refresh();
    } finally {
      setSavingNotes(false);
    }
  };

  const onSaveArtifacts = async () => {
    setSavingArtifacts(true);
    try {
      await updateBuildArtifacts(props.id, {
        githubRepoUrl: github,
        vercelProjectId: vercelProj,
        vercelPreviewUrl: preview,
        productionUrl: prod,
      });
      router.refresh();
    } finally {
      setSavingArtifacts(false);
    }
  };

  // Suggest the next likely status based on the lifecycle.
  const suggestedNext = nextStatusFor(props.currentStatus);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Transition status</h3>
          <span className="text-xs text-muted-foreground">
            Current: <strong className="text-foreground">{humanStatus(props.currentStatus)}</strong>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_NEXT_STEPS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPickerStatus(s)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                pickerStatus === s
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background hover:bg-muted/40",
                suggestedNext === s ? "ring-1 ring-primary/40" : "",
              )}
            >
              {humanStatus(s)}
              {suggestedNext === s ? (
                <span className="ml-1 text-[10px] uppercase tracking-wider text-primary/80">
                  (next)
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">All statuses</summary>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-1">
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPickerStatus(s)}
                className={cn(
                  "px-2 py-1 rounded text-left text-xs",
                  pickerStatus === s
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-muted/40",
                )}
              >
                {humanStatus(s)}
              </button>
            ))}
          </div>
        </details>
        <Input
          value={transitionMessage}
          onChange={(e) => setTransitionMessage(e.target.value)}
          placeholder="Optional note (visible to client)"
        />
        <div className="flex justify-end">
          <Button
            onClick={onTransition}
            disabled={transitioning || pickerStatus === props.currentStatus}
          >
            {transitioning ? "Updating…" : `Move to ${humanStatus(pickerStatus)}`}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold">Internal notes</h3>
        <p className="text-xs text-muted-foreground">
          Never shown to the client. Use it as a scratchpad while you work the
          row.
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          className="w-full rounded-md border border-input bg-transparent p-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
        <div className="flex justify-end">
          <Button variant="outline" onClick={onSaveNotes} disabled={savingNotes}>
            {savingNotes ? "Saving…" : "Save notes"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold">Build artifacts</h3>
        <p className="text-xs text-muted-foreground">
          Paste these in once you've spun up the repo + Vercel project. They
          power the preview / production links on the client status page.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">GitHub repo URL</Label>
            <Input
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              placeholder="https://github.com/adamwolfe2/…"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Vercel project ID</Label>
            <Input
              value={vercelProj}
              onChange={(e) => setVercelProj(e.target.value)}
              placeholder="prj_xxxxxxxxxxxx"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Preview URL</Label>
            <Input
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              placeholder="https://*.vercel.app"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Production URL</Label>
            <Input
              value={prod}
              onChange={(e) => setProd(e.target.value)}
              placeholder="https://theirsite.com"
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={onSaveArtifacts}
            disabled={savingArtifacts}
          >
            {savingArtifacts ? "Saving…" : "Save artifacts"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Statuses most likely to come up in the next step. Keeps the picker
// short and visual; the full list lives behind the disclosure.
const QUICK_NEXT_STEPS: SiteRequestStatus[] = [
  "TRIAGE",
  "NEEDS_INFO",
  "QUALIFIED",
  "READY_TO_BUILD",
  "IN_BUILD",
  "PREVIEW_READY",
  "CLIENT_REVIEW",
  "REVISION_REQUESTED",
  "APPROVED",
  "DEPLOYED",
  "DISQUALIFIED",
  "PAUSED",
];

function nextStatusFor(s: SiteRequestStatus): SiteRequestStatus | null {
  switch (s) {
    case "SUBMITTED":
      return "TRIAGE";
    case "TRIAGE":
      return "QUALIFIED";
    case "NEEDS_INFO":
      return "QUALIFIED";
    case "QUALIFIED":
      return "INSPIRATION_EXTRACTION";
    case "INSPIRATION_EXTRACTION":
      return "SPEC_REVIEW";
    case "SPEC_REVIEW":
      return "READY_TO_BUILD";
    case "READY_TO_BUILD":
      return "IN_BUILD";
    case "IN_BUILD":
      return "PREVIEW_READY";
    case "PREVIEW_READY":
      return "CLIENT_REVIEW";
    case "CLIENT_REVIEW":
      return "APPROVED";
    case "REVISION_REQUESTED":
      return "IN_BUILD";
    case "APPROVED":
      return "DEPLOYED";
    case "DEPLOYED":
      return "MAINTENANCE";
    default:
      return null;
  }
}

function humanStatus(s: SiteRequestStatus): string {
  return s.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
