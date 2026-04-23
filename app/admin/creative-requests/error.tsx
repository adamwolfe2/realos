"use client";

export default function CreativeRequestsError() {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center space-y-2 max-w-md mx-auto mt-8">
      <p className="text-sm font-semibold">Could not load creative queue</p>
      <p className="text-xs text-muted-foreground">Try refreshing the page.</p>
    </div>
  );
}
