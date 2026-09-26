"use client";

import { useEffect, useState } from "react";
import { isPlatformBrowserHost } from "@/lib/tenancy/platform-host";

/** True once mounted on the LeaseStack platform host (false during SSR). */
export function usePlatformHost(): boolean {
  const [isPlatform, setIsPlatform] = useState(false);
  useEffect(() => {
    setIsPlatform(isPlatformBrowserHost(window.location.hostname));
  }, []);
  return isPlatform;
}

// The root layout wraps tenant (customer) sites too. LeaseStack's own GTM,
// pixel and support chat must never load there, or LeaseStack would collect
// a customer's site visitors.
export function PlatformOnly({ children }: { children: React.ReactNode }) {
  return usePlatformHost() ? <>{children}</> : null;
}
