import type { MentionSource } from "@prisma/client";

// ---------------------------------------------------------------------------
// sourceLabel — pure utility used by both server and client components.
// Lives in a non-"use client" file so server components on
// /portal/reputation can call it directly. Previously co-located with
// <SourceLogo> (which IS a client component because it renders SVG icons
// via lucide-react), and the React Server Component build refused to
// import a function from a "use client" module on the server side. That
// caused the reputation page to crash with the exact error reported:
//
//   Attempted to call sourceLabel() from the server but sourceLabel is
//   on the client. It's not possible to invoke a client function from
//   the server, it can only be rendered as a Component or passed to
//   props of a Client Component.
//
// Splitting the pure-string helper out fixes it without changing any
// call sites — the source-logo.tsx file re-exports this function so
// existing client imports keep working.
// ---------------------------------------------------------------------------

export function sourceLabel(source: MentionSource, url: string): string {
  let host = "";
  try {
    host = new URL(url).host.toLowerCase().replace(/^www\./, "");
  } catch {
    // ignore
  }
  if (source === "GOOGLE_REVIEW") return "Google";
  if (source === "REDDIT") return "Reddit";
  if (source === "YELP") return "Yelp";
  if (source === "FACEBOOK_PUBLIC") return "Facebook";
  if (/instagram\.com$/.test(host)) return "Instagram";
  if (/quora\.com$/.test(host)) return "Quora";
  if (/apartmentratings\.com$/.test(host)) return "ApartmentRatings";
  if (/niche\.com$/.test(host)) return "Niche";
  if (/bbb\.org$/.test(host)) return "BBB";
  if (/collegeconfidential\.com$/.test(host)) return "College Confidential";
  if (/glassdoor\.com$/.test(host)) return "Glassdoor";
  if (/medium\.com$/.test(host)) return "Medium";
  if (/\.edu$/.test(host)) return host.split(".")[0].toUpperCase();
  return host || "Web";
}
