import type { Metadata } from "next";
import { VerticalLanding } from "@/components/platform/vertical-landing";
import { ChatDemo } from "@/components/platform/artifacts/chat-demo";

export const metadata: Metadata = {
  title: "Student housing marketing that actually fills beds",
  description:
    "Managed marketing platform for student housing operators: custom site, PMS-synced listings, AI chatbot, identity pixel, Google + Meta ads, international-student instant-approval funnels.",
};

export default function StudentHousingPage() {
  return (
    <VerticalLanding
      eyebrow="Student housing"
      headline="Fill beds the way the national brands do,"
      headlineAccent="at independent-operator cost."
      subhead="Student housing leasing runs on a 3-month sprint. Applications cluster in the fall, half your stock is gone by December, and your agency is still writing a creative brief. We replace the whole stack with software that drives leasing velocity and shows you exactly where every dollar went."
      caption="Leasing velocity tracked live · Black box marketing solved · Monday AM report, no login required"
      artifact={<ChatDemo />}
      pains={[
        {
          title: "Leasing velocity you can't see",
          body: "Your current tools give you verbal reports on how market response 'feels.' By the time you know you're underperforming, it's too late to avoid dropping rates.",
        },
        {
          title: "Digital marketing is a black box",
          body: "You're writing a check every month and getting a report that doesn't tell you which channel produced which lease. That ends here.",
        },
        {
          title: "Managers reporting in spreadsheets",
          body: "A Google Sheet with lease-up stats, sent weekly. No trend line, no channel attribution, no early warning. That's not a strategy, that's a guess.",
        },
      ]}
      modules={[
        {
          title: "Live PMS-synced floor plans",
          body: "Every unit on your site matches AppFolio within the hour. No stale PDFs, no phone tag with the leasing office.",
        },
        {
          title: "AI chatbot — 24/7 leasing agent",
          body: "Captures leads at 2am, routes international applicants to the right flow, and hands hot leads to your team with full conversation context.",
        },
        {
          title: "Marketing ROI attribution",
          body: "Spend, leads, applications, and signed leases per channel. Finally see which campaigns fill beds and which ones burn budget.",
        },
        {
          title: "Leasing velocity early warning",
          body: "AI detects when your lead-to-tour pipeline starts cooling, weeks before it shows up in occupancy. Enough time to act before you have to drop rates.",
        },
        {
          title: "Monthly AM report, no login required",
          body: "Your asset manager gets a clean monthly report emailed automatically. Leads, tours, applications, occupancy by bed type. No portal access needed.",
        },
        {
          title: "Student referral program",
          body: "Every resident gets a unique referral link. They share it with their network. You track who converted, we handle the payouts.",
        },
      ]}
    />
  );
}
