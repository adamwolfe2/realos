"use client";

import * as React from "react";
import { Check, Loader2, PenLine, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import {
  applyChatbotKnowledgeSuggestion,
  applyPopupProposal,
  dismissChatbotKnowledgeSuggestion,
  dismissSiteRecommendation,
} from "@/lib/actions/chatbot-learning-recommendations";
import { generateProposalsAction } from "./actions";

type Result = { ok: true; message: string } | { ok: false; error: string };

function useRun() {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [, start] = React.useTransition();
  const run = (key: string, fn: () => Promise<Result>, after?: () => void) => {
    setBusy(key);
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message);
        after?.();
      } else toast.error(r.error);
      setBusy(null);
    });
  };
  return { busy, run };
}

const field = "w-full rounded-[8px] border border-border bg-white px-3 py-2 text-[13px] leading-5 text-foreground outline-none focus:border-[var(--t-accent)] focus:ring-2 focus:ring-[var(--t-accent)]/15";
const primary = "inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-primary px-3 text-[12px] font-medium text-primary-foreground shadow-[0_1px_2px_rgba(11,21,48,0.12)] hover:brightness-110 disabled:opacity-50";
const quiet = "inline-flex h-8 items-center gap-1.5 px-2 text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50";

function Spin({ on, icon }: { on: boolean; icon: React.ReactNode }) {
  return on ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>{icon}</>;
}

/** Chatbot answer: approve the draft, edit it, or write SG's real answer. */
export function AnswerActions({ id, draft, needsAnswer }: { id: string; draft: string; needsAnswer: boolean }) {
  const [editing, setEditing] = React.useState(needsAnswer);
  const [text, setText] = React.useState(draft);
  const { busy, run } = useRun();
  const disabled = busy !== null;
  return (
    <div className={needsAnswer ? "space-y-2" : "mt-2 space-y-2"}>
      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={1200}
          placeholder={needsAnswer ? "Type SG's answer. It goes into this property's chatbot knowledge base." : undefined}
          aria-label={needsAnswer ? "SG's answer" : "Answer"}
          className={field}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || !text.trim()}
          onClick={() => run("apply", () => applyChatbotKnowledgeSuggestion({ id, text: text.trim() }))}
          className={primary}
        >
          <Spin on={busy === "apply"} icon={<Check className="h-3.5 w-3.5" />} />
          {needsAnswer ? "Save answer to chatbot" : "Approve"}
        </button>
        {!needsAnswer && !editing ? (
          <button type="button" disabled={disabled} onClick={() => setEditing(true)} className={quiet}>
            <PenLine className="h-3.5 w-3.5" />
            Edit
          </button>
        ) : null}
        <button type="button" disabled={disabled} onClick={() => run("dismiss", () => dismissChatbotKnowledgeSuggestion({ id }))} className={quiet}>
          <Spin on={busy === "dismiss"} icon={<X className="h-3.5 w-3.5" />} />
          Dismiss
        </button>
      </div>
    </div>
  );
}

type PopupCopy = { headline: string; body: string; ctaText: string; delaySeconds: number };

/** Pop-up tweak: approve as proposed or edit the copy and delay first. */
export function PopupActions({ id, proposed }: { id: string; proposed: PopupCopy }) {
  const [editing, setEditing] = React.useState(false);
  const [v, setV] = React.useState(proposed);
  const { busy, run } = useRun();
  const disabled = busy !== null;
  return (
    <div className="mt-3 space-y-2">
      {editing ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
          <input aria-label="Headline" maxLength={80} value={v.headline} onChange={(e) => setV({ ...v, headline: e.target.value })} className={field} />
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <input
              aria-label="Delay in seconds"
              type="number"
              min={0}
              max={120}
              value={v.delaySeconds}
              onChange={(e) => setV({ ...v, delaySeconds: Number(e.target.value) })}
              className={`${field} tabular-nums`}
            />
            s
          </label>
          <textarea aria-label="Body" rows={2} maxLength={300} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} className={`${field} sm:col-span-2`} />
          <input aria-label="Button text" maxLength={30} value={v.ctaText} onChange={(e) => setV({ ...v, ctaText: e.target.value })} className={field} />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={disabled} onClick={() => run("apply", () => applyPopupProposal({ id, ...v }))} className={primary}>
          <Spin on={busy === "apply"} icon={<Check className="h-3.5 w-3.5" />} />
          Approve and update pop-up
        </button>
        {!editing ? (
          <button type="button" disabled={disabled} onClick={() => setEditing(true)} className={quiet}>
            <PenLine className="h-3.5 w-3.5" />
            Edit
          </button>
        ) : null}
        <button type="button" disabled={disabled} onClick={() => run("dismiss", () => dismissSiteRecommendation({ id }))} className={quiet}>
          <Spin on={busy === "dismiss"} icon={<X className="h-3.5 w-3.5" />} />
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function GenerateProposalsButton() {
  const { busy, run } = useRun();
  return (
    <button
      type="button"
      disabled={busy !== null}
      onClick={() => run("gen", generateProposalsAction)}
      className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[8px] bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-[0_1px_2px_rgba(11,21,48,0.12)] hover:brightness-110 disabled:opacity-50"
    >
      <Spin on={busy === "gen"} icon={<Sparkles className="h-4 w-4" />} />
      {busy === "gen" ? "Generating..." : "Generate proposals"}
    </button>
  );
}
