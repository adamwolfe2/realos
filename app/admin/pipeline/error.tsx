"use client";

export default function AdminPageError() {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center space-y-2 max-w-md mx-auto mt-8">
      <p className="text-sm font-semibold">Could not load this page</p>
      <p className="text-xs text-muted-foreground">Try refreshing the page.</p>
    </div>
  );
}
