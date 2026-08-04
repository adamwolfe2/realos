"use client";

import { RouteErrorBoundary } from "@/components/ui/route-error-boundary";

export default function Error(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorBoundary
      {...props}
      surface="admin/clients/activation"
      title="Activation readiness unavailable"
      body="We couldn't load this client's activation evidence. Try again or return to the client list."
      homeHref="/admin/clients"
    />
  );
}
