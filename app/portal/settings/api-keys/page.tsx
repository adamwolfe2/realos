import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import {
  CreateApiKeyForm,
  RevokeApiKeyButton,
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
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-5 space-y-2">
        <h2 className="text-sm font-semibold">How to use</h2>
        <p className="text-xs text-muted-foreground">
          Send a <code className="font-mono">POST</code> request to one of the
          ingest endpoints with your key in the{" "}
          <code className="font-mono">Authorization</code> header.
        </p>
        <pre className="border rounded p-3 bg-muted text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
{`curl -X POST https://<your-app-domain>/api/ingest/lead \\
  -H "Authorization: Bearer re_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"email":"student@berkeley.edu","firstName":"Alex","source":"FORM"}'`}
        </pre>
        <ul className="text-[11px] text-muted-foreground list-disc pl-5 space-y-1">
          <li>
            <code className="font-mono">/api/ingest/lead</code> · scope{" "}
            <code className="font-mono">ingest:lead</code>
          </li>
          <li>
            <code className="font-mono">/api/ingest/visitor</code> · scope{" "}
            <code className="font-mono">ingest:visitor</code>
          </li>
          <li>
            <code className="font-mono">/api/ingest/tour</code> · scope{" "}
            <code className="font-mono">ingest:tour</code>
          </li>
          <li>
            <code className="font-mono">/api/ingest/chatbot</code> · scope{" "}
            <code className="font-mono">ingest:chatbot</code>
          </li>
        </ul>
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
}) {
  const isRevoked = Boolean(revokedAt);
  return (
    <li
      className={`py-3 flex flex-wrap items-start gap-x-6 gap-y-1 justify-between ${
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
          ) : null}
        </div>
        <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
          <span>
            Scopes:{" "}
            <span className="font-mono">
              {scopes.length === 0 ? "—" : scopes.join(", ")}
            </span>
          </span>
          <span>
            Created{" "}
            {formatDistanceToNow(createdAt, { addSuffix: true })}
          </span>
          <span>
            {lastUsedAt
              ? `Last used ${formatDistanceToNow(lastUsedAt, {
                  addSuffix: true,
                })}${lastUsedIp ? ` · ${lastUsedIp}` : ""}`
              : "Never used"}
          </span>
          <span>{usageCount.toLocaleString()} calls</span>
          {revokedAt ? (
            <span>
              Revoked{" "}
              {formatDistanceToNow(revokedAt, { addSuffix: true })}
            </span>
          ) : null}
        </div>
      </div>
      {!isRevoked ? (
        <RevokeApiKeyButton id={id} name={name} />
      ) : null}
    </li>
  );
}
