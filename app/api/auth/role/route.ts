import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { provisionUserForClerk } from "@/lib/auth/provision";

// GET /api/auth/role
//
// Called by /auth/redirect after Clerk sign-in. Resolves the signed-in
// Clerk user to a LeaseStack User row and returns the role + org type so
// the client can route them to /admin vs /portal.
//
// Provisioning strategy (delegated to provisionUserForClerk):
//   1. clerkUserId match → return as-is.
//   2. email match → claim the placeholder row (invite flow).
//   3. neither → create a fresh CLIENT Organization + CLIENT_OWNER User
//      so brand-new self-signups land in a working portal instead of
//      dead-ending with "Your account is not set up yet". This is the
//      launch-blocker we hit when the Clerk webhook hadn't fired (or
//      wasn't configured) and the user had no pre-seeded invite row.
//
// Failures here are critical — every signed-in Clerk session must
// resolve to a usable role. We log loudly on errors and still return a
// 200-with-null so the client can show its retry / contact-support
// affordance instead of getting a 500 from the API.

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ role: null }, { status: 401 });
  }

  let email: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;

  try {
    const clerkUser = await currentUser();
    email =
      clerkUser?.emailAddresses?.find(
        (e) => e.id === clerkUser?.primaryEmailAddressId,
      )?.emailAddress ??
      clerkUser?.emailAddresses?.[0]?.emailAddress ??
      null;
    firstName = clerkUser?.firstName ?? null;
    lastName = clerkUser?.lastName ?? null;
  } catch (err) {
    console.error("[auth/role] currentUser() failed:", err);
  }

  if (!email) {
    // No email on the Clerk session means we can't auto-provision. This
    // is rare but legitimate — return null so the client redirects to a
    // helpful "contact admin" message rather than 500ing.
    return NextResponse.json({ role: null });
  }

  try {
    const provisioned = await provisionUserForClerk({
      clerkUserId: userId,
      email,
      firstName,
      lastName,
    });
    return NextResponse.json({
      role: provisioned.role,
      orgType: provisioned.org.orgType,
      orgSlug: provisioned.org.slug,
      // Surface whether this call actually created the org so the client
      // can route freshly-provisioned users to the setup hub instead of
      // an empty dashboard. Existing users get the standard /portal
      // landing path.
      created: provisioned.created,
    });
  } catch (err) {
    console.error("[auth/role] provision failed:", err);
    return NextResponse.json({ role: null });
  }
}
