# Sprint 02 — Multi-Tenancy & Custom Domain Routing

**Duration:** 1 day
**Dependencies:** Sprint 01 complete
**Goal:** Every request resolves to an `org_id`. Master admin sees everything, clients see only their data, tenant marketing sites render by hostname.

---

## Concepts

Three surfaces share one Next.js app, differentiated by hostname and path:

| Request pattern | Surface | Tenancy |
|-----------------|---------|---------|
| `{platformdomain}.com/*` | Platform marketing (no auth) | — |
| `{platformdomain}.com/admin/*` | Master admin | Requires AGENCY org |
| `{platformdomain}.com/portal/*` | Client portal | Scoped to user's CLIENT org |
| `{platformdomain}.com/onboarding` | Intake wizard | No org (pre-create) |
| `{clientdomain}.com/*` OR `{slug}.{platformdomain}.com/*` | Tenant marketing site | Scoped to tenant org by hostname |

---

## Step-by-step

### 1. Hostname → tenant resolver

Create `lib/tenancy/resolve.ts`:

```typescript
import { prisma } from "@/lib/db";

export type TenantContext = {
  orgId: string;
  orgSlug: string;
  orgName: string;
  propertyType: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
};

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_APP_URL?.replace("https://", "").replace("http://", "") ?? "";

export async function resolveTenantByHostname(hostname: string): Promise<TenantContext | null> {
  // Strip port and normalize
  const host = hostname.split(":")[0].toLowerCase();

  // Exact custom domain match first
  const domain = await prisma.domainBinding.findUnique({
    where: { hostname: host },
    include: { org: true },
  });

  if (domain) {
    return toContext(domain.org);
  }

  // Subdomain fallback: {slug}.{platformdomain}.com
  if (host.endsWith(`.${PLATFORM_DOMAIN}`)) {
    const slug = host.replace(`.${PLATFORM_DOMAIN}`, "");
    if (slug && slug !== "www") {
      const org = await prisma.organization.findUnique({
        where: { slug },
      });
      if (org && org.orgType === "CLIENT") {
        return toContext(org);
      }
    }
  }

  return null;
}

export function isPlatformHostname(hostname: string): boolean {
  const host = hostname.split(":")[0].toLowerCase();
  return host === PLATFORM_DOMAIN || host === `www.${PLATFORM_DOMAIN}`;
}

function toContext(org: any): TenantContext {
  return {
    orgId: org.id,
    orgSlug: org.slug,
    orgName: org.name,
    propertyType: org.propertyType,
    logoUrl: org.logoUrl,
    primaryColor: org.primaryColor,
    secondaryColor: org.secondaryColor,
  };
}
```

### 2. Middleware update

Extend Wholesail's `middleware.ts` to inject tenant context and route to the right surface:

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { resolveTenantByHostname, isPlatformHostname } from "@/lib/tenancy/resolve";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isPortalRoute = createRouteMatcher(["/portal(.*)"]);
const isApiAdminRoute = createRouteMatcher(["/api/admin(.*)"]);
const isApiTenantRoute = createRouteMatcher(["/api/tenant(.*)"]);
const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)", "/api/onboarding(.*)"]);
const isPublicApi = createRouteMatcher(["/api/webhooks(.*)", "/api/cron(.*)", "/api/chatbot(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") ?? "";

  // 1. Public assets + webhooks + crons pass through
  if (isPublicApi(req)) return NextResponse.next();

  // 2. If hostname is NOT the platform, render the tenant marketing site
  if (!isPlatformHostname(hostname)) {
    const tenant = await resolveTenantByHostname(hostname);
    if (!tenant) {
      return new NextResponse("Site not configured", { status: 404 });
    }
    // Rewrite to the tenant route group, pass tenant context via headers
    const rewriteUrl = url.clone();
    rewriteUrl.pathname = `/_tenant${url.pathname}`;
    const response = NextResponse.rewrite(rewriteUrl);
    response.headers.set("x-tenant-org-id", tenant.orgId);
    response.headers.set("x-tenant-slug", tenant.orgSlug);
    return response;
  }

  // 3. Platform hostname, various gates
  if (isAdminRoute(req) || isApiAdminRoute(req)) {
    const { userId, sessionClaims } = await auth();
    if (!userId) return NextResponse.redirect(new URL("/sign-in", req.url));
    // Full role check happens in layout/API handlers via scope.ts
  }

  if (isPortalRoute(req) || isApiTenantRoute(req)) {
    const { userId } = await auth();
    if (!userId) return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
```

Add an `app/_tenant/` route group that mirrors tenant marketing site structure (Sprint 07 fills this in). For now just create:

```typescript
// app/_tenant/layout.tsx
import { headers } from "next/headers";
import { prisma } from "@/lib/db";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const orgId = h.get("x-tenant-org-id");
  if (!orgId) return <div>Tenant not resolved</div>;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { tenantSiteConfig: true },
  });
  return <div data-tenant={org?.slug}>{children}</div>;
}

// app/_tenant/page.tsx (placeholder; Sprint 07 builds out)
export default function TenantHome() {
  return <main>Tenant marketing site (Sprint 07)</main>;
}
```

### 3. Prisma RLS-equivalent scope helper

Create `lib/tenancy/scope.ts`:

```typescript
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export type ScopedContext = {
  userId: string;
  orgId: string;                                        // Effective org (respects impersonation)
  actualOrgId: string;                                  // Real org from session
  role: string;
  isAgency: boolean;
  isImpersonating: boolean;
};

export async function getScope(): Promise<ScopedContext | null> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    include: { org: true },
  });
  if (!user) return null;

  const isAgency = user.org.orgType === "AGENCY";
  const impersonateOrgId = sessionClaims?.publicMetadata?.impersonateOrgId as string | undefined;

  return {
    userId: user.id,
    orgId: impersonateOrgId ?? user.orgId,
    actualOrgId: user.orgId,
    role: user.role,
    isAgency,
    isImpersonating: isAgency && !!impersonateOrgId,
  };
}

