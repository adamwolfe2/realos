import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { requireModule } from "@/lib/portal/module-gate";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { PageHeader } from "@/components/admin/page-header";
import { LogApplicationForm } from "@/components/portal/manual-entry-forms";

export const metadata: Metadata = { title: "Log application" };
export const dynamic = "force-dynamic";

export default async function LogApplicationPage() {
  const gate = await requireModule("moduleResidents");
  if (gate) return gate;
  const scope = await requireScope();
  // Marketable only — see residents/new for rationale.
  const properties = await prisma.property.findMany({
    where: {
      ...marketablePropertyWhere(scope.orgId),
      ...(scope.allowedPropertyIds
        ? { id: { in: scope.allowedPropertyIds } }
        : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={
          <Link
            href="/portal/applications"
            className="hover:text-foreground transition-colors"
          >
            ← Applications
          </Link>
        }
        title="Log application"
        description="Manually log a rental application. The applicant is added to your lead pipeline automatically."
      />
      <LogApplicationForm properties={properties} />
    </div>
  );
}
