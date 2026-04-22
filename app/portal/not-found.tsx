import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export default function PortalNotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
          404
        </p>
        <h1 className="text-3xl font-bold text-foreground">
          Page not found
        </h1>
        <p className="text-sm text-muted-foreground">
          That {BRAND_NAME} portal route doesn&apos;t exist. It may have moved,
          or isn&apos;t enabled for your account yet.
        </p>
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <Link
            href="/portal"
            className="inline-flex items-center h-9 px-4 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary-dark transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/portal/setup"
            className="inline-flex items-center h-9 px-4 text-sm font-medium rounded-md border border-border bg-card hover:bg-accent transition-colors"
          >
            Setup hub
          </Link>
        </div>
      </div>
    </div>
  );
}
