"use client";

import Link from "next/link";

export default function CreativeRequestDetailError() {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center space-y-3 max-w-md mx-auto mt-8">
      <p className="text-sm font-semibold">Could not load creative request</p>
      <p className="text-xs text-muted-foreground">
        The request may have been deleted or you may not have access.
      </p>
      <Link
        href="/admin/creative-requests"
        className="inline-block text-xs px-3 py-2 border rounded-md hover:bg-muted transition-colors"
      >
        Creative queue
      </Link>
    </div>
  );
}
