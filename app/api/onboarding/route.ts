import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  publicSignupLimiter,
  checkRateLimit,
  getIp,
} from "@/lib/rate-limit";
import {
  notifyNewIntake as notifyIntakeSlack,
} from "@/lib/integrations/slack";
import {
  sendIntakeReceivedEmail,
  notifyAgencyOfIntake,
} from "@/lib/email/onboarding-emails";
import {
  PropertyType,
  ResidentialSubtype,
  CommercialSubtype,
  BackendPlatform,
  Prisma,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// POST /api/onboarding
// Public intake submission endpoint. Rate limited by IP (5/hour).
// Returns { ok, submissionId } on success. On success:
//   - IntakeSubmission row created
//   - Slack notification fired (non-blocking)
//   - Confirmation email to the contact (non-blocking)
//   - Notification email to the agency ops inbox (non-blocking)
// ---------------------------------------------------------------------------

const moduleKeys = [
  "website",
  "pixel",
  "chatbot",
  "googleAds",
  "metaAds",
  "seo",
  "email",
  "outboundEmail",
  "referrals",
  "creativeStudio",
  "leadCapture",
] as const;

const schema = z.object({
  companyName: z.string().min(1).max(200),
  shortName: z.string().max(100).optional(),
  websiteUrl: z
    .union([z.string().url(), z.literal("")])
    .transform((v) => (v ? v : undefined))
    .optional(),
  propertyType: z.nativeEnum(PropertyType),
  residentialSubtype: z.nativeEnum(ResidentialSubtype).optional(),
  commercialSubtype: z.nativeEnum(CommercialSubtype).optional(),
  primaryContactName: z.string().min(1).max(200),
  primaryContactEmail: z.string().email(),
  primaryContactPhone: z.string().max(40).optional(),
  primaryContactRole: z.string().max(100).optional(),
  hqCity: z.string().max(100).optional(),
  hqState: z.string().max(40).optional(),

  numberOfProperties: z.number().int().positive().max(10_000).optional().nullable(),
  currentBackendPlatform: z.nativeEnum(BackendPlatform).optional(),
  backendPlanTier: z.string().max(40).optional(),
  currentVendor: z.string().max(200).optional(),
  currentMonthlySpendCents: z
    .number()
    .int()
    .nonnegative()
    .max(100_000_000)
    .optional()
    .nullable(),
  biggestPainPoint: z.string().max(500).optional(),

  selectedModules: z.array(z.enum(moduleKeys)),

  goLiveTarget: z.enum(["asap", "one_month", "three_months", "exploring"]).optional(),
  bookedCallAt: z.string().datetime().optional(),
  calBookingId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(publicSignupLimiter, ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests, try again later." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  try {
    const submission = await prisma.intakeSubmission.create({
      data: {
        companyName: data.companyName,
        shortName: data.shortName,
        websiteUrl: data.websiteUrl,
        propertyType: data.propertyType,
        residentialSubtype: data.residentialSubtype,
        commercialSubtype: data.commercialSubtype,
        primaryContactName: data.primaryContactName,
        primaryContactEmail: data.primaryContactEmail,
        primaryContactPhone: data.primaryContactPhone,
        primaryContactRole: data.primaryContactRole,
        hqCity: data.hqCity,
        hqState: data.hqState,
        numberOfProperties: data.numberOfProperties ?? undefined,
        currentBackendPlatform: data.currentBackendPlatform ?? BackendPlatform.NONE,
        backendPlanTier: data.backendPlanTier,
        currentVendor: data.currentVendor,
        currentMonthlySpendCents: data.currentMonthlySpendCents ?? undefined,
        biggestPainPoint: data.biggestPainPoint,
        selectedModules: data.selectedModules as unknown as Prisma.InputJsonValue,
        goLiveTarget: data.goLiveTarget,
        bookedCallAt: data.bookedCallAt ? new Date(data.bookedCallAt) : undefined,
        calBookingId: data.calBookingId,
        status: data.bookedCallAt ? "consultation_booked" : "submitted",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") ?? undefined,
        referrer: req.headers.get("referer") ?? undefined,
        raw: data as unknown as Prisma.InputJsonValue,
      },
    });

    const agencyEmail = process.env.AGENCY_ADMIN_EMAIL;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    // Fire-and-forget notifications. Any failure is logged but does not
    // change the intake outcome.
    void Promise.allSettled([
      notifyIntakeSlack({
        companyName: data.companyName,
        contactName: data.primaryContactName,
        contactEmail: data.primaryContactEmail,
        propertyType: data.propertyType,
        moduleCount: data.selectedModules.length,
        intakeId: submission.id,
        appUrl: appUrl ?? undefined,
      }),
      sendIntakeReceivedEmail({
        to: data.primaryContactEmail,
        name: data.primaryContactName,
        companyName: data.companyName,
        bookedCallAt: data.bookedCallAt,
      }),
      agencyEmail
        ? notifyAgencyOfIntake({
            to: agencyEmail,
            intakeId: submission.id,
            companyName: data.companyName,
            primaryContactName: data.primaryContactName,
            primaryContactEmail: data.primaryContactEmail,
            propertyType: data.propertyType,
            moduleCount: data.selectedModules.length,
            biggestPainPoint: data.biggestPainPoint,
            currentVendor: data.currentVendor,
            currentMonthlySpendCents: data.currentMonthlySpendCents ?? null,
          })
        : Promise.resolve({ ok: false, error: "AGENCY_ADMIN_EMAIL unset" }),
    ]).then((results) => {
      for (const r of results) {
        if (r.status === "rejected") {
          console.warn("[onboarding] notification error:", r.reason);
        }
      }
    });

    return NextResponse.json(
      { ok: true, submissionId: submission.id },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/onboarding]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
