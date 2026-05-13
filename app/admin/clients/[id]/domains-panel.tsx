"use client";

import { useEffect, useState, useTransition } from "react";
import {
  addClientDomain,
  removeClientDomain,
  setPrimaryDomain,
  verifyClientDomain,
} from "@/lib/actions/admin-domains";

type Binding = {
  id: string;
  hostname: string;
  isPrimary: boolean;
  sslStatus: string | null;
  dnsConfigured: boolean;
};

type DnsRecord = {
  type: "A" | "CNAME" | "TXT";
  host: string;
  value: string;
  reason: string;
};

type PendingVerification = {
  domainId: string;
  hostname: string;
  records: DnsRecord[];
  startedAt: number;
};

const POLL_INTERVAL_MS = 30_000;
const POLL_TIMEOUT_MS = 5 * 60_000;

export function DomainsPanel({
  orgId,
  initial,
  fallbackSlug,
}: {
  orgId: string;
  initial: Binding[];
  fallbackSlug: string;
}) {
  const [domains, setDomains] = useState<Binding[]>(initial);
  const [hostname, setHostname] = useState("");
  const [makePrimary, setMakePrimary] = useState(initial.length === 0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] =
    useState<PendingVerification | null>(null);

  useEffect(() => {
    setDomains(initial);
  }, [initial]);

  // Auto-verify after add: poll every 30s for up to 5 min, then stop.
  useEffect(() => {
    if (!pendingVerification) return;
    const tick = async () => {
      const elapsed = Date.now() - pendingVerification.startedAt;
      const res = await verifyClientDomain({
        domainId: pendingVerification.domainId,
      });
      if (res.ok && res.verified && res.dnsConfigured) {
        setPendingVerification(null);
        setDomains((prev) =>
          prev.map((d) =>
            d.id === pendingVerification.domainId
              ? { ...d, sslStatus: res.sslStatus, dnsConfigured: true }
              : d,
          ),
        );
        return;
      }
      if (elapsed > POLL_TIMEOUT_MS) {
        setPendingVerification(null);
      }
    };
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pendingVerification]);

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!hostname.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await addClientDomain({
        orgId,
        hostname: hostname.trim(),
        isPrimary: makePrimary,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setHostname("");
      setMakePrimary(false);
      const newBinding: Binding = {
        id: res.domainId,
        hostname: res.hostname,
        isPrimary: makePrimary,
        sslStatus: "pending",
        dnsConfigured: false,
      };
      setDomains((prev) => {
        const without = makePrimary
          ? prev.map((d) => ({ ...d, isPrimary: false }))
          : prev;
        return [
          ...without.filter((d) => d.id !== newBinding.id),
          newBinding,
        ];
      });
      setPendingVerification({
        domainId: res.domainId,
        hostname: res.hostname,
        records: res.dnsRecords as DnsRecord[],
        startedAt: Date.now(),
      });
    });
  }

  function onVerify(domainId: string) {
    startTransition(async () => {
      const res = await verifyClientDomain({ domainId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDomains((prev) =>
        prev.map((d) =>
          d.id === domainId
            ? {
                ...d,
                sslStatus: res.sslStatus,
                dnsConfigured: res.dnsConfigured,
              }
            : d,
        ),
      );
    });
  }

  function onRemove(domainId: string, host: string) {
    if (
      !confirm(
        `Remove ${host}? This detaches it from Vercel and deletes the binding.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await removeClientDomain({ domainId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDomains((prev) => prev.filter((d) => d.id !== domainId));
      if (pendingVerification?.domainId === domainId) {
        setPendingVerification(null);
      }
    });
  }

  function onSetPrimary(domainId: string) {
    startTransition(async () => {
      const res = await setPrimaryDomain({ domainId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDomains((prev) =>
        prev.map((d) => ({ ...d, isPrimary: d.id === domainId })),
      );
    });
  }

  return (
    <div className="space-y-4">
      {domains.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No custom domain attached. Fallback:{" "}
          <code className="text-foreground">{fallbackSlug}.leasestack.co</code>
        </p>
      ) : (
        <ul className="space-y-2">
          {domains.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-border/60 last:border-b-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <code className="text-sm font-medium text-foreground truncate">
                  {d.hostname}
                </code>
                {d.isPrimary ? (
                  <span className="text-[10px] uppercase tracking-wide bg-foreground/10 px-1.5 py-0.5 rounded">
                    Primary
                  </span>
                ) : null}
                <span
                  className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                    d.sslStatus === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : d.sslStatus === "failed"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  SSL {d.sslStatus ?? "pending"}
                </span>
                {!d.dnsConfigured ? (
                  <span className="text-[10px] uppercase tracking-wide bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded">
                    DNS
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onVerify(d.id)}
                  disabled={pending}
                  className="text-[11px] px-2 py-1 border border-border rounded hover:bg-muted/40 disabled:opacity-40"
                >
                  Verify
                </button>
                {!d.isPrimary ? (
                  <button
                    type="button"
                    onClick={() => onSetPrimary(d.id)}
                    disabled={pending}
                    className="text-[11px] px-2 py-1 border border-border rounded hover:bg-muted/40 disabled:opacity-40"
                  >
                    Set primary
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onRemove(d.id, d.hostname)}
                  disabled={pending}
                  className="text-[11px] px-2 py-1 border border-border rounded text-destructive hover:bg-destructive/10 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pendingVerification ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
          <div className="text-xs font-semibold text-amber-900">
            Set these DNS records at the registrar for {pendingVerification.hostname}
          </div>
          <p className="text-[11px] text-amber-900/80">
            Auto re-verifying every 30 seconds for the next 5 minutes. You can
            also click Verify any time.
          </p>
          <div className="rounded border border-amber-200 bg-card overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-amber-50 text-[10px] uppercase tracking-wide">
                <tr>
                  <th className="px-2 py-1.5 text-left">Type</th>
                  <th className="px-2 py-1.5 text-left">Host</th>
                  <th className="px-2 py-1.5 text-left">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200">
                {pendingVerification.records.map((r, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5 font-mono">{r.type}</td>
                    <td className="px-2 py-1.5 font-mono">{r.host}</td>
                    <td className="px-2 py-1.5 font-mono break-all">
                      {r.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <form onSubmit={onAdd} className="flex flex-wrap items-end gap-2 pt-2 border-t border-border">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Add custom domain
          </label>
          <input
            type="text"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            placeholder="example.com"
            className="mt-1 w-full text-sm rounded-md border border-border bg-card px-2.5 py-1.5"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground pb-1.5">
          <input
            type="checkbox"
            checked={makePrimary}
            onChange={(e) => setMakePrimary(e.target.checked)}
          />
          Set as primary
        </label>
        <button
          type="submit"
          disabled={pending || !hostname.trim()}
          className="text-xs px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary-dark transition-colors rounded-md disabled:opacity-40"
        >
          {pending ? "Working…" : "Add domain"}
        </button>
      </form>
      {error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
