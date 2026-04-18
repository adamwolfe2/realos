import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import {
  resolveTenantByHostname,
  isPlatformHostname,
  isDevelopmentHostname,
  TENANT_HEADER_HOSTNAME,
  TENANT_HEADER_ORG_ID,
  TENANT_HEADER_SLUG,
} from "@/lib/tenancy/resolve";

// ---------------------------------------------------------------------------
// Route matchers.
// Admin + portal + tenant-scoped APIs must be authenticated.
// Webhooks, crons, and the chatbot endpoint must NOT be gated (they run
// unauthenticated via signed payloads).
// ---------------------------------------------------------------------------

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isPortalRoute = createRouteMatcher(["/portal(.*)"]);
const isApiAdminRoute = createRouteMatcher(["/api/admin(.*)"]);
const isApiTenantRoute = createRouteMatcher(["/api/tenant(.*)"]);
const isPublicApi = createRouteMatcher([
  "/api/webhooks(.*)",
  "/api/cron(.*)",
  "/api/chatbot(.*)",
  "/api/appfolio/webhook(.*)",
]);

// Paths that platform hostnames always own. Everything else on a platform
// hostname falls through to whatever Next.js app routing resolves.
// DECISION: rewrite target cannot use an underscore-prefixed folder because
// Next.js treats those as private and excludes them from routing (the PRD's
// `/_tenant` example would 404). We use `/tenant-site/...` instead, and the
// renderer at app/(tenant)/tenant-site/[[...path]]/page.tsx guards against
// direct hits by requiring the x-tenant-org-id header middleware sets.
const TENANT_RENDER_PREFIX = "/tenant-site";

// DECISION: We render tenant marketing sites under `/_tenant/...` via an
// internal URL rewrite. The `_tenant` segment lives inside `app/(tenant)/`
// in the App Router as `app/(tenant)/_tenant/[[...path]]/page.tsx`. Because
// it's reached only via rewrite, we also guard the page with a header check
// (see app/(tenant)/_tenant/[[...path]]/page.tsx). Route groups let us keep
// it out of the tenant URL segment while still giving it a dedicated layout.

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") ?? "";

  // 1. Webhooks + crons + chatbot endpoints bypass tenant routing entirely.
  if (isPublicApi(req)) return NextResponse.next();

  // 2. Never rewrite static assets or Next.js internals.
  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith(TENANT_RENDER_PREFIX)
  ) {
    // Still gate admin + portal APIs below.
  } else if (
    !isPlatformHostname(hostname) &&
    !isDevelopmentHostname(hostname) &&
    !hostname.endsWith(".vercel.app")
  ) {
    // 3. Non-platform hostname -> render as a tenant marketing site.
    // DECISION: wrap the DB lookup so any middleware-side DB outage
    // (missing DATABASE_URL, Neon cold start) degrades to 404 instead of a
    // 500 middleware invocation failure, which would break the whole domain.
    let tenant: Awaited<ReturnType<typeof resolveTenantByHostname>> = null;
    try {
      tenant = await resolveTenantByHostname(hostname);
    } catch (err) {
      console.error("[middleware] tenant resolve failed:", err);
      return new NextResponse("Tenant resolution failed", { status: 503 });
    }
    if (!tenant) {
      return new NextResponse("Tenant site not configured", { status: 404 });
    }

    const rewriteUrl = url.clone();
    rewriteUrl.pathname = `${TENANT_RENDER_PREFIX}${url.pathname}`;

    const response = NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: withTenantHeaders(req.headers, tenant.orgId, tenant.orgSlug, hostname),
      },
    });
    response.headers.set(TENANT_HEADER_ORG_ID, tenant.orgId);
    response.headers.set(TENANT_HEADER_SLUG, tenant.orgSlug);
    response.headers.set(TENANT_HEADER_HOSTNAME, hostname);
    return response;
  }

  // 4. Platform hostname. Gate admin + portal surfaces.
  if (isAdminRoute(req) || isApiAdminRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
    // Full agency-role check happens in app/admin/layout.tsx + requireAgency()
    // inside every /api/admin/* handler.
  }

  if (isPortalRoute(req) || isApiTenantRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
  }

  return NextResponse.next();
});

function withTenantHeaders(
  source: Headers,
  orgId: string,
  slug: string,
  hostname: string
): Headers {
  const next = new Headers(source);
  next.set(TENANT_HEADER_ORG_ID, orgId);
  next.set(TENANT_HEADER_SLUG, slug);
  next.set(TENANT_HEADER_HOSTNAME, hostname);
  return next;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
