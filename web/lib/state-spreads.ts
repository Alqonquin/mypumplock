/**
 * State Spread Table & Hedge Strike Conversion
 *
 * Converts a member's retail max price to the correct CME hedge strike
 * by subtracting the state-level retail spread (taxes + transport + margin).
 *
 * WHY: A $4.50 max in California triggers at a different RBOB level than
 * $4.50 in Texas because of different fixed costs. The spread is the gap
 * between wholesale futures and the retail pump price. Movements correlate
 * perfectly (both track RBOB), but the trigger point differs by state.
 *
 * Strike is then rounded DOWN to the nearest $0.05 to align with CME
 * option strike increments.
 */

import { prisma } from "./db";

// WHY: CME RBOB/HO options trade in $0.05 strike increments.
// A member whose hedge strike calculates to $3.78 goes in the $3.75 bucket,
// not $3.80 — we round DOWN for conservative hedging (hedge triggers sooner).
const CME_STRIKE_INCREMENT = 0.05;

/**
 * Default state spreads — used to seed the database.
 *
 * WHY: These combine rack spread (wholesale→retail conversion), state excise
 * taxes, and state sales tax estimates. Source: API Motor Fuel Tax Report Q4 2025
 * + EIA retail-wholesale spread data. Updated quarterly.
 *
 * Regular = RBOB + spread (includes ~$0.184 federal tax + state taxes + margin)
 * Premium = RBOB + spread (higher refining margin)
 * Diesel  = HO + spread (different base futures contract)
 */
