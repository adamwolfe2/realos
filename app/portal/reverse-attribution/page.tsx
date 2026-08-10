import { redirect } from "next/navigation";

export default async function ReverseAttributionRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const incoming = await searchParams;
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(incoming)) {
    if (typeof value === "string") next.set(key, value);
    else for (const item of value ?? []) next.append(key, item);
  }

  redirect(`/portal/attribution${next.size > 0 ? `?${next.toString()}` : ""}`);
}
