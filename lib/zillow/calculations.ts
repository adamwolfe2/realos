/**
 * Investor-style math for a parsed Zillow listing. Pure functions, no
 * I/O — safe to unit-test and safe to import from server or client code.
 *
 * Assumptions (all explicit, all callable as overrides):
 *   - Default mortgage rate: 7.0% (annual, nominal)
 *   - Default term: 30 years
 *   - Expense reserve for cash-on-cash: 30% of gross rent (covers taxes,
 *     insurance, vacancy, maintenance, capex, mgmt). This is a heuristic;
 *     real-world numbers vary, but 30% is the common rule of thumb for a
 *     back-of-envelope cap-rate sanity check.
 *
 * Every output is plain numbers (or null when an input is missing) so
 * the JSON payload we store is self-describing.
 */

export type CalculationInputs = {
  listPrice: number;
  rentZestimate?: number | null;
  /** Annual mortgage rate, e.g. 0.07 for 7%. Default 7.0%. */
  mortgageRate?: number;
  /** Loan term in years. Default 30. */
  termYears?: number;
  /** Expense reserve as a fraction of gross rent. Default 0.30. */
  expenseReserveFrac?: number;
};

export type DownPaymentBreakdown = {
  downPct: number;
  downPayment: number;
  loanAmount: number;
  monthlyPI: number;
};

export type CalculationOutputs = {
  assumptions: {
    mortgageRate: number;
    termYears: number;
    expenseReserveFrac: number;
  };
  downPayments: DownPaymentBreakdown[];
  capRate: number | null;
  priceToRent: number | null;
  cashOnCashAt20: number | null;
};

const DEFAULT_RATE = 0.07;
const DEFAULT_TERM = 30;
const DEFAULT_EXPENSE_RESERVE = 0.3;
const DOWN_TIERS = [0.2, 0.25, 0.3];

/**
 * Standard amortizing-loan monthly P&I.
 *
 *   M = P * r / (1 - (1 + r)^-n)
 *
 *   where r = monthly rate, n = total payments.
 *
 * Special-cased for 0% rate to avoid the indeterminate form.
 */
export function monthlyPayment(
  principal: number,
  annualRate: number,
  termYears: number,
): number {
  if (principal <= 0 || termYears <= 0) return 0;
  const n = termYears * 12;
  if (annualRate <= 0) return principal / n;
  const r = annualRate / 12;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function computeCalculations(
  inputs: CalculationInputs,
): CalculationOutputs {
  const {
    listPrice,
    rentZestimate,
    mortgageRate = DEFAULT_RATE,
    termYears = DEFAULT_TERM,
    expenseReserveFrac = DEFAULT_EXPENSE_RESERVE,
  } = inputs;

  if (!Number.isFinite(listPrice) || listPrice <= 0) {
    return {
      assumptions: { mortgageRate, termYears, expenseReserveFrac },
      downPayments: [],
      capRate: null,
      priceToRent: null,
      cashOnCashAt20: null,
    };
  }

  const downPayments: DownPaymentBreakdown[] = DOWN_TIERS.map((pct) => {
    const downPayment = round2(listPrice * pct);
    const loanAmount = round2(listPrice - downPayment);
    const piRaw = monthlyPayment(loanAmount, mortgageRate, termYears);
    return {
      downPct: pct,
      downPayment,
      loanAmount,
      monthlyPI: round2(piRaw),
    };
  });

  let capRate: number | null = null;
  let priceToRent: number | null = null;
  let cashOnCashAt20: number | null = null;

  if (rentZestimate && rentZestimate > 0) {
    const annualRent = rentZestimate * 12;
    capRate = annualRent / listPrice;
    priceToRent = listPrice / annualRent;

    const t20 = downPayments[0]; // 20% tier
    const annualPI = t20.monthlyPI * 12;
    const annualExpenses = annualRent * expenseReserveFrac;
    const annualCashFlow = annualRent - annualPI - annualExpenses;
    cashOnCashAt20 =
      t20.downPayment > 0 ? annualCashFlow / t20.downPayment : null;
  }

  return {
    assumptions: { mortgageRate, termYears, expenseReserveFrac },
    downPayments,
    capRate,
    priceToRent,
    cashOnCashAt20,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
