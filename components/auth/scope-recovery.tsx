"use client";

import { useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/nextjs";

// ---------------------------------------------------------------------------
// ScopeRecovery — rendered by /admin and /portal layouts when getScope()
// returns null EVEN THOUGH middleware already authenticated the request
// (i.e. Clerk has a userId, but the server component resolved the scope to
// null on this pass — a known RSC/session race). The old behavior was
// `redirect("/sign-in")`, which Clerk immediately bounces back to
// /auth/redirect → destination → null → /sign-in: an infinite loop.
//
// Instead we attempt exactly ONE full reload (which almost always resolves
// the race because the session is fully established by the next request),
// then fall back to a terminal screen with manual recovery — never an
// automatic bounce, so the loop is structurally impossible.
// ---------------------------------------------------------------------------

const FLAG = "ls_scope_recovery_attempted";

export function ScopeRecovery() {
  const { signOut } = useClerk();
  const [phase, setPhase] = useState<"reloading" | "stuck">("reloading");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let attempted = "1";
    try {
      attempted = sessionStorage.getItem(FLAG) ?? "";
    } catch {
      attempted = "";
    }
    if (!attempted) {
      try {
        sessionStorage.setItem(FLAG, "1");
      } catch {
        /* ignore */
      }
      // One hard reload — full request re-runs middleware + resolves scope.
      window.location.reload();
      return;
    }
    // Already reloaded once and still null → stop. Clear the flag so a
    // manual retry starts fresh.
    try {
      sessionStorage.removeItem(FLAG);
    } catch {
      /* ignore */
    }
    setPhase("stuck");
  }, []);

  if (phase === "reloading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Finishing sign-in…</p>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <h2 className="text-lg font-semibold text-foreground mb-2">
          We couldn&apos;t verify your session
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Your sign-in didn&apos;t fully load. Try once more, or sign out and
          back in.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.removeItem(FLAG);
              } catch {
                /* ignore */
              }
              window.location.reload();
            }}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.removeItem(FLAG);
              } catch {
                /* ignore */
              }
              void signOut({ redirectUrl: "/sign-in" });
            }}
            className="px-4 py-2 text-sm font-medium rounded-md border border-border bg-background hover:bg-muted transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
