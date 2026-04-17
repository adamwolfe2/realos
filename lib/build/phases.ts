/**
 * 15-phase build process for a client portal.
 * Phase 0 = not started.
 */
export const PHASE_NAMES: Record<number, string> = {
  0:  "Not Started",
  1:  "Intake Review",
  2:  "Config Gen",
  3:  "Repo Setup",
  4:  "Env Config",
  5:  "Auth Setup",
  6:  "Branding",
  7:  "Products",
  8:  "Ordering",
  9:  "Payments",
  10: "Shipping",
  11: "Notifications",
  12: "Client Preview",
  13: "Staging QA",
  14: "DNS & Launch",
  15: "Live",
}

export function getPhaseName(phase: number): string {
  return PHASE_NAMES[phase] ?? `Phase ${phase}`
}
