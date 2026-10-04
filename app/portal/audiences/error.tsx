"use client";

import { RouteErrorBoundary } from "@/components/ui/route-error-boundary";

// Audiences page touches a few distinct subsystems (CRM exports, audience
// segmentation, sync schedulers) so any one of them throwing would 500
// the whole route. Boundary keeps the rest of the portal navigable.
export default function AudiencesError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorBoundary
      {...props}
      surface="portal/audiences"
      body="We couldn't load your audiences. Try refreshing — if it persists, contact your account manager."
    />
  );
}
