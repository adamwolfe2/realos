"use client";

import Link from "next/link";

export default function ConversationError() {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3 max-w-md mx-auto mt-8">
      <p className="text-sm font-semibold">Could not load conversation</p>
      <p className="text-xs text-muted-foreground">
        The conversation may have been deleted or you may not have access.
      </p>
      <Link
        href="/portal/conversations"
        className="inline-block text-xs px-3 py-2 border rounded-md hover:bg-muted transition-colors"
      >
        All conversations
      </Link>
    </div>
  );
}
