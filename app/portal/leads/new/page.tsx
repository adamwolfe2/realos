import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { ALLOWED_WRITE_ROLES } from "@/lib/auth/write-roles";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { PageHeader } from "@/components/admin/page-header";
import { AddLeadForm } from "@/components/portal/add-lead-form";

export const metadata: Metadata = { title: "Add lead" };
export const dynamic = "force-dynamic";

export default async function AddLeadPage() {
  const scope = await requireScope();
  // The action is the trust boundary; this only keeps read-only seats off
  // a form that would refuse them.
  if (!ALLOWED_WRITE_ROLES.has(scope.role)) redirect("/portal/leads");
  const properties = await prisma.property.findMany({
    where: {
      ...marketablePropertyWhere(scope.orgId),
      ...(scope.allowedPropertyIds ? { id: { in: scope.allowedPropertyIds } } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={
          <Link href="/portal/leads" className="hover:text-foreground transition-colors">
            ← Leads
          </Link>
        }
        title="Add lead"
        description="Add a walk-in, phone or listing-site inquiry so you can track it from first contact to lease."
      />
      <AddLeadForm properties={properties} />
    </div>
  );
}
