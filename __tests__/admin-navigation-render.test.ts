import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminNavList } from "@/app/admin/admin-nav-list";

function renderNavigation(
  pathname: string,
  navBadges: Record<string, number>,
  collapsed = false,
): string {
  return renderToStaticMarkup(
    React.createElement(AdminNavList, { pathname, navBadges, collapsed }),
  );
}

describe("AdminNavList", () => {
  it("renders disclosure semantics and expands the active section", () => {
    const html = renderNavigation("/admin/pixel-requests", {
      pendingPixelRequests: 4,
      openBugReports: 77,
    });

    expect(html).toContain("Client work");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('href="/admin/pixel-requests"');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('href="/admin/bug-reports"');
  });

  it("keeps all eight destinations visible while child tools stay progressive", () => {
    const html = renderNavigation("/admin", { openBugReports: 77 });

    for (const label of [
      "Dashboard",
      "Insights",
      "Pipeline",
      "Sites",
      "Marketplace",
      "Clients",
      "Client work",
      "System",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain('href="/admin/bug-reports"');
    expect(html).toContain("77");
  });

  it("provides explicit labels when the desktop sidebar is collapsed", () => {
    const html = renderNavigation("/admin", {}, true);

    expect(html).toContain('aria-label="Pipeline"');
    expect(html).toContain('title="Pipeline"');
    expect(html).not.toContain("Pipeline overview");
  });
});
