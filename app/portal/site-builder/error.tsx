"use client";

export default function SiteBuilderError() {
  return (
    <div className="ls-card p-8 text-center space-y-2 max-w-md mx-auto mt-8">
      <p className="text-sm font-semibold">Could not load site builder</p>
      <p className="text-xs text-muted-foreground">Try refreshing the page.</p>
    </div>
  );
}
