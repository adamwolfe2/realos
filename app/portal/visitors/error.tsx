"use client";

import { RouteErrorBoundary } from "@/components/ui/route-error-boundary";

export default function VisitorsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorBoundary {...props} surface="portal/visitors" />;
}
