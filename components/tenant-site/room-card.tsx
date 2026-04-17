import type { Listing } from "@prisma/client";

function centsToUsd(c: number | null): string {
  if (c == null) return "Contact for rates";
  return `$${Math.round(c / 100).toLocaleString()}/mo`;
}

export function RoomCard({ listing }: { listing: Listing }) {
  const photos = Array.isArray(listing.photoUrls)
    ? (listing.photoUrls as string[])
    : [];
  const firstPhoto = photos[0];

  const bedBath = [
    listing.bedrooms != null ? `${listing.bedrooms} bed` : null,
    listing.bathrooms != null ? `${listing.bathrooms} bath` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="border rounded-md overflow-hidden bg-white flex flex-col">
      {firstPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={firstPhoto}
          alt={listing.unitType ?? "Unit"}
          className="aspect-[4/3] object-cover w-full"
        />
      ) : (
        <div
          className="aspect-[4/3] w-full"
          style={{
            background:
              "linear-gradient(135deg, var(--tenant-primary) 0%, var(--tenant-secondary) 100%)",
          }}
          aria-hidden="true"
        />
      )}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-serif text-lg font-bold">
          {listing.unitType ?? "Unit"}
        </h3>
        <p className="text-xs opacity-60">
          {bedBath || "Details in unit detail"}
          {listing.squareFeet ? ` · ${listing.squareFeet} sq ft` : ""}
        </p>
        <p className="mt-auto pt-2 text-sm font-semibold tabular-nums">
          {centsToUsd(listing.priceCents)}
        </p>
      </div>
    </article>
  );
}
