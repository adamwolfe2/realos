import { Star } from "lucide-react";

// Five-star glyph row with a fractional fill (e.g. 4.5 → 90% width overlay).
// Base row is a muted outline; a colored, fill-current row is layered on
// top and clipped to the rating's percentage of 5, giving partial-star
// precision without needing a half-star icon.
const STAR_INDICES = [0, 1, 2, 3, 4];

export function RatingStars({ rating }: { rating: number }) {
  const pct = Math.max(0, Math.min(1, rating / 5)) * 100;
  return (
    <span className="inline-flex items-center">
      <span className="relative inline-flex" aria-hidden="true">
        <span className="flex gap-0.5 text-muted-foreground/40">
          {STAR_INDICES.map((i) => (
            <Star key={i} className="h-3.5 w-3.5" />
          ))}
        </span>
        <span
          className="absolute inset-0 flex gap-0.5 overflow-hidden text-primary"
          style={{ width: `${pct}%` }}
        >
          {STAR_INDICES.map((i) => (
            <Star key={i} className="h-3.5 w-3.5 shrink-0 fill-current" />
          ))}
        </span>
      </span>
      <span className="sr-only">{rating.toFixed(1)} out of 5 stars</span>
    </span>
  );
}
