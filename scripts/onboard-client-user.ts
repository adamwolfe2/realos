/**
 * onboard-client-user.ts — pin-drop a client-side User row so the invitee can
 * sign up at /sign-up and land in /portal scoped to the right tenant on first
 * login. `/api/auth/role` claims the pre-seeded row by email.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   pnpm exec tsx scripts/onboard-client-user.ts \
 *     --email norman@gsc-re.com \
 *     --org-slug telegraph-commons \
 *     --role CLIENT_OWNER \
 *     --first "Norman" --last "Gensinger"
 *
 * Idempotent — re-running with the same email updates the existing row.
 */

import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import type { HTTPQueryOptions } from "@neondatabase/serverless";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("--email")?.toLowerCase();
  const orgSlug = arg("--org-slug") ?? "telegraph-commons";
  const roleInput = (arg("--role") ?? "CLIENT_OWNER") as UserRole;
  const firstName = arg("--first") ?? null;
  const lastName = arg("--last") ?? null;

  if (!email) {
    throw new Error("--email is required (e.g. --email norman@gsc-re.com)");
  }
  if (
    ![
      "CLIENT_OWNER",
      "CLIENT_ADMIN",
      "CLIENT_VIEWER",
      "LEASING_AGENT",
    ].includes(roleInput)
  ) {
    throw new Error(`--role must be a CLIENT_* or LEASING_AGENT role, got ${roleInput}`);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const prisma = new PrismaClient({
    adapter: new PrismaNeonHttp(url, {} as HTTPQueryOptions<boolean, boolean>),
  });

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true, orgType: true },
  });
  if (!org) throw new Error(`Org not found: slug=${orgSlug}`);
  if (org.orgType !== "CLIENT") {
    throw new Error(`Org ${orgSlug} is not a CLIENT org`);
  }

  const pendingId = `seed_pending_${email}`;

  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          orgId: org.id,
          role: roleInput,
          firstName: firstName ?? existing.firstName,
          lastName: lastName ?? existing.lastName,
        },
      })
    : await prisma.user.create({
        data: {
          clerkUserId: pendingId,
          email,
          firstName,
          lastName,
          role: roleInput,
          orgId: org.id,
        },
      });

  console.log(
    `\nOK ${existing ? "updated" : "created"} User row:\n` +
      `  email:     ${user.email}\n` +
      `  role:      ${user.role}\n` +
      `  org:       ${org.name} (${orgSlug})\n` +
      `  userId:    ${user.id}\n` +
      `  clerkId:   ${user.clerkUserId}\n\n` +
      `Next step for ${user.email}:\n` +
      `  1. Go to ${process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app-url"}/sign-up\n` +
      `  2. Sign up with this exact email: ${user.email}\n` +
      `  3. On first sign-in, /api/auth/role claims this row and routes to /portal.\n`
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("onboard-client-user failed:", err);
  process.exit(1);
});
