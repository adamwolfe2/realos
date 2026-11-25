"use client";

import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { runConversationLearningAction } from "./actions";

export function RunLearningButton() {
  const [pending, startTransition] = React.useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await runConversationLearningAction();
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        });
      }}
      className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[8px] border border-border bg-card px-3 text-[13px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      Run learning pass
    </button>
  );
}
