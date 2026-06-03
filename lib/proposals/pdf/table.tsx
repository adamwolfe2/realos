import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { styles } from "./styles";
import { formatMoney, cadenceSuffix } from "./format";
import type { ProposalPdfDocumentProps } from "./types";

// ---------------------------------------------------------------------------
// Proposal PDF — table primitives (header + line row + grouped section).
//
// Pulled out of document.tsx so the main document file stays focused on
// composition. Each component is presentational only — no derived state,
// no calculations beyond per-row unit × quantity.
// ---------------------------------------------------------------------------

export type Line = ProposalPdfDocumentProps["lineItems"][number];

export function TableHeader(): React.ReactElement {
  return (
    <View style={styles.tableHeader} fixed>
      <Text style={[styles.tableHeaderText, styles.colItem]}>Item</Text>
      <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
      <Text style={[styles.tableHeaderText, styles.colUnit]}>Unit</Text>
      <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
    </View>
  );
}

export function LineRow({
  line,
  currency,
  cadence,
}: {
  line: Line;
  currency: string;
  cadence: "MONTHLY" | "ANNUAL" | null;
}): React.ReactElement {
  const lineTotal = line.unitPriceCents * line.quantity;
  const suffix = line.recurring ? cadenceSuffix(cadence) : "";
  return (
    <View style={styles.row} wrap={false}>
      <View style={styles.colItem}>
        <Text style={styles.itemLabel}>{line.label}</Text>
        {line.description ? (
          <Text style={styles.itemDescription}>{line.description}</Text>
        ) : null}
      </View>
      <Text style={[styles.cellNumber, styles.colQty]}>{line.quantity}</Text>
      <Text style={[styles.cellNumber, styles.colUnit]}>
        {formatMoney(line.unitPriceCents, currency)}
        {suffix}
      </Text>
      <Text style={[styles.cellNumber, styles.colTotal]}>
        {formatMoney(lineTotal, currency)}
        {suffix}
      </Text>
    </View>
  );
}

export function LineSection({
  label,
  lines,
  currency,
  cadence,
}: {
  label: string;
  lines: Line[];
  currency: string;
  cadence: "MONTHLY" | "ANNUAL" | null;
}): React.ReactElement | null {
  if (lines.length === 0) return null;
  return (
    <View>
      <Text style={styles.sectionLabel}>{label}</Text>
      <TableHeader />
      {lines.map((line, idx) => (
        <LineRow
          key={`${label}-${idx}`}
          line={line}
          currency={currency}
          cadence={cadence}
        />
      ))}
    </View>
  );
}
