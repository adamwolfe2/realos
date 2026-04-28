"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Send, Download, FileDown, Webhook, Facebook, BarChart3, Check } from "lucide-react";
import { pushSegmentToDestination } from "@/lib/actions/audiences";

export type InlinePushDestination = {
  id: string;
  name: string;
  type: string;
};

type Status =
  | { kind: "idle" }
  | { kind: "pushing"; destinationId: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function InlinePush({
  segmentId,
  segmentName,
  destinations,
}: {
  segmentId: string;
  segmentName: string;
  destinations: InlinePushDestination[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, startTransition] = useTransition();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click-outside / Escape handler. Skip while a push is in flight so a
  // mis-click doesn't dismiss the success indicator.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (status.kind === "pushing") return;
      const node = wrapperRef.current;
      if (node && !node.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && status.kind !== "pushing") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, status.kind]);

  function handlePush(destination: InlinePushDestination) {
    setStatus({ kind: "pushing", destinationId: destination.id });
    startTransition(async () => {
      const result = await pushSegmentToDestination({
        segmentId,
        destinationId: destination.id,
      });
      if (!result.ok) {
        setStatus({ kind: "error", message: result.error });
        return;
      }
      if (result.csvBase64 && result.filename) {
        triggerCsvDownload(result.csvBase64, result.filename);
      }
      setStatus({
        kind: "success",
        message: `${result.memberCount.toLocaleString()} pushed to ${destination.name}`,
      });
      router.refresh();
      // Auto-collapse after a short success display
      window.setTimeout(() => {
        setStatus({ kind: "idle" });
        setOpen(false);
      }, 1800);
    });
  }

  if (destinations.length === 0) return null;

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!open) setStatus({ kind: "idle" });
          setOpen((v) => !v);
        }}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
          open
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Push ${segmentName}`}
      >
        <Send className="h-3 w-3" />
        Push
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={`Destinations for ${segmentName}`}
          className={cn(
            "absolute right-0 top-full mt-1 z-30 w-64 rounded-md border border-border bg-card shadow-lg",
            "py-1",
          )}
        >
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
            Push to destination
          </div>
          {destinations.map((d) => {
            const isPushing =
              status.kind === "pushing" && status.destinationId === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => handlePush(d)}
                disabled={pending}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
                  "hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                <DestinationIcon type={d.type} />
                <span className="flex-1 min-w-0 truncate">{d.name}</span>
                {isPushing ? (
                  <Spinner />
                ) : d.type === "CSV_DOWNLOAD" ? (
                  <Download className="h-3 w-3 text-muted-foreground" />
                ) : null}
              </button>
            );
          })}
          {status.kind === "success" ? (
            <div className="border-t border-border px-3 py-2 text-[11px] text-emerald-700 flex items-start gap-1.5">
              <Check className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{status.message}</span>
            </div>
          ) : null}
          {status.kind === "error" ? (
            <div className="border-t border-border px-3 py-2 text-[11px] text-rose-700">
              {status.message}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DestinationIcon({ type }: { type: string }) {
  const Icon =
    type === "CSV_DOWNLOAD"
      ? FileDown
      : type === "WEBHOOK"
        ? Webhook
        : type === "META_CUSTOM_AUDIENCE"
          ? Facebook
          : type === "GOOGLE_CUSTOMER_MATCH"
            ? BarChart3
            : Send;
  return <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

function Spinner() {
  return (
    <span className="inline-block h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  );
}

function triggerCsvDownload(base64: string, filename: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
