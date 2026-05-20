import { redirect } from "next/navigation";

// ---------------------------------------------------------------------------
// /portal/tools/zillow — REDIRECTED 2026-05-23
//
// The Zillow report was parked when Zillow's PerimeterX bot detection
// began blocking every fetch from Vercel's IP ranges. The replacement
// surface is the RentCast-powered Building Evaluator at
// /portal/tools/value, which delivers the same investor math + comp
// view with a reliable data source.
//
// Preserves bookmarks: any operator who saved the old URL lands on the
// new tool automatically. Server-side 307 redirect (the default from
// next/navigation::redirect in a server component).
// ---------------------------------------------------------------------------
export default function ZillowToolPage(): never {
  redirect("/portal/tools/value");
}
