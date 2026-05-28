"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Audit start form. Submits the URL to /api/audit/start, then polls
// /api/audit/[id] until status === READY (or FAILED), then redirects
// to /audit/[shareToken]. Polling interval is 2s; we cap polls at ~90s
// so a stuck QUEUED row eventually surfaces a retry instead of spinning
// forever.

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90_000;

type Phase = "idle" | "starting" | "scanning" | "error";

interface StartResponse {
  auditId: string;
  shareToken: string;
  status: "QUEUED" | "RUNNING" | "READY" | "FAILED";
  cached?: boolean;
}
interface StatusResponse {
  id: string;
  status: "QUEUED" | "RUNNING" | "READY" | "FAILED";
  overallScore: number | null;
  shareToken: string;
  domain: string;
  hasEmail: boolean;
}

export function AuditForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [scannedDomain, setScannedDomain] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const redirect = useCallback(
    (token: string) => router.push(`/audit/${token}`),
    [router],
  );

  const startPolling = useCallback(
    (auditId: string, token: string, domain: string) => {
      setPhase("scanning");
      setScannedDomain(domain);
      const startedAt = Date.now();
      const poll = async () => {
        if (stoppedRef.current) return;
        try {
          const res = await fetch(`/api/audit/${auditId}`, {
            cache: "no-store",
          });
          if (!res.ok) throw new Error("Status check failed");
          const data: StatusResponse = await res.json();
          if (data.status === "READY") {
            if (pollRef.current) clearInterval(pollRef.current);
            redirect(token);
            return;
          }
          if (data.status === "FAILED") {
            if (pollRef.current) clearInterval(pollRef.current);
            setError("The scan failed. Try again in a moment.");
            setPhase("error");
            return;
          }
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            if (pollRef.current) clearInterval(pollRef.current);
            setError("Still working — open the report from this link.");
            setPhase("error");
          }
        } catch {
          // Transient — keep polling until timeout.
        }
      };
      pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
      void poll();
    },
    [redirect],
  );

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!url.trim() || phase !== "idle") return;
    setError(null);
    setPhase("starting");
    try {
      const res = await fetch("/api/audit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data: StartResponse | { error: string } = await res.json();
      if (!res.ok || "error" in data) {
        const msg = "error" in data ? data.error : "Could not start audit";
        setError(msg);
        setPhase("error");
        return;
      }
      if (data.status === "READY") {
        redirect(data.shareToken);
        return;
      }
      startPolling(data.auditId, data.shareToken, normalizeUrlForDisplay(url));
    } catch {
      setError("Network error. Try again.");
      setPhase("error");
    }
  }

  if (phase === "scanning" || phase === "starting") {
    return (
      <div className="rounded-xl border bg-white p-6" style={{ borderColor: "#E5E7EB" }}>
        <p className="text-sm" style={{ color: "#6B7280" }}>
          Scanning {scannedDomain ?? "your site"}…
        </p>
        <div
          className="mt-4 h-1.5 w-full rounded-full overflow-hidden"
          style={{ backgroundColor: "#F3F4F6" }}
        >
          <div
            className="h-full"
            style={{
              width: "100%",
              backgroundColor: "#2563EB",
              animation: "leasestack-audit-progress 1.4s ease-in-out infinite",
              transformOrigin: "0% 50%",
            }}
          />
        </div>
        <style jsx>{`
          @keyframes leasestack-audit-progress {
            0% { transform: scaleX(0); opacity: 0.4; }
            50% { transform: scaleX(0.75); opacity: 1; }
            100% { transform: scaleX(1); opacity: 0.4; }
          }
        `}</style>
        <p className="text-xs mt-3" style={{ color: "#9CA3AF" }}>
          This usually takes 30–60 seconds.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={submit}
        className="rounded-xl border bg-white p-4 sm:p-5 flex flex-col sm:flex-row gap-3"
        style={{ borderColor: "#E5E7EB" }}
      >
        <Input
          type="text"
          inputMode="url"
          autoComplete="off"
          placeholder="yourproperty.com"
          aria-label="Property website URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 h-11 text-base"
        />
        <Button type="submit" size="lg" disabled={!url.trim()}>
          Get my free audit
        </Button>
      </form>
      {error ? (
        <p className="text-sm px-1" style={{ color: "#B91C1C" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function normalizeUrlForDisplay(input: string): string {
  try {
    const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const u = new URL(withScheme);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return input;
  }
}
