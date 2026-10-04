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
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main>
      <PlatformFooter />
    </div>
  );
}
