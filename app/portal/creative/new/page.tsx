import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
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
      <header>
        <Link
          href="/portal/creative"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Creative studio
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">
          New creative request
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Share the brief, the reference images, and any brand assets. We'll
          come back with a first draft within the target date.
        </p>
      </header>
      <CreativeRequestForm properties={properties} />
    </div>
  );
}
