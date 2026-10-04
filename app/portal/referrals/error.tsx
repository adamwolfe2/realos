"use client";

import { RouteErrorBoundary } from "@/components/ui/route-error-boundary";

export default function ReferralsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorBoundary {...props} surface="portal/referrals" />;
}
