import { PlatformNav } from "@/components/platform/nav";
import { PlatformFooter } from "@/components/platform/footer";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <PlatformNav />
      <main className="flex-1">{children}</main>
      <PlatformFooter />
    </div>
  );
}
