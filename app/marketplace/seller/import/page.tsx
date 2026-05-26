import Link from "next/link";
import { redirect } from "next/navigation";
import { getSellerSession } from "@/lib/marketplace/seller-auth";
import { SellerImportTabs } from "@/components/marketplace/seller-import-tabs";

export const dynamic = "force-dynamic";

export default async function SellerImportPage() {
  const seller = await getSellerSession();
  if (!seller) redirect("/marketplace/seller/sign-in");

  return (
    <div className="max-w-[960px] mx-auto px-4 md:px-8 py-10 md:py-14">
      <Link
        href="/marketplace/seller"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#64748B",
          fontWeight: 600,
        }}
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
        Import leads into the marketplace.
      </h1>
      <p
        className="mt-3 max-w-[640px]"
        style={{
          color: "#64748B",
          fontFamily: "var(--font-sans)",
          fontSize: "15px",
          lineHeight: 1.55,
        }}
      >
        Two ways to add leads: upload a CSV from your overflow inbox, or
        wire an audience segment that gets re-pulled weekly. Either way,
        every lead is scored, priced, and earns you a {seller.revShareBps / 100}%
        share of every sale.
      </p>

      <div className="mt-8">
        <SellerImportTabs />
      </div>
    </div>
  );
}
