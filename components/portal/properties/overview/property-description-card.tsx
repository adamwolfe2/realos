export function PropertyDescriptionCard({
  description,
  priceRange,
}: {
  description: string | null;
  priceRange: string | null;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
        Listing
      </p>
      {priceRange ? (
        <p className="mt-1.5 text-[12px] text-foreground">
          <span className="text-muted-foreground">Price range</span>{" "}
          <span className="font-medium tabular-nums">{priceRange}</span>
        </p>
      ) : null}
      {description ? (
        <p className="mt-2 text-[11.5px] text-muted-foreground leading-snug line-clamp-3">
          {description}
        </p>
      ) : null}
    </section>
  );
}
