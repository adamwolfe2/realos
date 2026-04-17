import type { Metadata } from "next";

export const metadata: Metadata = { title: "Visitors" };

// Placeholder. Sprint 08 wires in the Cursive pixel visitor table, intent
// scoring, and ad-platform sync state.
export default function VisitorsStub() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-3xl font-bold mb-4">Visitors</h1>
      <p className="text-sm opacity-70">
        Sprint 08 wires in the Cursive pixel feed, identified visitors, and
        outreach queue. Until the pixel module is provisioned, this page
        stays empty.
      </p>
    </div>
  );
}
