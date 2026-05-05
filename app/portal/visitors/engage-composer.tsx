"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Inline composer rendered next to a live chat in /portal/visitors. Sends an
// outbound operator message into the visitor's chatbot widget. The widget
// polls /api/public/chatbot/inbox every few seconds and renders the message
// as an assistant turn — see ProactiveWidget.
export function EngageComposer({
  visitorId,
  sessionId,
  defaultPlaceholder,
}: {
  visitorId: string;
  sessionId: string;
  defaultPlaceholder?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [openWidget, setOpenWidget] = useState(true);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "ok" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  function send() {
    const trimmed = message.trim();
    if (!trimmed) {
      setStatus({ kind: "error", message: "Message is required" });
      return;
    }
    setStatus({ kind: "idle" });
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/tenant/visitors/${visitorId}/engage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: trimmed,
              sessionId,
              openWidget,
            }),
          }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setStatus({
            kind: "error",
            message: body.error ?? `Engage failed (${res.status})`,
          });
          return;
        }
        setStatus({ kind: "ok" });
        setMessage("");
        setOpen(false);
        router.refresh();
      } catch (err) {
        setStatus({
          kind: "error",
          message: err instanceof Error ? err.message : "Engage failed",
        });
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted transition-colors"
      >
        Engage
      </button>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2 w-full max-w-md">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder={
          defaultPlaceholder ??
          "Hi, I noticed you were checking out floor plans. Anything I can help with?"
        }
        aria-label="Message to send to visitor"
        className="w-full text-sm border border-border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary"
        disabled={pending}
        autoFocus
      />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={openWidget}
          onChange={(e) => setOpenWidget(e.target.checked)}
          disabled={pending}
          className="rounded"
        />
        Auto-open widget on the visitor&apos;s screen
      </label>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setStatus({ kind: "idle" });
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
          disabled={pending}
        >
          Cancel
        </button>
        <div className="flex items-center gap-2">
          {status.kind === "error" ? (
            <span className="text-[11px] text-destructive">
              {status.message}
            </span>
          ) : status.kind === "ok" ? (
            <span className="text-[11px] text-primary">Sent</span>
          ) : null}
          <button
            type="button"
            onClick={send}
            disabled={pending || !message.trim()}
            className="bg-primary text-primary-foreground px-4 py-1.5 text-xs font-semibold rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {pending ? "Sending..." : "Send to chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
