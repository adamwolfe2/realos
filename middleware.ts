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
// ---------------------------------------------------------------------------

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isPortalRoute = createRouteMatcher(["/portal(.*)"]);
const isApiAdminRoute = createRouteMatcher(["/api/admin(.*)"]);
const isApiTenantRoute = createRouteMatcher(["/api/tenant(.*)"]);
const isPublicApi = createRouteMatcher([
  "/api/webhooks(.*)",
  "/api/cron(.*)",
  "/api/chatbot(.*)",
  "/api/public(.*)",
  "/api/appfolio/webhook(.*)",
]);

const TENANT_RENDER_PREFIX = "/tenant-site";

// DECISION: Clerk's publishable key must be a real Frontend API URL. If it
// isn't (placeholder or unset), clerkMiddleware itself throws at
// initialization. We detect that case up front and skip Clerk entirely for
// the marketing + tenant-site surfaces so the public site stays up even
// before real Clerk keys land on Vercel. Admin and portal still redirect
// to /sign-in unauthenticated.
function clerkIsConfigured(): boolean {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const sk = process.env.CLERK_SECRET_KEY ?? "";
  if (!pk || !sk) return false;
  // Real Clerk keys look like pk_live_xxx or pk_test_xxx with a valid base64
  // body that decodes to clerk.<domain>$. Our placeholder decodes to
  // ".example.com$" which we treat as unconfigured.
  try {
    const decoded = Buffer.from(pk.replace(/^pk_(test|live)_/, ""), "base64").toString(
      "utf8"
    );
    return !decoded.includes("example.com");
  } catch {
    return false;
  }
}

async function coreHandler(
  req: NextRequest,
  getAuth?: () => Promise<{ userId: string | null }>
) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") ?? "";

  if (isPublicApi(req)) return NextResponse.next();

  if (
    !url.pathname.startsWith("/_next") &&
    !url.pathname.startsWith("/api") &&
    !url.pathname.startsWith(TENANT_RENDER_PREFIX) &&
    !isPlatformHostname(hostname) &&
    !isDevelopmentHostname(hostname) &&
    !hostname.endsWith(".vercel.app")
  ) {
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

  // Platform hostname gates.
  if (isAdminRoute(req) || isApiAdminRoute(req)) {
    if (!getAuth) {
      // Clerk not configured; redirect to sign-in page which itself warns.
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
  }

  if (isPortalRoute(req) || isApiTenantRoute(req)) {
    if (!getAuth) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
  }

  return NextResponse.next();
}

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

const handler = clerkIsConfigured()
  ? clerkMiddleware(async (auth, req) => coreHandler(req, auth))
  : async (req: NextRequest) => coreHandler(req);

export default handler;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
