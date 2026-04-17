import Link from "next/link";
import type { Listing, Property } from "@prisma/client";
import { RoomCard } from "./room-card";

export function ListingsGrid({
  property,
  listings,
  headline,
  compact,
}: {
  property: Property;
  listings: Listing[];
  headline?: string;
  compact?: boolean;
}) {
  if (listings.length === 0) {
    return (
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-20 text-center">
        <h2 className="font-serif text-3xl md:text-4xl font-bold">
          All leased for the current term.
        </h2>
        <p className="opacity-70 mt-2 max-w-xl mx-auto">
          Join the waitlist and we'll email you when next term's units come
          online.
        </p>
        <Link
          href="/apply"
          className="inline-block mt-6 px-6 py-3 text-sm font-semibold rounded"
          style={{ backgroundColor: "var(--tenant-primary)", color: "white" }}
        >
          Join the waitlist
        </Link>
      </section>
    );
  }

  const grouped = listings.reduce<Record<string, Listing[]>>((acc, l) => {
    const key = l.unitType ?? "Standard unit";
    (acc[key] ??= []).push(l);
    return acc;
  }, {});

  const entries = Object.entries(grouped);
  const sliced = compact
    ? entries.map(([k, v]) => [k, v.slice(0, 3)] as const)
    : entries.map(([k, v]) => [k, v] as const);

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 py-20">
      <header className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <h2 className="font-serif text-3xl md:text-4xl font-bold">
            {headline ?? `Available at ${property.name}`}
          </h2>
          <p className="opacity-70 mt-1 text-sm">
            {listings.length} live unit{listings.length === 1 ? "" : "s"}
          </p>
        </div>
        {compact ? (
          <Link
            href="/floor-plans"
            className="text-sm font-semibold underline underline-offset-4"
          >
            See all floor plans →
          </Link>
        ) : null}
      </header>
      <div className="space-y-10">
        {sliced.map(([unitType, units]) => (
          <div key={unitType}>
            <h3 className="font-serif text-xl font-bold mb-4">{unitType}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {units.map((u) => (
                <RoomCard key={u.id} listing={u} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
