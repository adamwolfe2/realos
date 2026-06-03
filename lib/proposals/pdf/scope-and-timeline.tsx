import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { styles } from "./styles";
import type { ProposalPdfTimelinePhase } from "./types";

// ---------------------------------------------------------------------------
// Scope of work + delivery timeline blocks.
//
// Both render between the title block and the line-item tables. Either
// (or both) can be null/empty — the document conditionally renders.
//
// scopeNarrative supports a tiny subset of markdown (paragraph breaks
// via blank lines, bold via **text**). We keep it minimal because
// @react-pdf doesn't ship a full markdown engine and the visual cost
// of mismatched rendering on a paid PDF is much higher than the cost
// of asking operators to write clean prose.
// ---------------------------------------------------------------------------

function formatWeekRange(start: number, end: number): string {
  if (start === end) return `Week ${start}`;
  return `Week ${start} – ${end}`;
}

/**
 * Minimal markdown → react-pdf converter. Splits on blank lines into
 * paragraphs, then on `**bold**` runs inside each paragraph. Anything
 * else (headings, lists, links) renders as plain text.
 */
function renderScopeText(raw: string): React.ReactElement[] {
  const paragraphs = raw.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return paragraphs.map((para, idx) => {
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    const boldRe = /\*\*([^*\n]+)\*\*/g;
    let m: RegExpExecArray | null;
    while ((m = boldRe.exec(para)) !== null) {
      if (m.index > cursor) {
        parts.push(para.slice(cursor, m.index));
      }
      parts.push(
        <Text key={`b-${idx}-${m.index}`} style={{ fontFamily: "Helvetica-Bold" }}>
          {m[1]}
        </Text>,
      );
      cursor = m.index + m[0].length;
    }
    if (cursor < para.length) parts.push(para.slice(cursor));
    return (
      <Text
        key={`p-${idx}`}
        style={[styles.scopeText, { marginBottom: idx === paragraphs.length - 1 ? 0 : 8 }]}
      >
        {parts.length > 0 ? parts : para}
      </Text>
    );
  });
}

export function ScopeSection({
  narrative,
}: {
  narrative: string | null;
}): React.ReactElement | null {
  if (!narrative || narrative.trim().length === 0) return null;
  return (
    <View style={styles.scopeBlock} wrap>
      <Text style={styles.sectionLabel}>SCOPE OF WORK</Text>
      {renderScopeText(narrative)}
    </View>
  );
}

export function TimelineSection({
  phases,
}: {
  phases: ProposalPdfTimelinePhase[] | null;
}): React.ReactElement | null {
  if (!phases || phases.length === 0) return null;
  return (
    <View style={styles.timelineBlock} wrap>
      <Text style={styles.sectionLabel}>DELIVERY TIMELINE</Text>
      {/* Header row, mirrors the line-item table header for visual rhythm */}
      <View style={styles.tableHeader} fixed>
        <Text style={[styles.tableHeaderText, styles.timelinePhaseCol]}>
          Phase
        </Text>
        <Text style={[styles.tableHeaderText, styles.timelineWeeksCol]}>
          Window
        </Text>
        <Text style={[styles.tableHeaderText, styles.timelineDeliverablesCol]}>
          Deliverables
        </Text>
      </View>
      {phases.map((p, idx) => (
        <View key={`tl-${idx}`} style={styles.timelinePhaseRow} wrap={false}>
          <View style={styles.timelinePhaseCol}>
            <Text style={styles.timelinePhaseName}>{p.phase}</Text>
          </View>
          <View style={styles.timelineWeeksCol}>
            <Text style={styles.timelineWeeks}>
              {formatWeekRange(p.startWeek, p.endWeek)}
            </Text>
          </View>
          <View style={styles.timelineDeliverablesCol}>
            {p.deliverables.length === 0 ? (
              <Text style={styles.timelineDeliverableItem}>—</Text>
            ) : (
              p.deliverables.map((d, dIdx) => (
                <Text
                  key={`d-${idx}-${dIdx}`}
                  style={styles.timelineDeliverableItem}
                >
                  •  {d}
                </Text>
              ))
            )}
          </View>
        </View>
      ))}
    </View>
  );
}
