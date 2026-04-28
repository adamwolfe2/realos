import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/db";
import { OrgType, TenantStatus, UserRole } from "@prisma/client";
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

// ---------------------------------------------------------------------------
// Slug helpers (mirrored from lib/actions/convert-intake.ts)
// ---------------------------------------------------------------------------
const SLUG_MAX = 60;
const SLUG_COLLISION_MAX = 50;

function deriveSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX);
  return base || "tenant";
}

async function pickUniqueSlug(name: string): Promise<string> {
  const base = deriveSlug(name);
  let candidate = base;
  let n = 2;
  while (n <= SLUG_COLLISION_MAX + 1) {
    const existing = await prisma.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    const suffix = `-${n}`;
    candidate = `${base.slice(0, SLUG_MAX - suffix.length)}${suffix}`;
    n += 1;
  }
  throw new Error("Could not generate a unique tenant slug");
}

// ---------------------------------------------------------------------------
// Webhook event types
// ---------------------------------------------------------------------------

interface UserEventData {
  id: string;
  email_addresses?: { email_address: string }[];
  first_name?: string | null;
  last_name?: string | null;
  public_metadata?: Record<string, unknown>;
}

interface OrgEventData {
  id: string;
  name: string;
  slug?: string | null;
  deleted?: boolean;
}

interface OrgMembershipEventData {
  id: string;
  role: string; // "org:admin" | "org:member" | ...
  organization: { id: string };
  public_user_data: { user_id: string };
}

type WebhookEventData = UserEventData | OrgEventData | OrgMembershipEventData;

interface WebhookEvent {
  type: string;
  data: WebhookEventData;
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
  // Clerk events are small (<10 KB normally). Cap at 3 MB to prevent
  // memory/CPU DoS from a forged oversize POST being HMAC-verified.
  if (Buffer.byteLength(payload, "utf8") > 3 * 1024 * 1024) {
    return NextResponse.json({ error: "Body too large" }, { status: 413 });
  }
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
      const d = event.data as UserEventData;
      const { id, email_addresses, first_name, last_name, public_metadata } = d;
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
      const userId = (event.data as UserEventData).id;
      if (userId) {
        await prisma.user.deleteMany({ where: { clerkUserId: userId } });
        console.info(`User ${userId} deleted from DB via Clerk webhook`);
      }
      break;
    }

    // -----------------------------------------------------------------------
    // Organization events
    // -----------------------------------------------------------------------

    case "organization.created": {
      const d = event.data as OrgEventData;
      const { id: clerkOrgId, name } = d;

      // Idempotency: skip if org already exists with this clerkOrgId
      const existing = await prisma.organization.findUnique({
        where: { clerkOrgId },
        select: { id: true },
      });
      if (existing) {
        console.info(`organization.created: org ${clerkOrgId} already in DB, skipping`);
        break;
      }

      const slug = await pickUniqueSlug(name);

      await prisma.organization.create({
        data: {
          name,
          slug,
          clerkOrgId,
          orgType: OrgType.CLIENT,
          status: TenantStatus.INTAKE_RECEIVED,
          moduleWebsite: false,
          modulePixel: false,
          moduleChatbot: false,
          moduleGoogleAds: false,
          moduleMetaAds: false,
          moduleSEO: false,
          moduleEmail: false,
          moduleOutboundEmail: false,
          moduleReferrals: false,
          moduleCreativeStudio: false,
          moduleLeadCapture: false,
        },
      });

      console.info(`organization.created: provisioned org ${clerkOrgId} (${name})`);
      break;
    }

    case "organization.deleted": {
      const d = event.data as OrgEventData;
      const { id: clerkOrgId } = d;

      const org = await prisma.organization.findUnique({
        where: { clerkOrgId },
        select: { id: true },
      });
      if (!org) {
        console.info(`organization.deleted: org ${clerkOrgId} not in DB, skipping`);
        break;
      }

      await prisma.organization.update({
        where: { id: org.id },
        data: { status: TenantStatus.CHURNED },
      });

      console.info(`organization.deleted: org ${clerkOrgId} marked CHURNED`);
      break;
    }

    // -----------------------------------------------------------------------
    // Organization membership events
    // -----------------------------------------------------------------------

    case "organizationMembership.created": {
      const d = event.data as OrgMembershipEventData;
      const clerkOrgId = d.organization.id;
      const clerkUserId = d.public_user_data.user_id;

      const org = await prisma.organization.findUnique({
        where: { clerkOrgId },
        select: { id: true },
      });
      if (!org) {
        console.warn(
          `organizationMembership.created: org ${clerkOrgId} not found in DB, skipping`
        );
        break;
      }

      // Map Clerk role to UserRole. Default to CLIENT_VIEWER for unknown roles.
      const role: UserRole =
        d.role === "org:admin" ? UserRole.CLIENT_OWNER : UserRole.CLIENT_VIEWER;

      // Upsert the user: if they already exist, update their orgId and role.
      // If they don't exist yet (user.created may arrive before membership
      // event), create a minimal placeholder that will be filled in on
      // user.created/updated.
      const existingUser = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, email: true },
      });

      if (existingUser) {
        await prisma.user.update({
          where: { clerkUserId },
          data: { orgId: org.id, role },
        });
        console.info(
          `organizationMembership.created: linked user ${clerkUserId} to org ${clerkOrgId}`
        );
      } else {
        console.info(
          `organizationMembership.created: user ${clerkUserId} not in DB yet; ` +
            `user.created event will handle linking`
        );
      }
      break;
    }

    case "organizationMembership.deleted": {
      const d = event.data as OrgMembershipEventData;
      const clerkOrgId = d.organization.id;
      const clerkUserId = d.public_user_data.user_id;

      const org = await prisma.organization.findUnique({
        where: { clerkOrgId },
        select: { id: true },
      });

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, orgId: true },
      });

      if (!user) {
        console.info(
          `organizationMembership.deleted: user ${clerkUserId} not in DB, skipping`
        );
        break;
      }

      // Only act if the user is currently a member of this org.
      if (org && user.orgId === org.id) {
        // orgId is required (non-nullable). Re-home them to the agency org so
        // the row stays valid. They will re-join a client org on next invite.
        const agencySlug = process.env.AGENCY_ORG_SLUG ?? "leasestack-agency";
        const agencyOrg = await prisma.organization.findUnique({
          where: { slug: agencySlug },
          select: { id: true },
        });

        if (agencyOrg) {
          await prisma.user.update({
            where: { clerkUserId },
            data: { orgId: agencyOrg.id, role: UserRole.CLIENT_VIEWER },
          });
          console.info(
            `organizationMembership.deleted: user ${clerkUserId} re-homed to agency org`
          );
        } else {
          console.warn(
            `organizationMembership.deleted: agency org "${agencySlug}" not found; ` +
              `user ${clerkUserId} orgId unchanged`
          );
        }
      } else {
        console.info(
          `organizationMembership.deleted: user ${clerkUserId} not in org ${clerkOrgId}, skipping`
        );
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
