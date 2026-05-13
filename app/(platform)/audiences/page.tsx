import type { Metadata } from "next";
import { VerticalLanding } from "@/components/platform/vertical-landing";
import { AudienceSyncStream } from "@/components/platform/artifacts/audience-sync-stream";

export const metadata: Metadata = {
  title: "Audience Sync for residential and commercial real estate",
  description:
    "Connect verified audience segments to every ad account, CRM, and webhook. Built for residential brokers and commercial owners who want one place to push live buyer and seller intent.",
};

export default function AudiencesPage() {
  return (
    <VerticalLanding
      eyebrow="Audience Sync"
      headline="The audience layer for real estate."
      headlineAccent="One place to push every buyer and seller."
      subhead="Verified segments of active home buyers, refinance shoppers, lease intent, and luxury prospects. We sync them to your ad accounts, your CRM, or any webhook. Filter by zip, state, or city. Managed onboarding. Book a demo to see it in action."
      caption="Managed onboarding. Live segments and live destinations. Built for residential and commercial."
      artifact={<AudienceSyncStream />}
      ctaHref="/onboarding"
      painsHeading="The three things operators ask us first."
      modulesHeading="One product. Every push surface."
      pains={[
        {
          title: "Audience data sits in twelve places",
          body: "You buy lists, run pixels, scrape MLS, and pay a data partner. Nothing talks to anything. Audience Sync gives you one catalog of verified segments with one place to push them.",
        },
        {
          title: "Pushing to ad accounts is a manual export",
          body: "Today, sending an audience to Meta or Google means a CSV, an upload, and a hope. We connect once and stream segments live, with geo filters at push time.",
        },
        {
          title: "There is no audit trail",
          body: "Marketing asks where the audience came from. You shrug. We log every push, every member count, every destination, and every error. Sync history is one click away.",
        },
      ]}
      modules={[
        {
          title: "Live segment catalog",
          body: "Every verified buyer, seller, refinance, and lease intent segment from your data partner, refreshed on demand. Search, filter by reach, and see email and phone match rates inline.",
        },
        {
          title: "Push to ad accounts in one click",
          body: "Our team connects Meta and Google during onboarding. Pick a segment, pick a destination, push. Member counts and a full sync log land in your dashboard before the page reloads.",
        },
        {
          title: "Webhook out to any system",
          body: "Send members to your CRM, your email tool, your Zapier flow, or your own database. Every webhook is signed with HMAC SHA-256 so you can verify it on your end.",
        },
        {
          title: "Geo filters at push time",
          body: "Push only the zip codes, states, or cities that match your portfolio. The filter snapshot saves with the run so you always know who got which audience.",
        },
        {
          title: "Scheduled recurring syncs",
          body: "Set a segment to push daily or weekly. Audience Sync keeps your ad accounts and CRMs warm without anyone touching the dashboard. Pause, edit, or delete in a click.",
        },
        {
          title: "Member preview before you push",
          body: "See five anonymized profiles from any segment before you commit a budget. Names, locations, and match indicators show, full identifiers stay masked.",
        },
      ]}
    />
  );
}
