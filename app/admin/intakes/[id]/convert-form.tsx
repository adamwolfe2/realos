"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ConvertIntakeForm({
  intakeId,
  defaultSlug,
  defaultPropertyName,
}: {
  intakeId: string;
  defaultSlug: string;
  defaultPropertyName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slug, setSlug] = useState(
    normalizeSlug(defaultSlug || defaultPropertyName)
  );
  const [customDomain, setCustomDomain] = useState("");
  const [firstPropertyName, setFirstPropertyName] = useState(
    defaultPropertyName
  );
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/intakes/${intakeId}/convert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: slug.trim() || undefined,
            customDomain: customDomain.trim() || undefined,
            firstPropertyName: firstPropertyName.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        const body = (await res.json()) as { orgId: string };
        router.push(`/admin/clients/${body.orgId}`);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Tenant provisioning failed"
        );
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs tracking-widest uppercase opacity-70">
            Slug
          </span>
          <input
            className="border rounded px-3 py-2 text-sm"
            value={slug}
            onChange={(e) => setSlug(normalizeSlug(e.target.value))}
            placeholder="tenant-slug"
            required
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs tracking-widest uppercase opacity-70">
            First property name
          </span>
          <input
            className="border rounded px-3 py-2 text-sm"
            value={firstPropertyName}
            onChange={(e) => setFirstPropertyName(e.target.value)}
            placeholder="Telegraph Commons"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-xs tracking-widest uppercase opacity-70">
          Custom domain (optional)
        </span>
        <input
          className="border rounded px-3 py-2 text-sm"
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value)}
          placeholder="telegraphcommons.com"
        />
        <span className="text-xs opacity-60">
          Attaches via the Vercel Domain API. Client still has to point DNS.
        </span>
      </label>

      {error ? (
        <p className="text-sm text-destructive border border-destructive/30 rounded p-3">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-foreground text-background px-4 py-2 text-xs font-semibold tracking-wide rounded disabled:opacity-40"
        >
          {pending ? "Provisioning…" : "Convert to tenant"}
        </button>
        <p className="text-xs opacity-60">
          Creates Organization, TenantSiteConfig, Project with the 28-task
          checklist, and links the intake submission.
        </p>
      </div>
    </form>
  );
}

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
