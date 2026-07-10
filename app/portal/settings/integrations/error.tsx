"use client";

import Link from "next/link";

export default function IntegrationsError() {
  return (
    <div className="rounded-[2px] border border-border bg-card p-8 text-center space-y-3 max-w-md mx-auto mt-8">
      <p className="text-sm font-semibold">Could not load integrations</p>
      <p className="text-xs text-muted-foreground">Try refreshing the page.</p>
      <Link
        href="/portal/settings"
        className="inline-block text-xs px-3 py-2 border rounded-none hover:bg-muted transition-colors"
      >
        Settings
      </Link>
    </div>
  );
}
