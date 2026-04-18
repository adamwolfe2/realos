/**
 * Default ProjectTask seed data for new tenant builds.
 * Organized by phase (0-5) matching the agency fulfillment workflow.
 *
 * Forked from Wholesail's operator checklist. Distribution-specific steps
 * (product import, Stripe Connect, catalog branding) were replaced with
 * real-estate-specific steps (AppFolio OAuth, Cursive pixel install,
 * chatbot knowledge base, tenant marketing site setup).
 */

export type DefaultTask = {
  label: string;
  description: string;
  phase: number;
  externalUrl?: string;
  automationAction?: string;
};

const CAL_URL =
  process.env.NEXT_PUBLIC_CAL_LINK
    ? `https://cal.com/${process.env.NEXT_PUBLIC_CAL_LINK}`
    : "https://cal.com/adamwolfe/realestaite";

export function getDefaultProjectTasks(): DefaultTask[] {
  return [
    // Phase 0, Intake & Scoping
    {
      label: "Review intake submission",
      description:
        "Read the intake form, verify company details, property portfolio, and selected modules. Mark reviewed when complete.",
      phase: 0,
    },
    {
      label: "Schedule consultation call",
      description:
        "Book a consultation via Cal.com. Walk through pricing, timeline, and confirm the scope of selected modules.",
      phase: 0,
      externalUrl: CAL_URL,
    },
    {
      label: "Confirm retainer + setup pricing",
      description:
        "Agree on monthly retainer, one-time setup fee, and ad spend markup. Record in the project Costs tab.",
      phase: 0,
    },
    {
      label: "Send contract via Stripe",
      description:
        "Create Stripe customer + invoice for setup. Mark CONTRACT_SIGNED once payment lands.",
      phase: 0,
      automationAction: "send_contract",
    },

    // Phase 1, Tenant Provisioning
    {
      label: "Create tenant Organization row",
      description:
        "Intake wizard creates an Organization with orgType=CLIENT, selected modules, and billing status. Verify the row exists.",
      phase: 1,
      automationAction: "create_organization",
    },
    {
      label: "Generate tenant slug + fallback subdomain",
      description:
        "Confirm the slug is unique. Fallback preview URL: {slug}.realestaite.co.",
      phase: 1,
    },
    {
      label: "Attach custom domain via Vercel API",
      description:
        "Use the Vercel Domains API (see lib/build/domain-attach.ts) to attach the client's domain. Share the DNS records they need to add.",
      phase: 1,
      automationAction: "attach_domain",
    },
    {
      label: "Verify SSL certificate issued",
      description:
        "Confirm the custom domain has an active certificate. Automatic once DNS propagates.",
      phase: 1,
      automationAction: "verify_ssl",
    },

    // Phase 2, Integrations
    {
      label: "Connect AppFolio (or fallback backend)",
      description:
        "Run the AppFolio OAuth flow or gather API credentials. Store encrypted in AppFolioIntegration. Enable auto-sync.",
      phase: 2,
      externalUrl: "https://www.appfolio.com/login",
      automationAction: "connect_appfolio",
    },
    {
      label: "Provision Cursive pixel",
      description:
        "Call Cursive API to provision a pixel for this tenant. Save cursivePixelId + pixelScriptUrl on the CursiveIntegration row.",
      phase: 2,
      automationAction: "provision_cursive",
    },
    {
      label: "Install pixel on tenant site",
      description:
        "If tenant site is hosted by us, the pixel loader is auto-injected. If bring-your-own-site, send the script tag to the client with install instructions.",
      phase: 2,
    },
    {
      label: "Configure ad accounts (Google, Meta)",
      description:
        "Gather OAuth tokens for each ad platform the client has selected. Store encrypted in AdAccount rows.",
      phase: 2,
    },

    // Phase 3, Content & Site Build
    {
      label: "Collect brand assets",
      description:
        "Logo (SVG/PNG), brand colors, hero imagery, amenity photos, and virtual tour links. Upload to Blob storage.",
      phase: 3,
      automationAction: "send_assets_email",
    },
    {
      label: "Seed Property rows",
      description:
        "Create one Property per building. Sync listings from AppFolio to populate Listing rows.",
      phase: 3,
      automationAction: "seed_properties",
    },
    {
      label: "Draft TenantSiteConfig",
      description:
        "Set site title, tagline, hero copy, primary CTA, phone, contact email. Toggle feature sections (listings, floor plans, amenities, reviews).",
      phase: 3,
    },
    {
      label: "Build chatbot knowledge base",
      description:
        "Populate TenantSiteConfig.chatbotKnowledgeBase with property facts, pricing guidance, tour/application CTAs.",
      phase: 3,
    },

    // Phase 4, QA & Review
    {
      label: "Full site walkthrough",
      description:
        "Click every page on desktop + mobile. Verify hero, listings pull from AppFolio, amenities, location, contact, and SEO metadata.",
      phase: 4,
    },
    {
      label: "Verify pixel firing",
      description:
        "Load the tenant site with the Cursive browser extension or dev tools. Confirm the pixel fires and events reach Cursive.",
      phase: 4,
    },
    {
      label: "Exercise chatbot happy path",
      description:
        "Open the chatbot, ask 5 common questions, request a tour, and submit an application. Verify lead row is created.",
      phase: 4,
    },
    {
      label: "Test lead capture to Resend + Slack",
      description:
        "Submit a contact form. Confirm Resend notification to the client team lands and the Lead row is visible in the portal.",
      phase: 4,
    },
    {
      label: "Verify analytics installed",
      description:
        "Confirm GA4 and GTM are wired correctly and custom events fire (apply_clicked, tour_scheduled, chatbot_lead_captured).",
      phase: 4,
    },

    // Phase 5, Launch
    {
      label: "Send client review link",
      description:
        "Email the client the staging URL. Collect feedback in the CreativeRequest and Notes tabs.",
      phase: 5,
      automationAction: "send_review_email",
    },
    {
      label: "Client approval received",
      description:
        "Client has reviewed and signed off on the site + chatbot + pixel. Document any requested changes.",
      phase: 5,
    },
    {
      label: "Flip DNS to production",
      description:
        "Update the client's DNS to point at Vercel. Verify the custom domain resolves with HTTPS.",
      phase: 5,
    },
    {
      label: "Send 'Site is live' email",
      description:
        "Email the client with the live URL, portal login, reporting cadence, and support contact.",
      phase: 5,
      automationAction: "send_live_email",
    },
    {
      label: "Mark tenant LAUNCHED",
      description:
        "Update Organization.status to LAUNCHED and launchedAt to now. Week-one performance review scheduled.",
      phase: 5,
      automationAction: "mark_launched",
    },
    {
      label: "Week-one performance review",
      description:
        "Pull first week of leads, visitors, chatbot conversations, ad spend. Deliver performance summary to client.",
      phase: 5,
    },
    {
      label: "Transition to steady-state reporting",
      description:
        "Switch tenant to ACTIVE status. Monthly reporting cadence begins. Creative studio + ads ongoing.",
      phase: 5,
      automationAction: "mark_active",
    },
  ];
}

export const PHASE_LABELS: Record<number, string> = {
  0: "Intake & Scoping",
  1: "Tenant Provisioning",
  2: "Integrations",
  3: "Content & Site Build",
  4: "QA & Review",
  5: "Launch & Steady-State",
};