export async function requireAgency(): Promise<ScopedContext> {
  const scope = await getScope();
  if (!scope || !scope.isAgency) throw new Error("Forbidden: agency only");
  return scope;
}

export async function requireClient(): Promise<ScopedContext> {
  const scope = await getScope();
  if (!scope) throw new Error("Forbidden: not authenticated");
  return scope;
}

// Use in any query that should be tenant-scoped
export function tenantWhere(scope: ScopedContext) {
  return { orgId: scope.orgId };
}
```

### 4. Impersonation helper

Create `lib/tenancy/impersonate.ts`:

```typescript
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { requireAgency } from "./scope";

export async function startImpersonation(targetOrgId: string) {
  const scope = await requireAgency();
  const target = await prisma.organization.findUnique({ where: { id: targetOrgId } });
  if (!target || target.orgType !== "CLIENT") throw new Error("Invalid target");

  const client = await clerkClient();
  const user = await client.users.getUser(await resolveClerkUserId(scope.userId));
  await client.users.updateUserMetadata(user.id, {
    publicMetadata: { ...user.publicMetadata, impersonateOrgId: targetOrgId },
  });

  await prisma.auditEvent.create({
    data: {
      orgId: targetOrgId,
      userId: scope.userId,
      action: "IMPERSONATE_START",
      entityType: "Organization",
      entityId: targetOrgId,
      description: `Agency user ${scope.userId} started impersonating ${target.name}`,
    },
  });
}

export async function endImpersonation() {
  const scope = await requireAgency();
  const client = await clerkClient();
  const user = await client.users.getUser(await resolveClerkUserId(scope.userId));
  const newMeta = { ...user.publicMetadata };
  delete newMeta.impersonateOrgId;
  await client.users.updateUserMetadata(user.id, { publicMetadata: newMeta });

  if (scope.isImpersonating) {
    await prisma.auditEvent.create({
      data: {
        orgId: scope.orgId,
        userId: scope.userId,
        action: "IMPERSONATE_END",
        entityType: "Organization",
        entityId: scope.orgId,
      },
    });
  }
}

async function resolveClerkUserId(internalUserId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: internalUserId } });
  if (!u) throw new Error("User not found");
  return u.clerkUserId;
}
```

### 5. Vercel domain attachment

Create `lib/build/domain-attach.ts`:

```typescript
const VERCEL_API = "https://api.vercel.com";

export async function attachDomainToProject(hostname: string) {
  const res = await fetch(
    `${VERCEL_API}/v10/projects/${process.env.VERCEL_PROJECT_ID}/domains${process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : ""}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: hostname }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vercel domain attach failed: ${err}`);
  }
  return res.json();
}

export async function verifyDomain(hostname: string) {
  const res = await fetch(
    `${VERCEL_API}/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${hostname}/verify${process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : ""}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}` },
    }
  );
  if (!res.ok) {
    return { verified: false, error: await res.text() };
  }
  return res.json();
}

export async function getDomainStatus(hostname: string) {
  const res = await fetch(
    `${VERCEL_API}/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${hostname}${process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : ""}`,
    {
      headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}` },
    }
  );
  if (!res.ok) return null;
  return res.json();
}
```

### 6. Wildcard DNS setup (manual, documented)

Document in `docs/domains-setup.md`:
1. Add wildcard CNAME in your DNS: `*.{platformdomain}.com → cname.vercel-dns.com`
2. Add wildcard domain to Vercel project: `*.{platformdomain}.com`
3. For each client custom domain, they point their DNS `A` or `CNAME` to `cname.vercel-dns.com` and we call `attachDomainToProject(hostname)` to register it.

### 7. Admin layout gate

```typescript
// app/admin/layout.tsx
import { requireAgency } from "@/lib/tenancy/scope";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAgency();
  } catch {
    redirect("/portal");
  }
  return <div className="admin-shell">{children}</div>;
}
```

### 8. Portal layout gate

```typescript
// app/portal/layout.tsx
import { getScope } from "@/lib/tenancy/scope";
import { redirect } from "next/navigation";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const scope = await getScope();
  if (!scope) redirect("/sign-in");
  return <div className="portal-shell" data-impersonating={scope.isImpersonating}>{children}</div>;
}
```

### 9. Smoke test
- [ ] Visit `{platformdomain}.com` → renders platform marketing stub
- [ ] Visit `{platformdomain}.com/admin` → signed-out redirects to `/sign-in`, Adam signs in → reaches `/admin`, a regular client user → redirected to `/portal`
- [ ] Visit `telegraph-commons.{platformdomain}.com` → renders `/_tenant/page.tsx` stub
- [ ] Programmatic: call `attachDomainToProject("testdomain.com")` from a script, verify it shows up in Vercel dashboard
- [ ] Impersonation: from admin, hit a test endpoint that calls `startImpersonation(tcOrgId)`, confirm `getScope()` returns `orgId === tcOrgId` on next request

---

## Done when

- [ ] Three-way hostname routing works (platform / tenant subdomain / tenant custom domain)
- [ ] `requireAgency()` and `requireClient()` gate endpoints correctly
- [ ] Impersonation writes AuditEvents
- [ ] Vercel Domain API helpers work against a real test domain
- [ ] `tenantWhere(scope)` pattern is the ONLY way API routes query tenant data (code review this)

## Handoff to Sprint 03
Multi-tenancy is live. Sprint 03 rewrites the intake wizard so a new real estate client can submit their details, which creates an `IntakeSubmission` and (on approval) an `Organization`.
