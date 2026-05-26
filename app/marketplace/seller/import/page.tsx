import Link from "next/link";
import { redirect } from "next/navigation";
import { getSellerSession } from "@/lib/marketplace/seller-auth";
import { SellerImportWizard } from "@/components/marketplace/seller-import-wizard";

export const dynamic = "force-dynamic";

export default async function SellerImportPage() {
  const seller = await getSellerSession();
  if (!seller) redirect("/marketplace/seller/sign-in");

  return (
    <div className="max-w-[960px] mx-auto px-4 md:px-8 py-10 md:py-14">
      <Link
        href="/marketplace/seller"
        className="text-xs uppercase tracking-widest font-semibold text-slate-500 hover:text-slate-700"
      >
        ← Back to dashboard
      </Link>

      <h1
        className="mt-4"
        style={{
          color: "#1E2A3A",
          fontFamily: "var(--font-display)",
          fontSize: "clamp(28px, 3.5vw, 40px)",
          fontWeight: 500,
          lineHeight: 1.12,
          letterSpacing: "-0.012em",
        }}
      >
        Import Data
      </h1>
      <p className="mt-3 max-w-[640px] text-slate-600 text-base leading-relaxed">
        Migrate your leads from spreadsheets or audience segments. We'll
        auto-detect the columns + dedupe against your existing inventory before
        anything is committed. You earn a {seller.revShareBps / 100}% share of
        every sale.
      </p>

      <div className="mt-8">
        <SellerImportWizard />
      </div>
    </div>
  );
}
