import type { Metadata } from "next";
import { VerticalLanding } from "@/components/platform/vertical-landing";

export const metadata: Metadata = {
  title: "Student housing marketing that actually fills beds",
  description:
    "Managed marketing platform for student housing operators: custom site, AppFolio-synced listings, AI chatbot, identity pixel, Google + Meta ads, international-student instant-approval funnels.",
};

export default function StudentHousingPage() {
  return (
    <VerticalLanding
      eyebrow="Student housing"
      headline="Fill beds the way the big national brands do, at independent-operator cost."
      subhead="Student housing is a sprint. Applications open in the fall, half your stock leases by December, and your agency is still drafting a creative brief. We replace the whole stack with software your leasing team actually uses."
      pains={[
        {
          title: "Sprint pricing cycles",
          body: "Every unit prices differently across the year. Static brochures can't keep up. Live AppFolio sync can.",
        },
        {
          title: "International applicants",
          body: "Your current stack probably flags international applicants for manual review. We ship instant-approval flows that fit AppFolio's rules.",
        },
        {
          title: "Turn-heavy calendars",
          body: "Move-out surges and renewals overlap. Without automated follow-up and waitlist capture, you lose the best applicants to the competition.",
        },
      ]}
      modules={[
        {
          title: "Live AppFolio-synced floor plans",
          body: "Every unit on your site matches the truth within the hour. No more outdated brochure PDFs.",
        },
        {
          title: "AI chatbot with instant-approval path",
          body: "Captures leads at 2am, routes international applicants to the right flow, hands hot leads to the leasing team.",
        },
        {
          title: "Identity graph pixel",
          body: "Know which parents are researching for their student. Email-level visitor identification, not vanity impressions.",
        },
        {
          title: "Student referral program",
          body: "Native referral tracking. Existing residents refer, you track, we handle the payouts.",
        },
        {
          title: "Geo-fenced campus ads",
          body: "Target dorms, libraries, campus bookstores. Retarget anyone who loaded a floor plan.",
        },
        {
          title: "Summer sublet SEO",
          body: "AEO-ready landing pages for summer housing, international students, graduate housing, every campus audience.",
        },
      ]}
    />
  );
}
