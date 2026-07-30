import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Building2 } from "lucide-react";

// ---------------------------------------------------------------------------
// PortfolioStrip — horizontal building-photo strip rendered above the
// properties table. The list page was the flattest page in the portal (4
// numeric KPI tiles + a table with tiny thumbnails); this gives it a real
// visual anchor without adding a fetch — it reuses the SAME image cascade
// the table thumbnails and the dashboard "Featured Property" card already
// use (heroImageUrl, then first photoUrls[] entry). Server-rendered only.
// ---------------------------------------------------------------------------

type StripProperty = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  availableCount: number | null;
  totalUnits: number | null;
  heroImageUrl: string | null;
  photoUrls: Prisma.JsonValue;
};

const STRIP_CAP = 8;

export function PortfolioStrip({
  properties,
  total,
}: {
  properties: StripProperty[];
  total: number;
}) {
  const shown = properties.slice(0, STRIP_CAP);
  const remaining = total - shown.length;

  return (
    <section
      aria-label="Portfolio"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
    >
      {shown.map((p) => (
        <PortfolioCard key={p.id} property={p} />
      ))}
      {remaining > 0 ? (
        <div className="flex items-center justify-center rounded-[2px] border border-dashed border-border bg-secondary/40 text-[11px] font-medium text-muted-foreground">
          +{remaining.toLocaleString()} more
        </div>
      ) : null}
    </section>
  );
}

function PortfolioCard({ property: p }: { property: StripProperty }) {
  // Same fallback cascade as the table's EntityCell avatar — photoUrls is a
  // JSON column (string[] from AppFolio sync), coerced safely so a
  // malformed row never crashes the render.
  const photoFallback = (() => {
    const arr = p.photoUrls;
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0];
      return typeof first === "string" && first.length > 0 ? first : null;
    }
    return null;
  })();
  const imageSrc = p.heroImageUrl ?? photoFallback;
  const location = [p.city, p.state].filter(Boolean).join(", ");
  const totalUnits = p.totalUnits ?? 0;
  const openUnits = p.availableCount ?? 0;
  const openPct =
    totalUnits > 0
      ? Math.min(100, Math.round((openUnits / totalUnits) * 100))
      : 0;

  return (
    <Link
      href={`/portal/properties/${p.id}`}
      className="group overflow-hidden rounded-[2px] border border-border bg-card transition-colors hover:border-primary/40"
    >
      <div className="relative h-24 w-full bg-secondary">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Building2
              className="h-6 w-6 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="truncate text-[13px] font-semibold text-foreground">
          {p.name}
        </p>
        <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
          {location || "—"}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[2px] bg-muted">
          <div className="h-full bg-primary" style={{ width: `${openPct}%` }} />
        </div>
        <p className="mt-1 font-mono text-[10px] tabular-nums text-muted-foreground">
          {openUnits} open · {totalUnits} units
        </p>
      </div>
    </Link>
  );
}
