import { SectionCard } from "@/components/admin/page-header";

type PropertyRow = {
  id: string;
  name: string;
  slug: string;
  _count: { listings: number };
};

export function PropertiesTab({ properties }: { properties: PropertyRow[] }) {
  return (
    <SectionCard
      label="Properties"
      description={
        properties.length > 0
          ? `${properties.length} propert${properties.length === 1 ? "y" : "ies"} on this client (most recently updated first).`
          : undefined
      }
    >
      {properties.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No properties set up yet.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {properties.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium text-foreground truncate">
                  {p.name}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  /{p.slug}
                </div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {p._count.listings} listing
                {p._count.listings === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
