import { prisma } from "@/lib/db";
import type { Organization } from "@prisma/client";

export type TenantContext = {
  orgId: string;
  orgSlug: string;
  orgName: string;
  propertyType: string;
  residentialSubtype: string | null;
  commercialSubtype: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  bringYourOwnSite: boolean;
};

// ---------------------------------------------------------------------------
// Platform domain helper. Reads NEXT_PUBLIC_PLATFORM_DOMAIN first (explicit),
// falls back to the hostname portion of NEXT_PUBLIC_APP_URL.
// DECISION: split platform + app URLs so dev/preview/prod can share the same
// resolution logic without rewriting the schema for every environment.
// ---------------------------------------------------------------------------

function getPlatformDomain(): string {
  const explicit = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN;
  if (explicit) return normalizeHost(explicit);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return "";
  try {
    return normalizeHost(new URL(appUrl).hostname);
  } catch {
    return "";
  }
}

function normalizeHost(input: string): string {
  return input
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Hostname -> tenant resolution.
// Lookup order:
//   1. Exact match on DomainBinding.hostname (custom domain)
//   2. Wildcard subdomain fallback: {slug}.{platformdomain}
// Returns null when no mapping exists (middleware returns 404 for unknown).
// ---------------------------------------------------------------------------

export async function resolveTenantByHostname(
  hostname: string
): Promise<TenantContext | null> {
  const host = normalizeHost(hostname);
  if (!host) return null;

  // DECISION: DB is optional here. If DATABASE_URL isn't set (first Vercel
  // deploy before Neon is wired, or a preview env without a branch) we fail
  // soft and return null so the middleware can treat the request as the
  // platform surface. That keeps marketing pages reachable even without DB.
  if (!process.env.DATABASE_URL) return null;

  // 1. Custom domain (DomainBinding).
  const domain = await prisma.domainBinding
    .findUnique({
      where: { hostname: host },
      include: { org: true },
    })
    .catch(() => null);

  if (domain?.org && domain.org.orgType === "CLIENT") {
    return toContext(domain.org);
  }

  // 2. Subdomain fallback on platform domain.
  const platform = getPlatformDomain();
  if (platform && host.endsWith(`.${platform}`)) {
    const slug = host.slice(0, host.length - (platform.length + 1));
    if (slug && slug !== "www") {
      const org = await prisma.organization
        .findUnique({ where: { slug } })
        .catch(() => null);
      if (org && org.orgType === "CLIENT") {
        return toContext(org);
      }
    }
  }

  return null;
}

export function isPlatformHostname(hostname: string): boolean {
  const host = normalizeHost(hostname);
  const platform = getPlatformDomain();
  if (!platform) return true; // default to platform if not configured
  return host === platform || host === `www.${platform}`;
}

// Vercel preview + localhost hostnames always count as the platform surface.
// DECISION: preview URLs must stay usable for internal QA without us having to
// pre-attach a DomainBinding for every preview deployment.
export function isDevelopmentHostname(hostname: string): boolean {
  const host = normalizeHost(hostname);
  return (
    host === "localhost" ||
    host.endsWith(".vercel.app") ||
    host.endsWith(".local") ||
    host.endsWith(".ngrok.io") ||
    host.endsWith(".ngrok-free.app")
  );
}

function toContext(org: Organization): TenantContext {
  return {
    orgId: org.id,
    orgSlug: org.slug,
    orgName: org.name,
    propertyType: org.propertyType,
    residentialSubtype: org.residentialSubtype ?? null,
    commercialSubtype: org.commercialSubtype ?? null,
    logoUrl: org.logoUrl,
    primaryColor: org.primaryColor,
    secondaryColor: org.secondaryColor,
    bringYourOwnSite: org.bringYourOwnSite,
  };
}

// ---------------------------------------------------------------------------
// Read tenant context from request headers (set by middleware).
// Used by app/_tenant/* layouts + tenant API routes.
// ---------------------------------------------------------------------------

export const TENANT_HEADER_ORG_ID = "x-tenant-org-id";
export const TENANT_HEADER_SLUG = "x-tenant-slug";
export const TENANT_HEADER_HOSTNAME = "x-tenant-hostname";

export function readTenantHeaders(headers: Headers): {
  orgId: string | null;
  slug: string | null;
  hostname: string | null;
} {
  return {
    orgId: headers.get(TENANT_HEADER_ORG_ID),
    slug: headers.get(TENANT_HEADER_SLUG),
    hostname: headers.get(TENANT_HEADER_HOSTNAME),
  };
}
