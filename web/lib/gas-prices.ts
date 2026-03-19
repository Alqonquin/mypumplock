/**
 * Local gas price lookup by city/state/metro.
 * In production, would use GasBuddy API, AAA, or EIA real-time data.
 */

export interface LocalPriceResult {
  price: number;
  areaName: string;
  source: "metro" | "state" | "national";
}

// WHY: State-level averages from AAA/EIA, approximate March 2026.
const STATE_AVERAGES: Record<string, number> = {
  AL: 2.80, AK: 3.60, AZ: 3.25, AR: 2.75, CA: 4.55,
  CO: 3.05, CT: 3.30, DE: 3.10, FL: 3.10, GA: 2.90,
  HI: 4.70, ID: 3.20, IL: 3.40, IN: 3.10, IA: 2.90,
  KS: 2.85, KY: 2.95, LA: 2.70, ME: 3.20, MD: 3.15,
  MA: 3.25, MI: 3.15, MN: 3.00, MS: 2.70, MO: 2.80,
  MT: 3.15, NE: 2.90, NV: 3.75, NH: 3.15, NJ: 3.10,
  NM: 3.05, NY: 3.40, NC: 2.95, ND: 3.00, OH: 3.05,
  OK: 2.75, OR: 3.70, PA: 3.35, RI: 3.25, SC: 2.85,
  SD: 3.00, TN: 2.85, TX: 2.75, UT: 3.15, VT: 3.25,
  VA: 3.00, WA: 4.00, WV: 3.10, WI: 2.95, WY: 3.15,
  DC: 3.30,
};

// WHY: Metro areas diverge from state averages due to local taxes and competition.
const METRO_AVERAGES: Record<string, number> = {
  "Miami, FL": 3.25, "Fort Lauderdale, FL": 3.20, "Tampa, FL": 3.05,
  "Orlando, FL": 3.10, "Jacksonville, FL": 2.95,
  "New York, NY": 3.55, "Los Angeles, CA": 4.65, "San Francisco, CA": 4.80,
  "Chicago, IL": 3.50, "Houston, TX": 2.70, "Dallas, TX": 2.80,
  "Phoenix, AZ": 3.30, "Philadelphia, PA": 3.40, "San Antonio, TX": 2.75,
  "San Diego, CA": 4.50, "Austin, TX": 2.80, "Denver, CO": 3.10,
  "Seattle, WA": 4.10, "Portland, OR": 3.75, "Atlanta, GA": 2.95,
  "Boston, MA": 3.35, "Nashville, TN": 2.90, "Charlotte, NC": 2.95,
  "Detroit, MI": 3.20, "Minneapolis, MN": 3.05, "Las Vegas, NV": 3.80,
  "Baltimore, MD": 3.20, "Washington, DC": 3.35, "Milwaukee, WI": 3.00,
  "Kansas City, MO": 2.85, "St. Louis, MO": 2.85, "Indianapolis, IN": 3.10,
  "Columbus, OH": 3.10, "Cleveland, OH": 3.10, "Pittsburgh, PA": 3.30,
  "Cincinnati, OH": 3.05, "Salt Lake City, UT": 3.20,
  "San Jose, CA": 4.70, "Sacramento, CA": 4.40,
};

const NATIONAL_AVERAGE = 3.10;

export function lookupPrice(query: string): LocalPriceResult {
  const q = query.trim().toLowerCase();

  // Try metro first
  for (const [name, price] of Object.entries(METRO_AVERAGES)) {
    if (name.toLowerCase().includes(q)) {
      return { price, areaName: name, source: "metro" };
    }
  }

  // Try state code
  const upper = query.trim().toUpperCase();
  if (STATE_AVERAGES[upper]) {
    return { price: STATE_AVERAGES[upper], areaName: upper, source: "state" };
  }

  return { price: NATIONAL_AVERAGE, areaName: "National Average", source: "national" };
}

export function getAllMetros(): string[] {
  return Object.keys(METRO_AVERAGES).sort();
}

export function getAllStates(): string[] {
  return Object.keys(STATE_AVERAGES).sort();
}
