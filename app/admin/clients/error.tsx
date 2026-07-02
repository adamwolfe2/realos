"use client";

export default function AdminClientsError() {
  return (
    <div className="rounded-lg border border-border bg-card p-5 text-center space-y-2 max-w-md mx-auto mt-6">
      <p className="text-sm font-semibold">Could not load clients</p>
      <p className="text-xs text-muted-foreground">Try refreshing the page.</p>
    </div>
  );
}
