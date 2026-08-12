"use client";

import * as React from "react";
import { Check, Clock3, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import {
  sendLeadFollowUpDraft,
  updateLeadFollowUpTaskStatus,
} from "@/lib/actions/lead-follow-up-tasks";

type Draft = {
  id: string;
  channel: "EMAIL" | "SMS" | "CALL" | "INTERNAL_NOTE";
  subject: string | null;
  body: string;
};

type Props = {
  task: {
    id: string;
    taskType: string;
    priority: number;
    recommendedChannel: string;
    reasonSummary: string;
    drafts: Draft[];
    learningCase: { reasonSummary: string } | null;
  };
};

export function AiFollowUpTaskCard({ task }: Props) {
  const draft = task.drafts[0] ?? null;
  const [subject, setSubject] = React.useState(draft?.subject ?? "");
  const [body, setBody] = React.useState(draft?.body ?? "");
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const disabled = isPending || !!pendingAction;
  const canSend = !!draft && (draft.channel === "EMAIL" || draft.channel === "SMS");

  function runTaskAction(action: "approve" | "dismiss" | "snooze") {
    setPendingAction(action);
    startTransition(async () => {
      const result = await updateLeadFollowUpTaskStatus({
        taskId: task.id,
        action,
      });
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
      setPendingAction(null);
    });
  }

  function sendDraft() {
    if (!draft || !body.trim()) return;
    setPendingAction("send");
    startTransition(async () => {
      const result = await sendLeadFollowUpDraft({
        taskId: task.id,
        draftId: draft.id,
        subject: subject.trim() || undefined,
        body: body.trim(),
      });
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
      setPendingAction(null);
    });
  }

  return (
    <article className="rounded-[2px] border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-[2px] bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Priority {task.priority}
        </span>
        <span className="rounded-[2px] bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {task.taskType.replaceAll("_", " ").toLowerCase()}
        </span>
        <span className="rounded-[2px] bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {task.recommendedChannel}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">
        {task.reasonSummary}
      </p>
      {task.learningCase?.reasonSummary ? (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {task.learningCase.reasonSummary}
        </p>
      ) : null}
      {draft ? (
        <div className="mt-3 space-y-2 rounded-[2px] border border-border bg-card p-3">
          {draft.channel === "EMAIL" ? (
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              disabled={disabled}
              maxLength={200}
              className="w-full rounded-[2px] border border-border bg-background px-2 py-1.5 text-xs font-semibold text-foreground"
            />
          ) : null}
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            disabled={disabled}
            rows={draft.channel === "SMS" ? 4 : 7}
            maxLength={draft.channel === "SMS" ? 1600 : 8000}
            className="w-full resize-none rounded-[2px] border border-border bg-background px-2 py-1.5 text-xs leading-5 text-muted-foreground"
          />
          <p className="text-[10px] text-muted-foreground">
            Review and edit before sending. LeaseStack will mark the task sent only after delivery succeeds.
          </p>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canSend ? (
          <button
            type="button"
            onClick={sendDraft}
            disabled={disabled || !body.trim()}
            className="inline-flex items-center gap-1.5 rounded-[2px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {pendingAction === "send" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send draft
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => runTaskAction("approve")}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-[2px] border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Approve
        </button>
        <button
          type="button"
          onClick={() => runTaskAction("snooze")}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-[2px] border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-50"
        >
          <Clock3 className="h-3.5 w-3.5" />
          Snooze 3d
        </button>
        <button
          type="button"
          onClick={() => runTaskAction("dismiss")}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-[2px] border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Dismiss
        </button>
      </div>
    </article>
  );
}
