import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { webhookLimiter, checkRateLimit, getIp, rateLimited } from "@/lib/rate-limit";

const VALID_ROLES = [
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
  UserRole.CLIENT_VIEWER,
  UserRole.LEASING_AGENT,
] as const;

function isValidRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" && (VALID_ROLES as readonly string[]).includes(value)
  );
}

interface WebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: { email_address: string }[];
    first_name?: string | null;
    last_name?: string | null;
    public_metadata?: Record<string, unknown>;
  };
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(webhookLimiter, `wh-clerk:${ip}`);
  if (!allowed) {
    return rateLimited("Rate limit exceeded", 60);
  }

  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const headerPayload = req.headers;
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing headers" }, { status: 400 });
  }

  const payload = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  let event: WebhookEvent;
  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "user.created":
    case "user.updated": {
      const { id, email_addresses, first_name, last_name, public_metadata } =
        event.data;
      const email = email_addresses?.[0]?.email_address;
      if (!email) {
        console.warn(
          `Clerk user ${id} (${event.type}) has no email address, skipping DB sync`
        );
        break;
      }
      const rawRole = public_metadata?.role;
      const role: UserRole = isValidRole(rawRole)
        ? rawRole
        : UserRole.CLIENT_VIEWER;

      // Invite flow: orgId may arrive on public_metadata. Only link if org exists
      // and the user isn't already bound to one.
      const metaOrgId =
        typeof public_metadata?.orgId === "string"
          ? public_metadata.orgId
          : undefined;

      const orgExists = metaOrgId
        ? !!(await prisma.organization.findUnique({ where: { id: metaOrgId } }))
        : false;

      let orgIdToLink: string | undefined = orgExists ? metaOrgId : undefined;
      if (event.type === "user.updated" && orgIdToLink) {
        const existing = await prisma.user.findUnique({
          where: { clerkUserId: id },
          select: { orgId: true },
        });
        if (existing?.orgId) orgIdToLink = undefined;
      }

      await prisma.user.upsert({
        where: { clerkUserId: id },
        create: {
          clerkUserId: id,
          email,
          firstName: first_name ?? null,
          lastName: last_name ?? null,
          role,
          ...(orgIdToLink
            ? { org: { connect: { id: orgIdToLink } } }
            : {
                // DECISION: if no invite org attached yet, drop the new user into the
                // AGENCY org as a viewer. Sprint 02 refines resolution via the
                // `organization.created` and `organizationMembership.created` events
                // so users land on the right CLIENT org automatically.
                org: {
                  connectOrCreate: {
                    where: {
                      slug: process.env.AGENCY_ORG_SLUG ?? "leasestack-agency",
                    },
                    create: {
                      name: "LeaseStack Agency",
                      slug: process.env.AGENCY_ORG_SLUG ?? "leasestack-agency",
                      orgType: "AGENCY",
                    },
                  },
                },
              }),
        },
        update: {
          email,
          firstName: first_name ?? null,
          lastName: last_name ?? null,
          role,
          ...(orgIdToLink
            ? { org: { connect: { id: orgIdToLink } } }
            : {}),
          lastLoginAt: event.type === "user.updated" ? new Date() : undefined,
        },
      });

      console.info(`User ${id} synced to DB`);
      break;
    }

    case "user.deleted": {
      const userId = event.data.id;
      if (userId) {
        await prisma.user.deleteMany({ where: { clerkUserId: userId } });
        console.info(`User ${userId} deleted from DB via Clerk webhook`);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
