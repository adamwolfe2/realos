"use client";

import { RouteErrorBoundary } from "@/components/ui/route-error-boundary";

export default function ToursError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorBoundary
      {...props}
      surface="portal/tours"
      body="We couldn't load your tours. Try refreshing — if it persists, contact your account manager."
    />
  );
}
