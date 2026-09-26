"use client";

import { useEffect, useState } from "react";

// The root layout wraps tenant (customer) sites too. LeaseStack's own GTM,
// pixel and support chat must never load there, or LeaseStack would collect
// a customer's site visitors. The tenant layout renders
// <meta name="ls-tenant-site">; anything else is the platform surface.
export function PlatformOnly({ children }: { children: React.ReactNode }) {
  const [isPlatform, setIsPlatform] = useState(false);
  useEffect(() => {
    setIsPlatform(!document.querySelector('meta[name="ls-tenant-site"]'));
  }, []);
  return isPlatform ? <>{children}</> : null;
}
