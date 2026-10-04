"use client";

import { RouteErrorBoundary } from "@/components/ui/route-error-boundary";

export default function ApplicationsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorBoundary
      {...props}
      surface="portal/applications"
      body="We couldn't load your applications. Try refreshing — if it persists, contact your account manager."
    />
  );
}
