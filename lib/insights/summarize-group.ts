// ---------------------------------------------------------------------------
// summarizeGroup
//
// Renders a one-line summary title + body for a group of insights that share
// the same (kind, severity). Used by the report deliverable's GroupedInsights
// component to collapse 17 "X% below portfolio average" rows into one
// expandable card.
//
// Pure function — no side effects, no imports. Lifted out of report-view.tsx
// so the kind → copy mapping is testable without spinning up the report
// page. New insight kinds get added here and pick up grouping behavior
// automatically.
// ---------------------------------------------------------------------------

export type InsightGroupSummary = {
  title: string;
  body: string;
};

export function summarizeGroup(
  kind: string,
  severity: string,
  count: number,
): InsightGroupSummary {
  switch (kind) {
    case "portfolio_outlier":
      if (severity === "info") {
        return {
          title: `${count} properties priced below portfolio average`,
          body: "Renewing closer to the portfolio average could lift monthly rent roll. Open each to see the per-property gap and suggested move.",
        };
      }
      return {
        title: `${count} properties priced above portfolio with open vacancy`,
        body: "These may be priced above what the local market is absorbing. Open each to see vacancy + suggested concession.",
      };
    case "pipeline_stall":
      return {
        title: `${count} leads stuck in pipeline`,
        body: "These leads haven't moved status in a while. Open each to see who they are and the suggested next step.",
      };
    case "negative_review":
      return {
        title: `${count} new negative reviews`,
        body: "Reviews 3 stars or lower posted this period. Open each to draft a response.",
      };
    case "hot_visitor":
      return {
        title: `${count} hot visitors flagged`,
        body: "High-intent identified visitors who haven't converted to a lead yet.",
      };
    case "keyword_drop":
      return {
        title: `${count} keywords lost ranking`,
        body: "Queries that previously drove traffic dropped position this period.",
      };
    case "vacancy_needs_boost":
      return {
        title: `${count} vacancies need a boost`,
        body: "Units sitting longer than typical days-on-market for the portfolio.",
      };
    case "cpl_spike":
      return {
        title: `${count} cost-per-lead spikes`,
        body: "Ad sources where cost-per-lead is materially above the running baseline.",
      };
    case "wasted_ad_spend":
      return {
        title: `${count} ad spend leaks`,
        body: "Campaigns spending without converting at the portfolio benchmark.",
      };
    case "renewal_cliff":
      return {
        title: `${count} renewal cliffs ahead`,
        body: "Concentrations of lease expirations that need outreach now.",
      };
    case "tour_noshow_spike":
      return {
        title: `${count} tour no-show spikes`,
        body: "Properties where the no-show rate jumped over the baseline.",
      };
    case "chatbot_silence":
      return {
        title: `${count} chatbot silences`,
        body: "Periods where chatbot capture rate dropped below baseline.",
      };
    default:
      // Future-proof: any new insight kind picks up a reasonable default
      // ("3 traffic_drop alerts" → "3 traffic drop alerts"). Replace the
      // default by adding an explicit case above when the new kind ships.
      return {
        title: `${count} ${kind.replace(/_/g, " ")} alerts`,
        body: "Open to see the full list.",
      };
  }
}
