"use client";

import Link from "next/link";

export default function AppFolioError() {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center space-y-3 max-w-md mx-auto mt-8">
      <p className="text-sm font-semibold">Could not load AppFolio settings</p>
      <p className="text-xs text-muted-foreground">
        There was an error loading the integration settings.
      </p>
      <Link
        href="/portal/properties"
        className="inline-block text-xs px-3 py-2 border rounded-md hover:bg-muted transition-colors"
      >
        All properties
      </Link>
    </div>
  );
}
