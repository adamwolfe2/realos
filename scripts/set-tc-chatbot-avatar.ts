/**
 * One-off: set the chatbot avatar for the SG Real Estate org (production
 * Telegraph Commons tenant) to a local file already committed under
 * public/avatars/.
 *
 * Norman dropped Jessica's headshot for the chatbot launcher. This sets
 * tenantSiteConfig.chatbotAvatarUrl on the SG org so the
 * /api/public/chatbot/config endpoint serves the file path back to the
 * embed, which then renders it in the launcher + panel header.
 *
 * Idempotent: re-running with the same path is a no-op aside from
 * touching updatedAt.
 */
import { prisma } from "../lib/db";

const TARGET_ORG_SLUG = "telegraph-commons"; // SG Real Estate production
const AVATAR_PATH = "/avatars/jessica-telegraph-commons.jpg";

async function main() {
  const org = await prisma.organization.findUnique({
    where: { slug: TARGET_ORG_SLUG },
    select: { id: true, name: true, slug: true },
  });
  if (!org) {
    console.error(
      `[error] no org found with slug "${TARGET_ORG_SLUG}" — aborting.`,
    );
    process.exit(1);
  }

  console.log(
    `Updating chatbot avatar for: ${org.name} (slug=${org.slug}, id=${org.id})`,
  );

  // Ensure a tenantSiteConfig row exists first (upsert), then set the
  // avatar field. Other fields untouched.
  const result = await prisma.tenantSiteConfig.upsert({
    where: { orgId: org.id },
    create: {
      orgId: org.id,
      chatbotAvatarUrl: AVATAR_PATH,
    },
    update: {
      chatbotAvatarUrl: AVATAR_PATH,
    },
    select: {
      orgId: true,
      chatbotAvatarUrl: true,
      chatbotEnabled: true,
      chatbotPersonaName: true,
      updatedAt: true,
    },
  });

  console.log(
    `[ok] chatbotAvatarUrl=${result.chatbotAvatarUrl} (chatbotEnabled=${result.chatbotEnabled}, persona=${result.chatbotPersonaName ?? "(unset)"})`,
  );

  // Reminder: the public chatbot config endpoint cache is 60s
  // (Cache-Control: s-maxage=60, stale-while-revalidate=600). The new
  // avatar will land on most visitors within the next minute; cold CDN
  // nodes can take up to 10 minutes before the stale-while-revalidate
  // window expires.
  console.log(
    "[note] chatbot config endpoint cache is 60s + 10m stale-while-revalidate — most embeds will pick up the new avatar within a minute.",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