export const DEFAULT_STATE_SPREADS: Array<{
  stateCode: string;
  stateName: string;
  regularSpread: number;
  premiumSpread: number;
  dieselSpread: number;
}> = [
  // WHY: Spreads ordered alphabetically. Values reflect total retail markup
  // from wholesale futures, including federal tax ($0.184), state excise tax,
  // state sales tax (where applicable), and average retailer margin (~$0.10-0.15).
  { stateCode: "AL", stateName: "Alabama", regularSpread: 0.95, premiumSpread: 1.30, dieselSpread: 0.90 },
  { stateCode: "AK", stateName: "Alaska", regularSpread: 1.00, premiumSpread: 1.35, dieselSpread: 0.95 },
  { stateCode: "AZ", stateName: "Arizona", regularSpread: 0.95, premiumSpread: 1.30, dieselSpread: 0.85 },
  { stateCode: "AR", stateName: "Arkansas", regularSpread: 0.90, premiumSpread: 1.25, dieselSpread: 0.85 },
  { stateCode: "CA", stateName: "California", regularSpread: 1.40, premiumSpread: 1.75, dieselSpread: 1.30 },
  { stateCode: "CO", stateName: "Colorado", regularSpread: 1.00, premiumSpread: 1.35, dieselSpread: 0.90 },
  { stateCode: "CT", stateName: "Connecticut", regularSpread: 1.10, premiumSpread: 1.45, dieselSpread: 1.00 },
  { stateCode: "DE", stateName: "Delaware", regularSpread: 0.95, premiumSpread: 1.30, dieselSpread: 0.85 },
  { stateCode: "DC", stateName: "District of Columbia", regularSpread: 1.05, premiumSpread: 1.40, dieselSpread: 0.95 },
  { stateCode: "FL", stateName: "Florida", regularSpread: 1.00, premiumSpread: 1.35, dieselSpread: 0.90 },
  { stateCode: "GA", stateName: "Georgia", regularSpread: 0.95, premiumSpread: 1.30, dieselSpread: 0.85 },
  { stateCode: "HI", stateName: "Hawaii", regularSpread: 1.45, premiumSpread: 1.80, dieselSpread: 1.35 },
  { stateCode: "ID", stateName: "Idaho", regularSpread: 1.00, premiumSpread: 1.35, dieselSpread: 0.90 },
  { stateCode: "IL", stateName: "Illinois", regularSpread: 1.10, premiumSpread: 1.45, dieselSpread: 1.00 },
  { stateCode: "IN", stateName: "Indiana", regularSpread: 0.95, premiumSpread: 1.30, dieselSpread: 0.85 },
  { stateCode: "IA", stateName: "Iowa", regularSpread: 0.90, premiumSpread: 1.25, dieselSpread: 0.85 },
  { stateCode: "KS", stateName: "Kansas", regularSpread: 0.90, premiumSpread: 1.25, dieselSpread: 0.85 },
  { stateCode: "KY", stateName: "Kentucky", regularSpread: 0.95, premiumSpread: 1.30, dieselSpread: 0.85 },
  { stateCode: "LA", stateName: "Louisiana", regularSpread: 0.85, premiumSpread: 1.20, dieselSpread: 0.80 },
  { stateCode: "ME", stateName: "Maine", regularSpread: 1.05, premiumSpread: 1.40, dieselSpread: 0.95 },
  { stateCode: "MD", stateName: "Maryland", regularSpread: 1.05, premiumSpread: 1.40, dieselSpread: 0.95 },
  { stateCode: "MA", stateName: "Massachusetts", regularSpread: 1.10, premiumSpread: 1.45, dieselSpread: 1.00 },
  { stateCode: "MI", stateName: "Michigan", regularSpread: 1.00, premiumSpread: 1.35, dieselSpread: 0.90 },
  { stateCode: "MN", stateName: "Minnesota", regularSpread: 1.00, premiumSpread: 1.35, dieselSpread: 0.90 },
  { stateCode: "MS", stateName: "Mississippi", regularSpread: 0.90, premiumSpread: 1.25, dieselSpread: 0.85 },
  { stateCode: "MO", stateName: "Missouri", regularSpread: 0.85, premiumSpread: 1.20, dieselSpread: 0.80 },
  { stateCode: "MT", stateName: "Montana", regularSpread: 0.95, premiumSpread: 1.30, dieselSpread: 0.85 },
  { stateCode: "NE", stateName: "Nebraska", regularSpread: 0.95, premiumSpread: 1.30, dieselSpread: 0.85 },
  { stateCode: "NV", stateName: "Nevada", regularSpread: 1.05, premiumSpread: 1.40, dieselSpread: 0.95 },
  { stateCode: "NH", stateName: "New Hampshire", regularSpread: 0.95, premiumSpread: 1.30, dieselSpread: 0.85 },
  { stateCode: "NJ", stateName: "New Jersey", regularSpread: 1.10, premiumSpread: 1.45, dieselSpread: 1.00 },
  { stateCode: "NM", stateName: "New Mexico", regularSpread: 0.95, premiumSpread: 1.30, dieselSpread: 0.85 },
  { stateCode: "NY", stateName: "New York", regularSpread: 1.20, premiumSpread: 1.55, dieselSpread: 1.10 },
  { stateCode: "NC", stateName: "North Carolina", regularSpread: 1.00, premiumSpread: 1.35, dieselSpread: 0.90 },
  { stateCode: "ND", stateName: "North Dakota", regularSpread: 0.95, premiumSpread: 1.30, dieselSpread: 0.85 },
  { stateCode: "OH", stateName: "Ohio", regularSpread: 1.05, premiumSpread: 1.40, dieselSpread: 0.90 },
  { stateCode: "OK", stateName: "Oklahoma", regularSpread: 0.85, premiumSpread: 1.20, dieselSpread: 0.80 },
  { stateCode: "OR", stateName: "Oregon", regularSpread: 1.15, premiumSpread: 1.50, dieselSpread: 1.05 },
  { stateCode: "PA", stateName: "Pennsylvania", regularSpread: 1.15, premiumSpread: 1.50, dieselSpread: 1.05 },
  { stateCode: "RI", stateName: "Rhode Island", regularSpread: 1.05, premiumSpread: 1.40, dieselSpread: 0.95 },
  { stateCode: "SC", stateName: "South Carolina", regularSpread: 0.90, premiumSpread: 1.25, dieselSpread: 0.85 },
  { stateCode: "SD", stateName: "South Dakota", regularSpread: 0.90, premiumSpread: 1.25, dieselSpread: 0.85 },
  { stateCode: "TN", stateName: "Tennessee", regularSpread: 0.95, premiumSpread: 1.30, dieselSpread: 0.85 },
  { stateCode: "TX", stateName: "Texas", regularSpread: 0.85, premiumSpread: 1.20, dieselSpread: 0.80 },
  { stateCode: "UT", stateName: "Utah", regularSpread: 0.95, premiumSpread: 1.30, dieselSpread: 0.85 },
  { stateCode: "VT", stateName: "Vermont", regularSpread: 1.00, premiumSpread: 1.35, dieselSpread: 0.90 },
  { stateCode: "VA", stateName: "Virginia", regularSpread: 1.00, premiumSpread: 1.35, dieselSpread: 0.90 },
  { stateCode: "WA", stateName: "Washington", regularSpread: 1.25, premiumSpread: 1.60, dieselSpread: 1.15 },
  { stateCode: "WV", stateName: "West Virginia", regularSpread: 1.00, premiumSpread: 1.35, dieselSpread: 0.90 },
  { stateCode: "WI", stateName: "Wisconsin", regularSpread: 1.00, premiumSpread: 1.35, dieselSpread: 0.90 },
  { stateCode: "WY", stateName: "Wyoming", regularSpread: 0.90, premiumSpread: 1.25, dieselSpread: 0.85 },
];

