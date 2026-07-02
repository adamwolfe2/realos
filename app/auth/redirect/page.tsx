"use client";

/**
 * Smart auth redirect — runs after Clerk sign-in or sign-up.
 *
 * Two resilience features the previous version lacked:
 *   1. Retries the /api/auth/role fetch up to 4 times with backoff. The
 *      Clerk session sometimes propagates to the server a beat behind
 *      the client, producing a transient 401. Without retry, brand-new
 *      sign-ups would dead-end on an "auth-failed" message.
 *   2. Reads the `created` flag from the response and routes fresh
 *      sign-ups to /portal/setup (the welcome wizard) instead of the
 *      empty dashboard at /portal.
 */
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

type RoleResponse = {
  role: string | null;
  orgType: string | null;
  orgSlug?: string | null;
  created?: boolean;
};

async function fetchRoleWithRetry(): Promise<RoleResponse | null> {
  const delays = [0, 400, 800, 1600];
  let lastErr: unknown = null;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) {
      await new Promise((r) => setTimeout(r, delays[i]));
    }
    try {
      const res = await fetch("/api/auth/role", {
        cache: "no-store",
        credentials: "include",
      });
      // 401 is the typical "session not yet propagated" symptom — retry.
      // 5xx is also worth retrying; the server may be in a transient
      // bad state during cold-start or migration. 4xx-other returns
      // null role which we treat as a final answer.
      if (res.status === 401 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as RoleResponse;
      // If the server explicitly says "role: null" treat that as a final
      // answer (the user has no usable account) rather than retrying
      // forever.
      return json;
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr)
    console.warn("[auth/redirect] role fetch retries exhausted:", lastErr);
  return null;
}

export default function AuthRedirectPage() {
  const { userId, isLoaded } = useAuth();
  const [error, setError] = useState<string | null>(null);
  // Tracks how long we've waited for Clerk to surface a userId on THIS
  // origin. A signed-in user landing here can briefly read userId === null
  // while the Clerk client hydrates the session from the Frontend API. The
  // previous code did `router.replace("/sign-in")` on that transient null —
  // but Clerk's <SignIn forceRedirectUrl="/auth/redirect"> immediately
  // bounces an already-signed-in user straight back here, so the two pages
  // ping-pong dozens of times a second (observed in prod edge logs). We
  // NEVER auto-navigate to /sign-in anymore: we wait out the hydration, and
  // only after a hard timeout do we render a TERMINAL manual screen (a link,
  // not an auto-redirect). That makes the loop structurally impossible.
  const [signedOut, setSignedOut] = useState(false);

  // Hydration grace period. If Clerk reports loaded-but-no-user, give the
  // session a few seconds to populate before concluding the user is truly
  // signed out. Resolves the moment userId appears.
  useEffect(() => {
    if (!isLoaded || userId) return;
    const t = setTimeout(() => setSignedOut(true), 4000);
    return () => clearTimeout(t);
  }, [isLoaded, userId]);

  useEffect(() => {
    if (!isLoaded || !userId) return;

    fetchRoleWithRetry()
      .then((data) => {
        if (!data) {
          setError("auth-failed");
          return;
        }
        const { role, orgType, created } = data;
        const agencyRoles = ["AGENCY_OWNER", "AGENCY_ADMIN", "AGENCY_OPERATOR"];
        const clientRoles = [
          "CLIENT_OWNER",
          "CLIENT_ADMIN",
          "CLIENT_VIEWER",
          "LEASING_AGENT",
        ];

        if (!role) {
          setError("no-role");
          return;
        }
        // HARD navigation (full document load), NOT router.replace (soft
        // RSC nav). A soft nav fetches the destination's RSC payload
        // WITHOUT routing the request through Clerk's middleware
        // handshake, so the just-issued session cookie isn't applied
        // server-side → getScope() returns null on /admin or /portal →
        // requireAgency/requireScope throws "Not authenticated" → the
        // layout bounces to /sign-in → Clerk (signed in) → /auth/redirect
        // → INFINITE LOOP. A full-page navigation forces the request
        // through middleware so the session + handshake apply and the
        // destination resolves the scope correctly.
        if (agencyRoles.includes(role) || orgType === "AGENCY") {
          window.location.assign("/admin");
        } else if (clientRoles.includes(role) || orgType === "CLIENT") {
          // Fresh self-provisioned org → drop them into the marketplace
          // so they can pick which modules to activate (every module is
          // free during the trial). Returning users go straight to the
          // dashboard; the marketplace is always reachable from the nav.
          window.location.assign(created ? "/portal/marketplace" : "/portal");
        } else {
          setError("no-role");
        }
      })
      .catch(() => {
        setError("auth-failed");
      });
  }, [isLoaded, userId]);

  // Terminal signed-out screen. Reached only after the hydration grace
  // period elapses with no session on this origin. A MANUAL link — never an
  // automatic router.replace — so we can't ping-pong with Clerk's <SignIn>
  // forceRedirectUrl bounce.
  if (signedOut && !userId) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-sm text-ink/60 mb-4">
            You&apos;re signed out. Sign in to continue.
          </p>
          <a
            href="/sign-in"
            className="inline-block px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-dark transition-colors"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-sm text-ink/60 mb-4">
            {error === "no-role"
              ? "Your account is not set up yet. Please contact your administrator."
              : "There was a problem verifying your account. Please try again."}
          </p>
          <div className="flex gap-3 justify-center">
            <a
              href="/"
              className="px-4 py-2 text-sm font-medium border border-shell bg-white hover:bg-cream transition-colors"
            >
              Go home
            </a>
            <button
              onClick={() => {
                setError(null);
                window.location.reload();
              }}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-dark transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <p className="text-sm text-ink/40">Redirecting…</p>
    </div>
  );
}
