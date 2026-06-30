import { ExternalLink, Pencil, Settings } from "lucide-react";
import { type BackendPlatform } from "@prisma/client";

// ---------------------------------------------------------------------------
// Sidebar — quick actions.
// ---------------------------------------------------------------------------

export function QuickActionsCard({
  propertyId,
  backendPlatform,
}: {
  propertyId: string;
  backendPlatform: BackendPlatform;
}) {
  const showAppFolioLink = backendPlatform === "APPFOLIO";

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
        Quick actions
      </p>
      <ul className="mt-2 space-y-1">
        {showAppFolioLink ? (
          <li>
            <a
              href="https://app.appfolio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[12.5px] text-foreground hover:text-primary transition-colors py-1"
            >
              <ExternalLink
                className="h-3.5 w-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              Open in AppFolio
            </a>
          </li>
        ) : null}
        <li>
          <a
            href={`/portal/properties/${propertyId}/edit`}
            className="flex items-center gap-2 text-[12.5px] text-foreground hover:text-primary transition-colors py-1"
          >
            <Pencil
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            Edit property details
          </a>
        </li>
        <li>
          <a
            href={`/portal/properties/${propertyId}?tab=onboarding`}
            className="flex items-center gap-2 text-[12.5px] text-foreground hover:text-primary transition-colors py-1"
          >
            <Settings
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            Property settings
          </a>
        </li>
      </ul>
    </section>
  );
}
