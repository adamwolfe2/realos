import type { Metadata } from "next";

export const metadata: Metadata = { title: "Creative studio" };

// Placeholder. Sprint 11 ships the creative request/fulfill workflow:
// submit brief, upload references, back-and-forth with the agency, approve
// deliverables. Visible in nav only when moduleCreativeStudio is on.
export default function CreativeStub() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-3xl font-bold mb-4">Creative studio</h1>
      <p className="text-sm opacity-70">
        Request ad creative, story templates, email headers, and print flyers.
        Sprint 11 builds the request queue, upload flow, threaded comments,
        and delivery inbox.
      </p>
    </div>
  );
}
