import Image from "next/image";

// Hosts allowed by next.config images.remotePatterns. Photos from these go
// through next/image (resize + AVIF/WebP). Scraped or arbitrary hosts cannot
// be optimized without widening remotePatterns, so they stay plain <img>.
const OPTIMIZABLE_HOSTS = [
  /(^|\.)public\.blob\.vercel-storage\.com$/,
  /^res\.cloudinary\.com$/,
  /^images\.unsplash\.com$/,
];

function canOptimize(src: string): boolean {
  if (src.startsWith("/")) return !src.startsWith("//");
  try {
    const u = new URL(src);
    return u.protocol === "https:" && OPTIMIZABLE_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

/** Fills its (relatively positioned) parent. `sizes` is required. */
export function PropertyPhoto({
  src,
  sizes,
  className,
}: {
  src: string;
  sizes: string;
  className?: string;
}) {
  if (canOptimize(src)) {
    return <Image src={src} alt="" fill sizes={sizes} className={className} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={className} loading="lazy" />;
}
