"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ProvisionPixelButton({
  orgId,
  hasPixel,
}: {
  orgId: string;
  hasPixel: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function onClick() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/clients/${orgId}/provision-pixel`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Provision failed");
        return;
      }
      setResult(
        body.provisioned
          ? `Pixel provisioned on ${body.hostname}`
          : `Pixel already on file for ${body.hostname}`
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="border px-3 py-2 text-xs font-semibold tracking-wide rounded disabled:opacity-40"
      >
        {pending ? "Provisioning…" : hasPixel ? "Re-sync pixel" : "Provision pixel"}
      </button>
      {result ? (
        <span className="text-[11px] text-emerald-700">{result}</span>
      ) : null}
      {error ? (
        <span className="text-[11px] text-destructive">{error}</span>
      ) : null}
    </div>
  );
}
