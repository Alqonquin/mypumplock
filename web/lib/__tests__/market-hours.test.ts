/**
 * Tests for CME Globex market hours detection and after-hours buffer.
 */

import { describe, test, expect } from "vitest";
import { isMarketOpen, getHoursSinceClose, getAfterHoursBuffer, getBufferedSpotPrice, getMarketStatus } from "../market-hours";

// WHY: Helper to create a Date in Eastern Time without timezone library.
// Uses UTC offset (ET = UTC-5 in EST, UTC-4 in EDT). March 22, 2026 is EDT (UTC-4).
function edtDate(year: number, month: number, day: number, hour: number, minute: number = 0): Date {
  // EDT = UTC-4
  return new Date(Date.UTC(year, month - 1, day, hour + 4, minute));
}

function estDate(year: number, month: number, day: number, hour: number, minute: number = 0): Date {
  // EST = UTC-5
  return new Date(Date.UTC(year, month - 1, day, hour + 5, minute));
}

describe("isMarketOpen", () => {
  test("Monday midday is open", () => {
    // Monday March 23, 2026 at 12:00 PM ET (EDT)
    expect(isMarketOpen(edtDate(2026, 3, 23, 12, 0))).toBe(true);
  });

  test("Wednesday 3 AM is open (Globex overnight)", () => {
    // Wednesday March 25, 2026 at 3:00 AM ET
    expect(isMarketOpen(edtDate(2026, 3, 25, 3, 0))).toBe(true);
  });

  test("Tuesday 5:30 PM is closed (maintenance break)", () => {
    // Tuesday March 24, 2026 at 5:30 PM ET
    expect(isMarketOpen(edtDate(2026, 3, 24, 17, 30))).toBe(false);
  });

  test("Tuesday 6:00 PM is open (maintenance break ended)", () => {
    // Tuesday March 24, 2026 at 6:00 PM ET
    expect(isMarketOpen(edtDate(2026, 3, 24, 18, 0))).toBe(true);
  });

  test("Friday 4:59 PM is open", () => {
    // Friday March 27, 2026 at 4:59 PM ET
    expect(isMarketOpen(edtDate(2026, 3, 27, 16, 59))).toBe(true);
  });

  test("Friday 5:00 PM is closed (weekend begins)", () => {
    // Friday March 27, 2026 at 5:00 PM ET
    expect(isMarketOpen(edtDate(2026, 3, 27, 17, 0))).toBe(false);
  });

  test("Saturday is always closed", () => {
    // Saturday March 28, 2026 at 12:00 PM ET
    expect(isMarketOpen(edtDate(2026, 3, 28, 12, 0))).toBe(false);
  });

  test("Sunday before 6 PM is closed", () => {
    // Sunday March 22, 2026 at 8:00 AM ET
    expect(isMarketOpen(edtDate(2026, 3, 22, 8, 0))).toBe(false);
  });

  test("Sunday at 6 PM is open", () => {
    // Sunday March 22, 2026 at 6:00 PM ET
    expect(isMarketOpen(edtDate(2026, 3, 22, 18, 0))).toBe(true);
  });

  test("New Year's Day 2026 is closed (holiday)", () => {
    // January 1, 2026 at 12:00 PM ET (EST)
    expect(isMarketOpen(estDate(2026, 1, 1, 12, 0))).toBe(false);
  });

  test("Christmas 2026 is closed (holiday)", () => {
    // December 25, 2026 at 10:00 AM ET (EST)
    expect(isMarketOpen(estDate(2026, 12, 25, 10, 0))).toBe(false);
  });
});

describe("getHoursSinceClose", () => {
  test("returns 0 when market is open", () => {
    // Monday midday
    expect(getHoursSinceClose(edtDate(2026, 3, 23, 12, 0))).toBe(0);
  });

  test("returns positive hours during weekend", () => {
    // Saturday noon = ~19 hours after Friday 5 PM close
    const hours = getHoursSinceClose(edtDate(2026, 3, 28, 12, 0));
    expect(hours).toBeGreaterThan(18);
    expect(hours).toBeLessThan(20);
  });

  test("returns small number during daily maintenance", () => {
    // Tuesday 5:30 PM = 0.5 hours after 5 PM close
    const hours = getHoursSinceClose(edtDate(2026, 3, 24, 17, 30));
    expect(hours).toBeGreaterThan(0.3);
    expect(hours).toBeLessThan(1);
  });
});

describe("getAfterHoursBuffer", () => {
  test("returns 0 when market is open", () => {
    expect(getAfterHoursBuffer(0.03, edtDate(2026, 3, 23, 12, 0))).toBe(0);
  });

  test("returns positive buffer during weekend", () => {
    // Sunday morning, ~42 hours after Friday close
    const buffer = getAfterHoursBuffer(0.03, edtDate(2026, 3, 22, 11, 0));
    expect(buffer).toBeGreaterThan(0.02);
    expect(buffer).toBeLessThan(0.06);
  });

  test("scales with square root of time", () => {
    // Saturday morning (~14h) vs Sunday morning (~38h)
    const satBuffer = getAfterHoursBuffer(0.03, edtDate(2026, 3, 28, 7, 0));
    const sunBuffer = getAfterHoursBuffer(0.03, edtDate(2026, 3, 22, 7, 0));
    // Sunday buffer should be larger but not proportionally to time
    expect(sunBuffer).toBeGreaterThan(satBuffer);
    // sqrt scaling: ratio should be closer to sqrt(38/14) ≈ 1.65 than 38/14 ≈ 2.7
    const ratio = sunBuffer / satBuffer;
    expect(ratio).toBeGreaterThan(1.2);
    expect(ratio).toBeLessThan(2.0);
  });

  test("scales with base rate", () => {
    const low = getAfterHoursBuffer(0.02, edtDate(2026, 3, 22, 11, 0));
    const high = getAfterHoursBuffer(0.05, edtDate(2026, 3, 22, 11, 0));
    expect(high / low).toBeCloseTo(0.05 / 0.02, 1);
  });
});

describe("getBufferedSpotPrice", () => {
  test("returns unchanged price when market is open", () => {
    expect(getBufferedSpotPrice(3.23, 0.03, edtDate(2026, 3, 23, 12, 0))).toBe(3.23);
  });

  test("inflates price when market is closed", () => {
    const buffered = getBufferedSpotPrice(3.23, 0.03, edtDate(2026, 3, 22, 11, 0));
    expect(buffered).toBeGreaterThan(3.23);
    expect(buffered).toBeLessThan(3.50); // Sanity: no more than ~8% buffer
  });
});

describe("getMarketStatus", () => {
  test("reports open during trading hours", () => {
    const status = getMarketStatus(edtDate(2026, 3, 23, 12, 0));
    expect(status.isOpen).toBe(true);
    expect(status.hoursSinceClose).toBe(0);
    expect(status.currentBuffer).toBe(0);
  });

  test("reports closed during weekend with next open time", () => {
    const status = getMarketStatus(edtDate(2026, 3, 28, 12, 0));
    expect(status.isOpen).toBe(false);
    expect(status.hoursSinceClose).toBeGreaterThan(0);
    expect(status.currentBuffer).toBeGreaterThan(0);
    expect(status.nextOpen).toContain("Sunday");
  });
});
