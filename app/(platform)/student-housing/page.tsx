import type { Metadata } from "next";
import { VerticalLanding } from "@/components/platform/vertical-landing";
import { ChatDemo } from "@/components/platform/artifacts/chat-demo";

export const metadata: Metadata = {
  title: "Student housing leasing intelligence that fills beds on schedule",
  description:
    "LeaseStack tells student housing operators which channels are signing leases, when lease-up pacing is slipping, and what to do next. Built by an asset manager who ran the Telegraph Commons lease-up directly.",
};

export default function StudentHousingPage() {
  return (
    <VerticalLanding
      eyebrow="Student housing"
      headline="Your lease-up data."
      headlineAccent="Finally working for you."
      subhead="Student housing runs on a pre-lease calendar that does not forgive a slow August. LeaseStack is the leasing intelligence platform that tells you which channels signed your last twelve leases, when your pacing is falling behind the academic calendar, and exactly what to do about it."
      caption="Know your lease-up is falling behind before it shows up in occupancy. Built by an asset manager who managed the Telegraph Commons lease-up directly."
      artifact={<ChatDemo />}
      painsHeading="What student housing operators tell us."
      modulesHeading="What you get the day you turn it on."
      pains={[
        {
          title: "Pacing slips silently",
          body: "By the time monthly occupancy reports flag a slow lease-up, the academic calendar is already against you. You needed to see it eight weeks ago.",
        },
        {
          title: "Channel spend with no answer",
          body: "The agency invoice arrives, the leases get signed, and nobody can tell you which campaign drove which signing. The number you actually need is missing from every report.",
        },
        {
          title: "Parent co-signers and international applicants",
          body: "Two different audiences, two different conversion paths, and a leasing office that handles both on top of resident relations. The tools you have were not built for this.",
        },
      ]}
      modules={[
        {
          title: "Lease-up pacing built around the academic calendar",
          body: "Daily pacing against your pre-lease curve. Know if you are ahead, on track, or behind, by floor plan, by bed type, by campus.",
        },
        {
          title: "Channel attribution down to the signed lease",
          body: "Know which channel drove your last twelve lease signings. Spend, leads, tours, applications, signed leases, all tied to the source that produced them.",
        },
        {
          title: "Campus-proximity targeting",
          body: "Audience pools built around the campuses your residents actually attend, not metro-area broadcasts. Spend goes where the leases come from.",
        },
        {
          title: "Live PMS-synced floor plans",
          body: "Every unit on your site matches your PMS within the hour. No stale PDFs, no phone calls to the leasing office to confirm what is still available.",
        },
        {
          title: "AI leasing assistant for after-hours inquiries",
          body: "Answers floor plan, pricing, and pet-policy questions overnight, routes international and parent-co-signer threads into the right intake, and hands warm leads to your team with full context in the morning.",
        },
        {
          title: "Monday morning report for the AM",
          body: "A clean leasing report lands in the asset manager's inbox every Monday. Pacing, channel performance, what changed week over week, what to act on this week. No login required.",
        },
      ]}
    />
  );
}
