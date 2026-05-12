import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";
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
  "/api/chat(.*)",
  "/api/chatbot(.*)",
  "/api/public(.*)",
  "/api/appfolio/webhook(.*)",
  "/api/health(.*)",
  "/api/ingest(.*)",
  "/api/subscribe(.*)",
  // /api/billing/checkout is the entry point from the public /pricing
  // page. Anonymous prospects POST here to start a Stripe Checkout
  // session BEFORE they have a Clerk account; the route handler
  // itself decides whether to require an existing scope or fall
  // back to the anonymous-Stripe-customer path. Letting middleware
  // gate it on auth would block the entire self-serve sale.
  //
  // Subscription mutation endpoints under /api/billing/* that DO
  // require auth still call requireScope() / requireWritableWorkspace()
  // internally — middleware just doesn't pre-empt them with a redirect.
  "/api/billing(.*)",
]);

// Routes that Clerk middleware MUST still wrap (so route handlers can
// call auth() without throwing) but which we don't want gated on auth.
// Different from isPublicApi — those skip Clerk entirely because the
// Clerk session handshake itself trips on weird webhook payload shapes
// (see comment on `handler` below). Billing checkout is a normal JSON
// POST from the public /pricing page; it needs auth() to be callable
// so getScope() can detect "anonymous prospect" vs "authed upgrade".
const isClerkOptionalApi = createRouteMatcher(["/api/billing(.*)"]);

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
  if (sk.includes("TODO") || sk.includes("placeholder")) return false;
  // Real Clerk keys look like pk_live_xxx or pk_test_xxx with a valid base64
  // body that decodes to clerk.<domain>$. Our placeholder decodes to a value
  // containing "example.com" which we treat as unconfigured. Use `atob` so
  // this works in the Edge runtime (no Buffer).
  try {
    const decoded = atob(pk.replace(/^pk_(test|live)_/, ""));
    return !decoded.includes("example.com") && !decoded.includes("placeholder");
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

  // SECURITY: any incoming x-tenant-* header is treated as untrusted and
  // must never reach a route handler. Otherwise a request like
  //   curl -H "x-tenant-org-id: <victim>" leasestack.co/api/tenant/listings
  // would return the victim's listings because readTenantHeaders() in
  // /api/tenant/listings + lib/tenancy/tenant-context just reads what the
  // request sent. We strip them here and re-set them only when the
  // legitimate hostname-rewrite branch below resolves a real tenant.
  // Use NextResponse.next() with a sanitized request-headers object so
  // the rewrite consumer (or pass-through route handler) sees a clean
  // baseline.
  const sanitizedReqHeaders = (() => {
    const h = new Headers(req.headers);
    h.delete(TENANT_HEADER_ORG_ID);
    h.delete(TENANT_HEADER_SLUG);
    h.delete(TENANT_HEADER_HOSTNAME);
    return h;
  })();

  // For Clerk-optional APIs we want `auth()` to work in the route handler
  // without forcing sign-in. coreHandler runs INSIDE clerkMiddleware for
  // these (handler() below routes them through wrappedHandler), and we
  // simply pass through here without hitting the admin/portal redirects.
  if (isPublicApi(req) || isClerkOptionalApi(req)) {
    return NextResponse.next({ request: { headers: sanitizedReqHeaders } });
  }

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

    // Pass a CLEAN base (already stripped of any incoming x-tenant-*
    // headers) into withTenantHeaders so only the values resolved from
    // hostname survive into the request-headers seen by the route.
    const response = NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: withTenantHeaders(
          sanitizedReqHeaders,
          tenant.orgId,
          tenant.orgSlug,
          hostname,
        ),
      },
    });
    response.headers.set(TENANT_HEADER_ORG_ID, tenant.orgId);
    response.headers.set(TENANT_HEADER_SLUG, tenant.orgSlug);
    response.headers.set(TENANT_HEADER_HOSTNAME, hostname);
    return response;
  }

  // DECISION: DEMO_MODE lets prospects (and us) click through /portal and
  // /admin without a Clerk session, using a seeded demo org resolved by
  // getScope(). Must be set explicitly (never ships-on-by-default). Both
  // NEXT_PUBLIC_DEMO_MODE and DEMO_MODE are accepted so the flag works
  // from Vercel UI regardless of which env surface the user filled in.
  const demoMode =
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.DEMO_MODE === "true";

  // Platform hostname gates. Every NextResponse.next() in this branch
  // forwards `sanitizedReqHeaders` so a downstream route handler can
  // never observe spoofed x-tenant-* headers from the original request.
  const passThrough = () =>
    NextResponse.next({ request: { headers: sanitizedReqHeaders } });

  if (isAdminRoute(req) || isApiAdminRoute(req)) {
    if (demoMode) return passThrough();
    if (!getAuth) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
  }

  if (isPortalRoute(req) || isApiTenantRoute(req)) {
    if (demoMode) return passThrough();
    if (!getAuth) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
  }

  return passThrough();
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

const wrappedHandler = clerkIsConfigured()
  ? clerkMiddleware(async (auth, req) => coreHandler(req, auth))
  : async (req: NextRequest) => coreHandler(req);

// Public APIs (third-party webhooks, crons, public ingest endpoints) skip
// the Clerk-wrapped handler entirely. Clerk's session handshake parses
// cookies/auth headers on every request and throws on payload shapes it
// doesn't expect — AL webhooks were tripping a `SyntaxError: Invalid
// character` from inside Clerk before our `coreHandler` could run, surfacing
// as Vercel's `MIDDLEWARE_INVOCATION_FAILED`. Short-circuiting here means
// these routes get NextResponse.next() with zero auth processing on their
// way to the route handler, where each one enforces its own auth scheme.
const handler = async (req: NextRequest, event: NextFetchEvent) => {
  // Only TRUE webhooks/cron skip Clerk entirely. Routes in
  // isClerkOptionalApi (e.g. /api/billing/*) still flow through
  // wrappedHandler so the Clerk context is initialised — otherwise
  // calls to auth() inside the route throw
  // "Clerk: auth() was called but Clerk can't detect usage of
  // clerkMiddleware()", which is what was bricking the public
  // /pricing → Stripe Checkout flow with HTTP 500s.
  if (isPublicApi(req) && !isClerkOptionalApi(req)) {
    return NextResponse.next();
  }
  return wrappedHandler(req, event);
};

export default handler;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
