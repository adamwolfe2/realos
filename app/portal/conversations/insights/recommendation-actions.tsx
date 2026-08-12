"use client";

import * as React from "react";
import { Check, Loader2, PenLine, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import {
  applyChatbotKnowledgeSuggestion,
  dismissChatbotKnowledgeSuggestion,
  dismissConversationInsight,
  dismissSiteRecommendation,
  markSiteRecommendationPlanned,
  resolveConversationInsight,
} from "@/lib/actions/chatbot-learning-recommendations";

type ActionKind =
  | "applyKnowledge"
  | "dismissKnowledge"
  | "resolveInsight"
  | "dismissInsight"
  | "planSite"
  | "dismissSite";

type Props = {
  id: string;
  kind: "knowledge" | "insight" | "site";
};

const ACTIONS: Record<
  ActionKind,
  (input: { id: string }) => Promise<{ ok: true; message: string } | { ok: false; error: string }>
> = {
  applyKnowledge: applyChatbotKnowledgeSuggestion,
  dismissKnowledge: dismissChatbotKnowledgeSuggestion,
  resolveInsight: resolveConversationInsight,
  dismissInsight: dismissConversationInsight,
  planSite: markSiteRecommendationPlanned,
  dismissSite: dismissSiteRecommendation,
};

export function RecommendationActions({ id, kind }: Props) {
  const [pending, setPending] = React.useState<ActionKind | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const disabled = isPending || !!pending;

  function run(action: ActionKind) {
    setPending(action);
    startTransition(async () => {
      const result = await ACTIONS[action]({ id });
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
      setPending(null);
    });
  }

  if (kind === "knowledge") {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ActionButton
          label="Apply to chatbot"
          action="applyKnowledge"
          pending={pending}
          disabled={disabled}
          icon={<Wrench className="h-3.5 w-3.5" />}
          onClick={run}
        />
        <ActionButton
          label="Dismiss"
          action="dismissKnowledge"
          pending={pending}
          disabled={disabled}
          icon={<X className="h-3.5 w-3.5" />}
          onClick={run}
          quiet
        />
      </div>
    );
  }

  if (kind === "site") {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ActionButton
          label="Mark planned"
          action="planSite"
          pending={pending}
          disabled={disabled}
          icon={<PenLine className="h-3.5 w-3.5" />}
          onClick={run}
        />
        <ActionButton
          label="Dismiss"
          action="dismissSite"
          pending={pending}
          disabled={disabled}
          icon={<X className="h-3.5 w-3.5" />}
          onClick={run}
          quiet
        />
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <ActionButton
        label="Mark reviewed"
        action="resolveInsight"
        pending={pending}
        disabled={disabled}
        icon={<Check className="h-3.5 w-3.5" />}
        onClick={run}
      />
      <ActionButton
        label="Dismiss"
        action="dismissInsight"
        pending={pending}
        disabled={disabled}
        icon={<X className="h-3.5 w-3.5" />}
        onClick={run}
        quiet
      />
    </div>
  );
}

function ActionButton({
  action,
  disabled,
  icon,
  label,
  onClick,
  pending,
  quiet,
}: {
  action: ActionKind;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: (action: ActionKind) => void;
  pending: ActionKind | null;
  quiet?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(action)}
      disabled={disabled}
      className={
        quiet
          ? "inline-flex items-center gap-1.5 rounded-[2px] border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground disabled:opacity-50"
          : "inline-flex items-center gap-1.5 rounded-[2px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      }
    >
      {pending === action ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}
