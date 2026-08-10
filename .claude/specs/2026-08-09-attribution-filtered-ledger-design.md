# Attribution Filtered Ledger Design

Status: Approved
Date: 2026-08-09

## Goal

Make LeaseStack-affiliated leads easy to find and distinguish without a large attribution graph or unreliable tour stages.

## Design

- Keep the page header, date controls, KPI summary, review queue, and proof ledger.
- Make the ledger the primary interface directly below the KPI summary.
- Replace the source dropdown with compact horizontal source filters that preserve date and property scope.
- Highlight the active source filter in blue.
- Render chatbot, popup/form, and visitor-pixel sources as compact light-blue badges. Keep imported AppFolio leads neutral gray.
- Preserve all existing source options, export behavior, and proof details.
- Do not show a graph, animation, or tour stages.

## Data and safety

- Reuse the existing tenant and property-scoped attribution query.
- Keep LeaseStack headline totals separate from imported PMS leads.
- No schema, matching, mutation, or integration changes.

## Acceptance checks

- The oversized flow graphic is absent.
- All source filters are keyboard-accessible links with a visible active state.
- Chatbot and popup/form sources are visually prominent but remain readable in the table.
- Date, property, source, and CSV filters remain consistent.
