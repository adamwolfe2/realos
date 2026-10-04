"use client";

import { RouteErrorBoundary } from "@/components/ui/route-error-boundary";

export default function InsightsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorBoundary
      {...props}
      surface="portal/insights"
      body="An unexpected error occurred loading this page. Try refreshing. If it persists, contact your account manager."
    />
  );
}
