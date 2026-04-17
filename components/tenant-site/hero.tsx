import Link from "next/link";

export function Hero({
  headline,
  subheadline,
  imageUrl,
  ctaText,
  ctaUrl,
  secondaryCtaText,
  secondaryCtaUrl,
}: {
  headline: string;
  subheadline?: string | null;
  imageUrl?: string | null;
  ctaText: string;
  ctaUrl: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
}) {
  return (
    <section className="relative min-h-[72vh] flex items-center overflow-hidden">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, var(--tenant-primary), var(--tenant-secondary))",
          }}
        />
      )}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-24 text-white">
        <h1 className="font-serif text-4xl md:text-6xl font-bold leading-tight max-w-3xl">
          {headline}
        </h1>
        {subheadline ? (
          <p className="mt-5 text-lg md:text-xl max-w-2xl opacity-90">
            {subheadline}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={ctaUrl}
            className="px-6 py-3 text-sm font-semibold rounded"
            style={{
              backgroundColor: "var(--tenant-primary)",
              color: "white",
            }}
          >
            {ctaText}
          </Link>
          {secondaryCtaText && secondaryCtaUrl ? (
            <Link
              href={secondaryCtaUrl}
              className="px-6 py-3 text-sm font-semibold rounded bg-white text-slate-900"
            >
              {secondaryCtaText}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
