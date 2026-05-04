import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import {
  CreateApiKeyForm,
  RevokeApiKeyButton,
  RotateApiKeyButton,
} from "./api-key-forms";

export const metadata: Metadata = { title: "API keys" };
export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const scope = await requireScope();

  const keys = await prisma.apiKey.findMany({
    where: { orgId: scope.orgId },
    orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      createdAt: true,
      lastUsedAt: true,
      lastUsedIp: true,
      usageCount: true,
      revokedAt: true,
      expiresAt: true,
    },
  });

  const active = keys.filter((k) => !k.revokedAt);
  const revoked = keys.filter((k) => k.revokedAt);

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        eyebrow={
          <Link
            href="/portal/settings"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <span aria-hidden="true">←</span> Settings
          </Link>
        }
        title="API keys"
        description="Push leads, visitors, tours, and chatbot events into your CRM from any external system (Zapier, Typeform, Make, custom forms). Each key is scoped and auditable."
      />

      <section className="rounded-lg border border-border bg-card p-5 space-y-5">
        <div>
          <h2 className="text-sm font-semibold">Create a key</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Generated keys are shown exactly once. Store them in your
            integration vault (e.g. Zapier secrets) immediately.
          </p>
        </div>
        <CreateApiKeyForm />
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">Active keys</h2>
          <span className="text-[11px] text-muted-foreground">
            {active.length} active
          </span>
        </div>
        {active.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No active keys yet. Use the form above to create one.
          </p>
        ) : (
          <ul className="divide-y">
            {active.map((k) => (
              <ApiKeyRow
                key={k.id}
                id={k.id}
                name={k.name}
                prefix={k.keyPrefix}
                scopes={k.scopes}
                createdAt={k.createdAt}
                lastUsedAt={k.lastUsedAt}
                lastUsedIp={k.lastUsedIp}
                usageCount={k.usageCount}
                revokedAt={null}
                expiresAt={k.expiresAt}
              />
            ))}
          </ul>
        )}
      </section>

      {revoked.length > 0 ? (
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Revoked keys
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {revoked.length} revoked
            </span>
          </div>
          <ul className="divide-y">
            {revoked.map((k) => (
              <ApiKeyRow
                key={k.id}
                id={k.id}
                name={k.name}
                prefix={k.keyPrefix}
                scopes={k.scopes}
                createdAt={k.createdAt}
                lastUsedAt={k.lastUsedAt}
                lastUsedIp={k.lastUsedIp}
                usageCount={k.usageCount}
                revokedAt={k.revokedAt}
                expiresAt={k.expiresAt}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold">How to use</h2>
          <a
            href="https://docs.leasestack.co/api/ingest"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-foreground hover:underline underline-offset-2"
          >
            View full API docs ↗
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          Send a <code className="font-mono">POST</code> request to one of the
          ingest endpoints with your key in the{" "}
          <code className="font-mono">Authorization</code> header. All
          endpoints accept JSON, return JSON, and are tenant-scoped to the
          org that owns the key.
        </p>

        <div className="space-y-2">
          <div className="text-[11px] tracking-widest uppercase font-semibold text-muted-foreground">
            Example request
          </div>
          <pre className="border rounded p-3 bg-muted text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
{`curl -X POST https://www.leasestack.co/api/ingest/lead \\
  -H "Authorization: Bearer re_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "student@berkeley.edu",
    "firstName": "Alex",
    "lastName": "Chen",
    "source": "FORM",
    "phone": "+15105551234",
    "propertyId": "cuid-of-property"  // optional
  }'`}
          </pre>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] tracking-widest uppercase font-semibold text-muted-foreground">
            Example response (200 OK)
          </div>
          <pre className="border rounded p-3 bg-muted text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
{`{
  "ok": true,
  "lead": {
    "id": "cuid-of-newly-created-lead",
    "status": "NEW",
    "createdAt": "2026-05-04T07:25:00.000Z"
  }
}`}
          </pre>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] tracking-widest uppercase font-semibold text-muted-foreground">
            Status codes
          </div>
          <ul className="text-[11px] text-muted-foreground list-none pl-0 space-y-1">
            <li>
              <code className="font-mono text-emerald-700">200</code> · created
              or updated
            </li>
            <li>
              <code className="font-mono text-amber-700">400</code> · validation
              failed (missing required field, malformed email, etc.) — body
              includes <code className="font-mono">{`{ "error": ..., "details": [...] }`}</code>
            </li>
            <li>
              <code className="font-mono text-rose-700">401</code> · key missing,
              revoked, or expired
            </li>
            <li>
              <code className="font-mono text-rose-700">403</code> · key valid
              but lacks the required scope
            </li>
            <li>
              <code className="font-mono text-amber-700">429</code> · rate limit
              hit
            </li>
            <li>
              <code className="font-mono text-rose-700">500</code> · server
              error — safe to retry with exponential backoff
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] tracking-widest uppercase font-semibold text-muted-foreground">
            Rate limits
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            <strong>120 requests/minute per key</strong> across all ingest
            endpoints, burstable to 200. Webhook callers should retry on
            429 with exponential backoff (1s → 2s → 4s → 8s, max 5
            attempts). Sustained higher volume?{" "}
            <a
              href="mailto:hello@leasestack.co?subject=API rate limit increase"
              className="font-semibold text-foreground underline underline-offset-2"
            >
              Email us
            </a>{" "}
            for a per-tenant uplift.
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] tracking-widest uppercase font-semibold text-muted-foreground">
            Endpoints
          </div>
          <ul className="text-[11px] text-muted-foreground list-disc pl-5 space-y-1">
            <li>
              <code className="font-mono">POST /api/ingest/lead</code> · scope{" "}
              <code className="font-mono">ingest:lead</code>
            </li>
            <li>
              <code className="font-mono">POST /api/ingest/visitor</code> · scope{" "}
              <code className="font-mono">ingest:visitor</code>
            </li>
            <li>
              <code className="font-mono">POST /api/ingest/tour</code> · scope{" "}
              <code className="font-mono">ingest:tour</code>
            </li>
            <li>
              <code className="font-mono">POST /api/ingest/chatbot</code> · scope{" "}
              <code className="font-mono">ingest:chatbot</code>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function ApiKeyRow({
  id,
  name,
  prefix,
  scopes,
  createdAt,
  lastUsedAt,
  lastUsedIp,
  usageCount,
  revokedAt,
  expiresAt,
}: {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
  lastUsedIp: string | null;
  usageCount: number;
  revokedAt: Date | null;
  expiresAt: Date | null;
}) {
  const isRevoked = Boolean(revokedAt);
  // Compute expiry status. Three buckets so the chip can switch tone:
  // expired (rose), expiring soon ≤7d (amber), healthy (slate).
  const now = Date.now();
  const expiresIn =
    expiresAt && !isRevoked ? expiresAt.getTime() - now : null;
  const expiryBucket: "expired" | "soon" | "healthy" | "never" = !expiresAt
    ? "never"
    : expiresIn != null && expiresIn <= 0
      ? "expired"
      : expiresIn != null && expiresIn <= 7 * 24 * 60 * 60 * 1000
        ? "soon"
        : "healthy";
  const expiryToneClass =
    expiryBucket === "expired"
      ? "bg-rose-50 text-rose-700"
      : expiryBucket === "soon"
        ? "bg-amber-50 text-amber-800"
        : expiryBucket === "healthy"
          ? "bg-slate-100 text-slate-700"
          : "bg-slate-50 text-muted-foreground";
  const expiryLabel =
    expiryBucket === "expired"
      ? "Expired"
      : expiryBucket === "soon"
        ? `Expires ${formatDistanceToNow(expiresAt!, { addSuffix: true })}`
        : expiryBucket === "healthy"
          ? `Expires ${formatDistanceToNow(expiresAt!, { addSuffix: true })}`
          : "Never expires";

  return (
    <li
      className={`py-3 flex flex-wrap items-start gap-x-6 gap-y-2 justify-between ${
        isRevoked ? "text-muted-foreground" : ""
      }`}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{name}</span>
          <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
            {prefix}…
          </code>
          {isRevoked ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              Revoked
            </span>
          ) : (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${expiryToneClass}`}
            >
              {expiryLabel}
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
          <span>
            Scopes:{" "}
            <span className="font-mono">
              {scopes.length === 0 ? "—" : scopes.join(", ")}
            </span>
          </span>
          <span>
            Created {formatDistanceToNow(createdAt, { addSuffix: true })}
          </span>
          <span>
            {lastUsedAt
              ? `Last call ${formatDistanceToNow(lastUsedAt, {
                  addSuffix: true,
                })}${lastUsedIp ? ` · from ${lastUsedIp}` : ""}`
              : "No calls received yet"}
          </span>
          <span>
            {usageCount.toLocaleString()} total{" "}
            {usageCount === 1 ? "call" : "calls"}
          </span>
          {revokedAt ? (
            <span>
              Revoked {formatDistanceToNow(revokedAt, { addSuffix: true })}
            </span>
          ) : null}
        </div>
      </div>
      {!isRevoked ? (
        <div className="flex items-start gap-4">
          <RotateApiKeyButton id={id} name={name} />
          <RevokeApiKeyButton id={id} name={name} />
        </div>
      ) : null}
    </li>
  );
}
