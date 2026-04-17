import type { TenantSiteConfig } from "@prisma/client";

// Placeholder. Sprint 09 forks the proactive chatbot from telegraph-commons
// and wires the API at /api/chatbot. For now we render a tiny floating
// affordance that tells the operator the module is on but not yet built.
export function ChatbotLoader({
  orgId,
  config,
}: {
  orgId: string;
  config: TenantSiteConfig;
}) {
  void orgId;
  void config;
  return (
    <div
      aria-hidden="true"
      className="fixed bottom-4 right-4 z-40 text-[10px] bg-black/80 text-white px-3 py-1.5 rounded"
    >
      Chatbot module, Sprint 09
    </div>
  );
}
