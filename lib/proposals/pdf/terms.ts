// ---------------------------------------------------------------------------
// Proposal PDF — billing terms copy.
//
// Pure helper so the JSX stays readable. The exact wording matters —
// prospects scan this section first for the "when am I actually charged?"
// answer, so we lead with that and back into the cadence/trial details.
// ---------------------------------------------------------------------------

export function buildTermsCopy(args: {
  cadence: "MONTHLY" | "ANNUAL" | null;
  hasTrial: boolean;
  trialDays: number;
  firstChargeDate: string | null;
  hasRecurring: boolean;
  hasOneTime: boolean;
  validUntil: string;
  currency: string;
}): string {
  const parts: string[] = [];
  const cadenceText =
    args.cadence === "MONTHLY"
      ? "monthly"
      : args.cadence === "ANNUAL"
        ? "annual"
        : "";

  if (args.hasTrial && args.hasRecurring) {
    parts.push(
      `Your card is collected at checkout to start the ${args.trialDays}-day free trial. ` +
        `${cadenceText ? cadenceText.charAt(0).toUpperCase() + cadenceText.slice(1) : "Recurring"} billing begins${
          args.firstChargeDate ? ` on ${args.firstChargeDate}` : " at trial end"
        } and renews automatically until canceled.`,
    );
  } else if (args.hasRecurring && cadenceText) {
    parts.push(
      `Your card is charged at checkout for the first ${cadenceText} period. ` +
        `${cadenceText.charAt(0).toUpperCase() + cadenceText.slice(1)} billing renews automatically until canceled.`,
    );
  }

  if (args.hasOneTime) {
    parts.push(
      "One-time charges are billed in full at checkout and are non-refundable once delivery has begun.",
    );
  }

  if (args.validUntil) {
    parts.push(
      `This proposal is valid until ${args.validUntil}. After that date the pricing may be re-quoted.`,
    );
  }

  parts.push(
    `All amounts in ${args.currency.toUpperCase()}. Cancel anytime from your billing portal — no long-term commitment.`,
  );

  return parts.join(" ");
}
