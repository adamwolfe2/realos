import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export const metadata: Metadata = { title: "RealOS Admin" };
export const dynamic = "force-dynamic";

// TODO(Sprint 04): rebuild the master admin dashboard (CEO dashboard, client
// list, intake queue, fulfillment pipeline, cross-tenant analytics,
// impersonation entry point, creative request queue).
export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center max-w-2xl mx-auto">
      <h1 className="font-serif text-3xl font-bold mb-4">
        Master admin coming in Sprint 04
      </h1>
      <p className="text-muted-foreground">
        The agency master admin (clients, pipeline, leads, creative requests,
        analytics, impersonation) is rebuilt in Sprint 04 of the build plan.
      </p>
    </div>
  );
}
