"use client";

export default function SettingsError() {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center space-y-2 max-w-md mx-auto mt-8">
      <p className="text-sm font-semibold">Could not load settings</p>
      <p className="text-xs text-muted-foreground">Try refreshing the page.</p>
    </div>
  );
}
