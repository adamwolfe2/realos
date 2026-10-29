import type { IntegrationHealth } from "./types";
import { formatAge } from "./helpers";
import { Logo } from "@/components/portal/overview/kit";
import { SourceMark } from "@/components/portal/source-mark";

// ---------------------------------------------------------------------------
// Sidebar — integrations list.
// ---------------------------------------------------------------------------

export function PropertyIntegrationsList({
  appfolio,
  chatbot,
  ga4,
  gsc,
}: {
  appfolio: { connected: boolean; lastSyncedAt: Date | null };
  chatbot: { enabled: boolean; personaName: string | null };
  ga4: { connected: boolean; lastSyncAt: Date | null };
  gsc: { connected: boolean; lastSyncAt: Date | null };
}) {
  const rows: Array<{
    name: string;
    mark: string;
    state: string;
    health: IntegrationHealth;
  }> = [
    {
      name: "AppFolio",
      mark: "appfolio",
      state: appfolio.connected
        ? appfolio.lastSyncedAt
          ? `synced ${formatAge(appfolio.lastSyncedAt)}`
          : "connected"
        : "not connected",
      health: appfolio.connected
        ? appfolio.lastSyncedAt &&
          Date.now() - appfolio.lastSyncedAt.getTime() <
            7 * 24 * 60 * 60 * 1000
          ? "healthy"
          : "degraded"
        : "off",
    },
    {
      name: "Chatbot",
      mark: "CHATBOT",
      state: chatbot.enabled
        ? chatbot.personaName
          ? `"${chatbot.personaName}" live`
          : "live"
        : "not enabled",
      health: chatbot.enabled ? "healthy" : "off",
    },
    {
      name: "GA4",
      mark: "ga4",
      state: ga4.connected
        ? ga4.lastSyncAt
          ? `synced ${formatAge(ga4.lastSyncAt)}`
          : "connected"
        : "not connected",
      health: ga4.connected ? "healthy" : "off",
    },
    {
      name: "Search Console",
      mark: "gsc",
      state: gsc.connected
        ? gsc.lastSyncAt
          ? `synced ${formatAge(gsc.lastSyncAt)}`
          : "connected"
        : "not connected",
      health: gsc.connected ? "healthy" : "off",
    },
  ];

  return (
    <section className="rounded-[2px] border border-border bg-card p-4 md:p-5">
      <p className="text-[13px] font-semibold text-foreground">Integrations</p>
      <ul className="mt-3 space-y-3">
        {rows.map((row) => (
          <li
            key={row.name}
            className="flex items-center justify-between gap-3 min-w-0"
          >
            <span className="flex items-center gap-2.5 min-w-0">
              {/* The tool's own logo, faded when it is not connected. */}
              <span className={row.health === "off" ? "opacity-40 grayscale" : undefined}>
                {row.mark === "CHATBOT" ? (
                  <SourceMark source="CHATBOT" size={24} />
                ) : (
                  <span className="grid h-6 w-6 place-items-center rounded-[6px] border border-border bg-white">
                    <Logo slug={row.mark} size={14} />
                  </span>
                )}
              </span>
              <span className="text-[13px] font-medium text-foreground truncate">
                {row.name}
              </span>
            </span>
            <span
              className={`text-[12px] shrink-0 truncate max-w-[55%] text-right ${
                row.health === "healthy"
                  ? "text-[#15803d]"
                  : row.health === "degraded"
                    ? "text-[#b45309]"
                    : "text-muted-foreground"
              }`}
            >
              {row.state}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
