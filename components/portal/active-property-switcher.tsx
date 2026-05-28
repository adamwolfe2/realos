"use client";

import { useTransition } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { selectActiveProperty } from "@/lib/actions/active-property";
import { ALL_PROPERTIES_VALUE } from "@/lib/portal/active-property-constants";

// ---------------------------------------------------------------------------
// Active-property switcher.
//
// Rendered at the top of the portal sidebar. Lets multi-property
// operators scope every property-aware page to a single building
// without hand-editing the URL. The choice persists in a cookie via
// the selectActiveProperty server action; pages that already support a
// `?propertyId=` filter fall back to the cookie when the URL doesn't
// carry one. Pages that don't yet support it ignore the cookie — no
// regression for surfaces that haven't migrated.
//
// "All properties" is the default and clears the cookie. Built with a
// native <select> so we don't pull in additional UI primitives — the
// portal's existing component library doesn't ship a Popover/Command
// pair and a 2-file dependency add isn't worth it for a sidebar widget.
// ---------------------------------------------------------------------------

export type ActivePropertyOption = {
  id: string;
  name: string;
};

export function ActivePropertySwitcher({
  properties,
  activePropertyId,
  collapsed = false,
}: {
  properties: ActivePropertyOption[];
  activePropertyId: string | null;
  collapsed?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  // Single-property operators don't need a switcher — render nothing so
  // the chrome doesn't add a useless click target.
  if (properties.length <= 1) return null;

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const raw = event.target.value;
    startTransition(async () => {
      await selectActiveProperty(raw === ALL_PROPERTIES_VALUE ? null : raw);
    });
  }

  const value = activePropertyId ?? ALL_PROPERTIES_VALUE;

  if (collapsed) {
    // Collapsed state — render a hint icon only. The full switcher is
    // hidden because the sidebar is too narrow for the select chrome
    // to read; operators have to expand the sidebar to change scope.
    const active = activePropertyId
      ? properties.find((p) => p.id === activePropertyId)
      : null;
    const label = active?.name ?? "All properties";
    return (
      <div
        className="flex items-center justify-center py-1.5"
        title={`Scope: ${label}`}
        aria-label={`Active property: ${label}`}
      >
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative">
      <Building2 className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={value}
        onChange={handleChange}
        disabled={pending}
        aria-label="Active property scope"
        className={cn(
          "w-full appearance-none rounded-md border border-border bg-card pl-8 pr-7 py-2 text-[12px] font-medium text-foreground hover:bg-muted/60 transition-colors disabled:opacity-60",
          "focus:outline-none focus:ring-2 focus:ring-primary/40",
        )}
      >
        <option value={ALL_PROPERTIES_VALUE}>All properties</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {/* Chevron — purely decorative; native select renders the click
          target on the whole element. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}
