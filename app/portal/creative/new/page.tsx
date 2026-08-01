import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { CreativeRequestForm } from "@/components/creative-request/new-form";

export const metadata: Metadata = { title: "New creative request" };
export const dynamic = "force-dynamic";

export default async function NewCreativeRequestPage() {
  const scope = await requireScope();
  const properties = await prisma.property.findMany({
    where: tenantWhere(scope),
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        breadcrumb={
          <Link
            href="/portal/creative"
            className="hover:text-foreground transition-colors"
          >
            ← Creative studio
          </Link>
        }
        title="New creative request"
        description="Share the brief, the reference images, and any brand assets. Managed by LeaseStack — first draft within 3 business days (or your target date, whichever is sooner)."
      />
      <CreativeRequestForm properties={properties} />
    </div>
  );
}