/**
 * Round DOWN to the nearest CME strike increment ($0.05).
 *
 * WHY: Rounding down means our hedge triggers at a lower RBOB price,
 * giving us slightly more protection than needed. Rounding up would
 * leave a gap where the member is owed rebates but our hedge hasn't
 * kicked in yet.
 */
export function roundDownToStrikeIncrement(price: number): number {
  // WHY: Multiply by 100 first to avoid floating-point errors.
  // 3.80 / 0.05 = 75.999... in IEEE 754, but (380 / 5) = 76 exactly.
  const cents = Math.round(price * 100);
  const incrementCents = CME_STRIKE_INCREMENT * 100; // 5
  return (Math.floor(cents / incrementCents) * incrementCents) / 100;
}

/**
 * Get the retail spread for a state and fuel type.
 *
 * WHY: First checks the database (admin-editable), then falls back
 * to the hardcoded defaults. This lets the admin update spreads via
 * the Settings page without a code deploy.
 */
export async function getStateSpread(
  stateCode: string,
  fuelType: string = "Regular"
): Promise<number> {
  // Try database first
  const dbSpread = await prisma.stateSpread.findUnique({
    where: { stateCode: stateCode.toUpperCase() },
  });

  if (dbSpread) {
    switch (fuelType) {
      case "Premium": return dbSpread.premiumSpread;
      case "Diesel": return dbSpread.dieselSpread;
      default: return dbSpread.regularSpread;
    }
  }

  // Fall back to defaults
  const defaultSpread = DEFAULT_STATE_SPREADS.find(
    (s) => s.stateCode === stateCode.toUpperCase()
  );

  if (defaultSpread) {
    switch (fuelType) {
      case "Premium": return defaultSpread.premiumSpread;
      case "Diesel": return defaultSpread.dieselSpread;
      default: return defaultSpread.regularSpread;
    }
  }

  // WHY: If state not found, use a conservative national average.
  // $1.00 for Regular is roughly the median across all states.
  return fuelType === "Premium" ? 1.35 : fuelType === "Diesel" ? 0.90 : 1.00;
}

/**
 * Convert a member's retail max price to a CME hedge strike.
 *
 * hedge_strike = member_max_price - state_retail_spread
 * then rounded DOWN to nearest $0.05
 *
 * @returns The CME option strike price and the instrument to hedge with
 */
export async function getHedgeStrike(
  memberMaxPrice: number,
  stateCode: string,
  fuelType: string = "Regular"
): Promise<{
  hedgeStrike: number;
  instrument: "RBOB" | "HO";
  spread: number;
}> {
  const spread = await getStateSpread(stateCode, fuelType);
  const rawStrike = memberMaxPrice - spread;

  // WHY: Diesel hedges against Heating Oil (HO) futures, not RBOB.
  // Regular and Premium both hedge against RBOB.
  const instrument = fuelType === "Diesel" ? "HO" : "RBOB";

  return {
    hedgeStrike: roundDownToStrikeIncrement(rawStrike),
    instrument,
    spread,
  };
}

/**
 * Seed the StateSpread table with default values.
 * WHY: Called from admin settings or a setup script. Only inserts
 * states that don't already exist, preserving admin edits.
 */
export async function seedStateSpreads(): Promise<number> {
  let inserted = 0;
  for (const spread of DEFAULT_STATE_SPREADS) {
    const existing = await prisma.stateSpread.findUnique({
      where: { stateCode: spread.stateCode },
    });
    if (!existing) {
      await prisma.stateSpread.create({ data: spread });
      inserted++;
    }
  }
  return inserted;
}
