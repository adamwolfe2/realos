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
      className="inline-flex items-center gap-1.5 rounded-[2px] px-3 py-2 text-[13px] font-semibold text-primary ring-1 ring-inset ring-primary/30 hover:bg-primary/5 disabled:opacity-50"
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
