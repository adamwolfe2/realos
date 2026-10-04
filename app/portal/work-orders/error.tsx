"use client";

import { RouteErrorBoundary } from "@/components/ui/route-error-boundary";

// AppFolio-backed; work_orders endpoint is one of the slower ones and
// sometimes times out. Boundary keeps the rest of the portal navigable.
export default function WorkOrdersError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorBoundary
      {...props}
      surface="portal/work-orders"
      body="We couldn't load your work orders. AppFolio's work-orders endpoint occasionally times out — try a refresh."
    />
  );
}
