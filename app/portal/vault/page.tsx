import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { KeyRound, Plus, Upload, Lock } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { Prisma } from "@prisma/client";
import { VaultClient } from "./vault-client";

export const metadata: Metadata = { title: "Vault" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/vault — Credentials vault
//
// Centralized credentials for every external platform an operator
// touches (AppFolio, GA4, Meta Ads, listing portals, banking, vendor
// logins, etc.). Encrypted at rest with envelope encryption — the DB
// stores only ciphertext + IV + auth tag; the master KEK lives in env.
//
// Page renders the list (masked) + a client component handles all
// mutations (create/edit/delete/reveal/CSV import). Plaintext only
// crosses the wire on explicit click-to-reveal, rate-limited per-user.
//
// See docs/PRD-CREDENTIALS-VAULT.md.
// ---------------------------------------------------------------------------

export default async function VaultPage() {
  const scope = await requireScope();

  // Module gate. Vault is a paid add-on. Org without moduleVault sees a
  // pitch screen instead of a blank table.
  const org = await prisma.organization.findUnique({
    where: { id: scope.orgId },
    select: { moduleVault: true, name: true },
  });
  const moduleEnabled = !!org?.moduleVault;

  // Build the where clause with both tenant scope + property RBAC. A
  // restricted user with allowedPropertyIds=[a,b] sees org-wide rows
  // (propertyId=null) PLUS rows on properties a or b. An unrestricted
  // user sees everything in the org.
  const propertyGate: Prisma.CredentialEntryWhereInput = scope.allowedPropertyIds
    ? {
        OR: [
          { propertyId: null },
          { propertyId: { in: scope.allowedPropertyIds } },
        ],
      }
    : {};

  const [entries, properties, recentReveals] = await Promise.all([
    prisma.credentialEntry.findMany({
      where: {
        ...tenantWhere(scope),
        deletedAt: null,
        ...propertyGate,
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
      include: {
        property: { select: { id: true, name: true } },
      },
    }),
    prisma.property.findMany({
      where: { orgId: scope.orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.credentialAccessLog.count({
      where: {
        orgId: scope.orgId,
        action: "reveal",
        occurredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  // Strip the encrypted secret fields before passing rows to the
  // client. The list view never needs ciphertext — it's only fetched
  // via revealCredential server action when the operator clicks Reveal.
  const safeEntries = entries.map((e) => ({
    id: e.id,
    name: e.name,
    platform: e.platform,
    websiteUrl: e.websiteUrl,
    username: e.username,
    notes: e.notes,
    tags: e.tags,
    propertyId: e.propertyId,
    property: e.property,
    lastRevealedAt: e.lastRevealedAt ? e.lastRevealedAt.toISOString() : null,
    lastRotatedAt: e.lastRotatedAt ? e.lastRotatedAt.toISOString() : null,
    expiresAt: e.expiresAt ? e.expiresAt.toISOString() : null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }));

  if (!moduleEnabled) {
    return (
      <div className="space-y-3">
        <PageHeader
          title="Vault"
          description="Encrypted credentials for every platform your team logs into."
        />
        <SectionCard label="" padded={false}>
          <div className="px-6 py-12 flex flex-col items-center text-center">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <KeyRound className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold text-foreground tracking-tight">
              Credentials Vault
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Stop chasing logins across Word docs and sticky notes. Store
              every platform credential (GA4, Meta Ads, AppFolio, banking,
              vendor portals) encrypted at rest, scoped per property,
              accessible to anyone you authorize. Every reveal is logged.
            </p>
            <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              AES-256-GCM · envelope encryption · audit log on every read
            </div>
            <Link
              href="/portal/billing"
              className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Enable Vault
            </Link>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Or contact your account manager to add it to your plan.
            </p>
          </div>
        </SectionCard>
      </div>
    );
  }

  const propertyOptions = properties.filter((p) =>
    scope.allowedPropertyIds ? scope.allowedPropertyIds.includes(p.id) : true,
  );

  return (
    <div className="space-y-3">
      <PageHeader
        title="Vault"
        description="Encrypted credentials for every external platform. Click a row to reveal — every reveal is logged."
      />

      <SectionCard label="" padded={false}>
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">
                {entries.length}
              </span>{" "}
              credentials
            </span>
            <span>
              <span className="font-semibold text-foreground">
                {recentReveals}
              </span>{" "}
              reveals in last 24h
            </span>
          </div>
          <div className="flex items-center gap-2">
            <VaultImportButton properties={propertyOptions} />
            <VaultNewButton properties={propertyOptions} />
          </div>
        </div>

        <VaultClient entries={safeEntries} properties={propertyOptions} />
      </SectionCard>

      <p className="px-1 text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
        <Lock className="h-3 w-3" />
        Stored with AES-256-GCM. Master key never leaves the server.
        Every reveal writes an audit row visible in /portal/settings/audit-log.
      </p>
    </div>
  );
}

// Tiny header-actions wrappers — these render server-side but trigger
// the client component's modal state via global window events. Kept
// thin so the bulk of the UX lives in vault-client.tsx alongside the
// state it owns.

function VaultNewButton({
  properties,
}: {
  properties: { id: string; name: string }[];
}) {
  return (
    <button
      type="button"
      data-vault-action="new"
      // Properties prop is passed via the parent client component; this
      // button just dispatches a custom event the parent listens to.
      data-properties-count={properties.length}
      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
    >
      <Plus className="h-3 w-3" />
      New credential
    </button>
  );
}

function VaultImportButton({
  properties,
}: {
  properties: { id: string; name: string }[];
}) {
  return (
    <button
      type="button"
      data-vault-action="import"
      data-properties-count={properties.length}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
    >
      <Upload className="h-3 w-3" />
      Import CSV
    </button>
  );
}
