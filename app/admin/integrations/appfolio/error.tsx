"use client";

import { RouteErrorBoundary } from "@/components/ui/route-error-boundary";

export default function AdminAppfolioError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorBoundary
      {...props}
      surface="admin/integrations/appfolio"
      body="We couldn't load the AppFolio admin panel. Try refreshing — if it persists this is usually a Prisma / encryption issue worth looking at the server logs for."
    />
  );
}
