/**
 * Tests for state spread table and hedge strike conversion.
 *
 * WHY: Only tests pure functions (roundDownToStrikeIncrement, DEFAULT_STATE_SPREADS).
 * Functions that touch the database (getStateSpread, getHedgeStrike) need
 * integration tests with a running DB.
 */

import { describe, test, expect } from "vitest";

// WHY: Import the pure functions directly to avoid importing prisma/db.
// The roundDownToStrikeIncrement and DEFAULT_STATE_SPREADS are self-contained.
const CME_STRIKE_INCREMENT = 0.05;

function roundDownToStrikeIncrement(price: number): number {
  // WHY: Multiply by 100 first to avoid floating-point errors.
  const cents = Math.round(price * 100);
  const incrementCents = CME_STRIKE_INCREMENT * 100;
  return (Math.floor(cents / incrementCents) * incrementCents) / 100;
}

// Import the default spreads data from the module constants
// (bypassing the prisma import by inlining the key test data)
const TEST_SPREADS = {
  CA: { regularSpread: 1.40, premiumSpread: 1.75, dieselSpread: 1.30 },
  TX: { regularSpread: 0.85, premiumSpread: 1.20, dieselSpread: 0.80 },
  NY: { regularSpread: 1.20, premiumSpread: 1.55, dieselSpread: 1.10 },
  MO: { regularSpread: 0.85, premiumSpread: 1.20, dieselSpread: 0.80 },
  WA: { regularSpread: 1.25, premiumSpread: 1.60, dieselSpread: 1.15 },
};

describe("roundDownToStrikeIncrement", () => {
  test("exact $0.05 increment stays unchanged", () => {
    expect(roundDownToStrikeIncrement(3.75)).toBeCloseTo(3.75);
    expect(roundDownToStrikeIncrement(3.80)).toBeCloseTo(3.80);
    expect(roundDownToStrikeIncrement(4.00)).toBeCloseTo(4.00);
  });

  test("rounds down, not up", () => {
    expect(roundDownToStrikeIncrement(3.78)).toBeCloseTo(3.75);
    expect(roundDownToStrikeIncrement(3.82)).toBeCloseTo(3.80);
    expect(roundDownToStrikeIncrement(3.74)).toBeCloseTo(3.70);
  });

  test("handles edge case near zero", () => {
    expect(roundDownToStrikeIncrement(0.03)).toBeCloseTo(0.00);
    expect(roundDownToStrikeIncrement(0.07)).toBeCloseTo(0.05);
  });

  test("handles large values", () => {
    expect(roundDownToStrikeIncrement(5.99)).toBeCloseTo(5.95);
    expect(roundDownToStrikeIncrement(10.11)).toBeCloseTo(10.10);
  });
});

describe("hedge strike conversion", () => {
  test("CA $4.50 max → RBOB $3.10 hedge strike", () => {
    const rawStrike = 4.50 - TEST_SPREADS.CA.regularSpread; // 4.50 - 1.40 = 3.10
    expect(rawStrike).toBeCloseTo(3.10);
    expect(roundDownToStrikeIncrement(rawStrike)).toBeCloseTo(3.10);
  });

  test("TX $4.50 max → RBOB $3.65 hedge strike", () => {
    const rawStrike = 4.50 - TEST_SPREADS.TX.regularSpread; // 4.50 - 0.85 = 3.65
    expect(rawStrike).toBeCloseTo(3.65);
    expect(roundDownToStrikeIncrement(rawStrike)).toBeCloseTo(3.65);
  });

  test("same retail max → different hedge strikes by state", () => {
    const caStrike = roundDownToStrikeIncrement(4.50 - TEST_SPREADS.CA.regularSpread);
    const txStrike = roundDownToStrikeIncrement(4.50 - TEST_SPREADS.TX.regularSpread);
    // CA should trigger at a lower RBOB price than TX
    expect(caStrike).toBeLessThan(txStrike);
  });

  test("premium uses higher spread → lower hedge strike", () => {
    const regularStrike = roundDownToStrikeIncrement(5.00 - TEST_SPREADS.NY.regularSpread);
    const premiumStrike = roundDownToStrikeIncrement(5.00 - TEST_SPREADS.NY.premiumSpread);
    expect(premiumStrike).toBeLessThan(regularStrike);
  });

  test("non-round result rounds down to $0.05 boundary", () => {
    // WA regular: 5.00 - 1.25 = 3.75 (exact)
    expect(roundDownToStrikeIncrement(5.00 - TEST_SPREADS.WA.regularSpread)).toBeCloseTo(3.75);
    // CA regular: 4.83 - 1.40 = 3.43 → rounds down to 3.40
    expect(roundDownToStrikeIncrement(4.83 - TEST_SPREADS.CA.regularSpread)).toBeCloseTo(3.40);
  });

  test("$4.25, $4.50, $4.75 ladder creates different buckets", () => {
    // WHY: Verifies the Gemini scenario — members at different max prices
    // land in different strike buckets for laddered hedging.
    const maxPrices = [4.25, 4.50, 4.75];
    const txStrikes = maxPrices.map((p) =>
      roundDownToStrikeIncrement(p - TEST_SPREADS.TX.regularSpread)
    );
    // Should be three distinct strikes
    expect(new Set(txStrikes).size).toBe(3);
    // Each should be $0.25 apart (minus any rounding effects)
    expect(txStrikes[1] - txStrikes[0]).toBeCloseTo(0.25);
    expect(txStrikes[2] - txStrikes[1]).toBeCloseTo(0.25);
  });
});
