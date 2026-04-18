"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  convertIntakeToClient,
  rejectIntake,
} from "@/lib/actions/convert-intake";

// ---------------------------------------------------------------------------
// Client wrapper for the admin "Convert to client" + "Mark rejected" actions.
// Server actions that return non-void payloads can't be used directly in
// <form action=...>. We call them imperatively from a transition + surface
// success/error to the operator.
// ---------------------------------------------------------------------------

type Props = {
  intakeId: string;
};

export function ConvertIntakeButton({ intakeId }: Props) {
  const router = useRouter();
  const [converting, startConvert] = useTransition();
  const [rejecting, startReject] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function onConvert() {
    setError(null);
    setNotice(null);
    startConvert(async () => {
      try {
        const result = await convertIntakeToClient(intakeId);
        if (!result.ok) {
          setError(result.error);
          if (result.orgId) {
            setNotice(
              `A partially provisioned client was created (orgId: ${result.orgId}). Inspect the client record and retry Clerk provisioning.`
            );
          }
          return;
        }
        router.push(`/admin/clients/${result.orgId}`);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Conversion failed"
        );
      }
    });
  }

  function onReject() {
    const reason = window.prompt(
      "Optional reason (visible in the audit log):",
      ""
    );
    if (reason === null) return; // user cancelled
    setError(null);
    setNotice(null);
    startReject(async () => {
      try {
        const result = await rejectIntake(intakeId, reason || undefined);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Rejection failed"
        );
      }
    });
  }

  const pending = converting || rejecting;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onConvert}
          disabled={pending}
          className="bg-foreground text-background px-4 py-2 text-xs font-semibold tracking-wide rounded disabled:opacity-40"
        >
          {converting ? "Converting…" : "Convert to client"}
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={pending}
          className="border px-4 py-2 text-xs font-semibold tracking-wide rounded disabled:opacity-40"
        >
          {rejecting ? "Rejecting…" : "Mark rejected"}
        </button>
      </div>
      {error ? (
        <p className="text-sm text-destructive border border-destructive/30 rounded p-3">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-xs opacity-70 border rounded p-3">{notice}</p>
      ) : null}
    </div>
  );
}
