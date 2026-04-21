import { PlatformNav } from "@/components/platform/nav";
import { PlatformFooter } from "@/components/platform/footer";
import { LiveTicker } from "@/components/platform/live-ticker";

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
      <LiveTicker />
    </div>
  );
}
