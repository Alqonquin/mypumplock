/**
 * Treasury Rate Auto-Fetcher
 *
 * Fetches the current U.S. Treasury Bill rate from the Treasury
 * Fiscal Data API and uses it as the risk-free rate for pricing.
 *
 * WHY: The risk-free rate in Black-Scholes should track actual
 * Treasury yields. A stale 4.5% assumption when T-Bills are at
 * 3.7% means we're overpricing memberships.
 *
 * Source: https://fiscaldata.treasury.gov
 * Endpoint: Average Interest Rates on U.S. Treasury Securities
 * Updates: Monthly (we cache for 24 hours)
 */

// WHY: 24-hour cache. T-Bill rates move slowly (monthly updates from
// Treasury). Checking once per day is more than sufficient.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface RateCache {
  rate: number;
  source: string;
  asOfDate: string;
  fetchedAt: number;
}

let cached: RateCache | null = null;

// WHY: 4.5% is a reasonable fallback if the Treasury API is down.
// Better to price slightly high than to fail entirely.
const FALLBACK_RATE = 0.045;

const TREASURY_API_URL =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates";

interface TreasuryApiResponse {
  data: Array<{
    record_date: string;
    security_desc: string;
    avg_interest_rate_amt: string;
  }>;
}

/**
 * Fetch the current risk-free rate from the Treasury Fiscal Data API.
 *
 * Uses the average T-Bill rate as the risk-free rate proxy.
 * WHY T-Bills: They're the standard risk-free rate benchmark in
 * options pricing — short-term, government-backed, highly liquid.
 */
export async function getRiskFreeRate(): Promise<{
  rate: number;
  source: string;
  asOfDate: string;
}> {
  // Return cache if fresh
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { rate: cached.rate, source: cached.source, asOfDate: cached.asOfDate };
  }

  try {
    const params = new URLSearchParams({
      sort: "-record_date",
      "filter": "security_desc:eq:Treasury Bills",
      "page[size]": "1",
    });

    const res = await fetch(`${TREASURY_API_URL}?${params}`, {
      headers: { "User-Agent": "PumpLock/1.0" },
    });

    if (!res.ok) {
      throw new Error(`Treasury API returned ${res.status}`);
    }

    const json: TreasuryApiResponse = await res.json();
    const record = json.data?.[0];

    if (!record) {
      throw new Error("No T-Bill rate data returned");
    }

    const ratePercent = parseFloat(record.avg_interest_rate_amt);
    if (isNaN(ratePercent) || ratePercent <= 0) {
      throw new Error(`Invalid rate: ${record.avg_interest_rate_amt}`);
    }

    // WHY: API returns percentage (e.g., 3.72), we need decimal (0.0372)
    const rate = Math.round((ratePercent / 100) * 10000) / 10000;
    const asOfDate = record.record_date;

    cached = {
      rate,
      source: "U.S. Treasury Fiscal Data API",
      asOfDate,
      fetchedAt: Date.now(),
    };

    console.log(`[TREASURY-RATE] T-Bill rate: ${ratePercent}% (${asOfDate})`);

    return { rate, source: cached.source, asOfDate };
  } catch (err) {
    console.error("[TREASURY-RATE] Failed to fetch, using fallback:", (err as Error).message);

    // Return cached value if available (even if stale), otherwise fallback
    if (cached) {
      return { rate: cached.rate, source: `${cached.source} (stale)`, asOfDate: cached.asOfDate };
    }

    return { rate: FALLBACK_RATE, source: "Fallback default", asOfDate: "N/A" };
  }
}

/**
 * Clear the rate cache (e.g., for testing or forced refresh).
 */
export function clearRateCache(): void {
  cached = null;
}
