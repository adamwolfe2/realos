import type { IntegrationHealth } from "./types";
import { formatAge } from "./helpers";

// ---------------------------------------------------------------------------
// Sidebar — integrations list.
// ---------------------------------------------------------------------------

export function PropertyIntegrationsList({
  appfolio,
  chatbot,
  pixel,
  ga4,
  gsc,
}: {
  appfolio: { connected: boolean; lastSyncedAt: Date | null };
  chatbot: { enabled: boolean; personaName: string | null };
  pixel: {
    connected: boolean;
    hasRecentEvents: boolean;
    lastEventAt: Date | null;
  };
  ga4: { connected: boolean; lastSyncAt: Date | null };
  gsc: { connected: boolean; lastSyncAt: Date | null };
}) {
  const rows: Array<{
    name: string;
    state: string;
    health: IntegrationHealth;
  }> = [
    {
      name: "AppFolio",
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
      state: chatbot.enabled
        ? chatbot.personaName
          ? `"${chatbot.personaName}" live`
          : "live"
        : "not enabled",
      health: chatbot.enabled ? "healthy" : "off",
    },
    {
      name: "Cursive Pixel",
      state: !pixel.connected
        ? "not installed"
        : pixel.hasRecentEvents
          ? "live"
          : "no recent events",
      health: !pixel.connected
        ? "off"
        : pixel.hasRecentEvents
          ? "healthy"
          : "degraded",
    },
    {
      name: "GA4",
      state: ga4.connected
        ? ga4.lastSyncAt
          ? `synced ${formatAge(ga4.lastSyncAt)}`
          : "connected"
        : "not connected",
      health: ga4.connected ? "healthy" : "off",
    },
    {
      name: "Search Console",
      state: gsc.connected
        ? gsc.lastSyncAt
          ? `synced ${formatAge(gsc.lastSyncAt)}`
          : "connected"
        : "not connected",
      health: gsc.connected ? "healthy" : "off",
    },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
        Integrations
      </p>
      <ul className="mt-2 space-y-2.5">
        {rows.map((row) => (
          <li
            key={row.name}
            className="flex items-center justify-between gap-3 min-w-0"
          >
            <span className="flex items-center gap-2 min-w-0">
              <StatusDot health={row.health} />
              <span className="text-[12px] font-medium text-foreground truncate">
                {row.name}
              </span>
            </span>
            <span className="text-[11px] text-muted-foreground shrink-0 truncate max-w-[55%] text-right">
              {row.state}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusDot({ health }: { health: IntegrationHealth }) {
  const cls =
    health === "healthy"
      ? "bg-green-500"
      : health === "degraded"
        ? "bg-amber-500"
        : "bg-muted-foreground/30";
  return (
    <span
      className={`h-2 w-2 rounded-full shrink-0 ${cls}`}
      aria-hidden="true"
    />
  );
}
