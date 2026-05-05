// Plain shared util — no "use client" / "use server" directive so both
// server components (page.tsx) and client components (telegraph-demo.tsx)
// can import it without crossing the RSC boundary.

export function isTelegraphCommons(meta: {
  slug?: string | null;
  name?: string | null;
}) {
  const candidates = [
    (meta.slug ?? "").toLowerCase(),
    (meta.name ?? "").toLowerCase(),
  ];
  return candidates.some((s) => s.includes("telegraph"));
}
