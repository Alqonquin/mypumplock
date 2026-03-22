/**
 * Yahoo Finance API — RBOB & HO Futures Data
 *
 * Fetches historical and current NYMEX RBOB gasoline (RB=F) and
 * heating oil (HO=F) futures prices from Yahoo Finance.
 *
 * WHY Yahoo Finance: Free, no API key required, provides daily OHLCV
 * for NYMEX futures. 15-min delayed for current prices, but daily
 * settlement data is accurate. Good enough for simulation backtesting;
 * upgrade to Databento or CME for live hedging later.
 *
 * Tickers:
 *   RB=F — RBOB Gasoline Futures (front month, NYMEX)
 *   HO=F — Heating Oil Futures (front month, NYMEX)
 */

// --- Types ---

export interface FuturesDayData {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number; // Settlement price
  volume: number;
}

export interface FuturesTimeSeries {
  instrument: "RBOB" | "HO";
  ticker: string;
  days: FuturesDayData[];
  latestPrice: number;
  fetchedAt: Date;
}

// --- Cache ---

// WHY: 15-min cache for real-time pricing. Historical data changes less
// often but we cache it the same way for simplicity.
const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheEntry {
  data: FuturesTimeSeries;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

// --- Yahoo Finance API ---

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number;
        symbol: string;
      };
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          close: (number | null)[];
          volume: (number | null)[];
        }>;
      };
    }>;
    error: unknown;
  };
}

/**
 * Fetch OHLCV data for a futures ticker from Yahoo Finance.
 *
 * @param ticker  Yahoo Finance ticker (e.g., "RB=F", "HO=F")
 * @param range   Time range: "1mo", "3mo", "6mo", "1y"
 * @param interval  Data interval: "1d", "1wk", "1mo"
 */
async function fetchYahooChart(
  ticker: string,
  range = "3mo",
  interval = "1d"
): Promise<FuturesDayData[]> {
  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;

  // WHY: 15s timeout prevents the simulation from hanging indefinitely
  // if Yahoo Finance is slow or blocked. AbortSignal.timeout is supported
  // in Node 18+ and all modern browsers.
  const res = await fetch(url, {
    headers: {
      // WHY: User-Agent required or Yahoo returns 403
      "User-Agent": "Mozilla/5.0 (compatible; PumpLock/1.0)",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance API error: ${res.status} ${res.statusText}`);
  }

  const json: YahooChartResponse = await res.json();

  if (json.chart.error) {
    throw new Error(`Yahoo Finance API error: ${JSON.stringify(json.chart.error)}`);
  }

  const result = json.chart.result?.[0];
  if (!result || !result.timestamp) {
    throw new Error("No data returned from Yahoo Finance");
  }

  const { timestamp, indicators } = result;
  const quote = indicators.quote[0];
  const days: FuturesDayData[] = [];

  for (let i = 0; i < timestamp.length; i++) {
    const open = quote.open[i];
    const high = quote.high[i];
    const low = quote.low[i];
    const close = quote.close[i];
    const volume = quote.volume[i];

    // WHY: Skip days with null values (holidays, missing data)
    if (open == null || high == null || low == null || close == null) continue;

    const date = new Date(timestamp[i] * 1000);
    days.push({
      date,
      dateStr: date.toISOString().slice(0, 10),
      open: round4(open),
      high: round4(high),
      low: round4(low),
      close: round4(close),
      volume: volume ?? 0,
    });
  }

  return days;
}

// --- Public API ---

/**
 * Get RBOB Gasoline Futures historical data.
 * Returns ~60 trading days of daily OHLCV.
 */
export async function fetchRBOB(range = "3mo"): Promise<FuturesTimeSeries> {
  const cacheKey = `RBOB:${range}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const days = await fetchYahooChart("RB=F", range);
  const data: FuturesTimeSeries = {
    instrument: "RBOB",
    ticker: "RB=F",
    days,
    latestPrice: days.length > 0 ? days[days.length - 1].close : 0,
    fetchedAt: new Date(),
  };

  cache.set(cacheKey, { data, fetchedAt: Date.now() });
  return data;
}

/**
 * Get Heating Oil Futures historical data.
 * Returns ~60 trading days of daily OHLCV.
 */
export async function fetchHO(range = "3mo"): Promise<FuturesTimeSeries> {
  const cacheKey = `HO:${range}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const days = await fetchYahooChart("HO=F", range);
  const data: FuturesTimeSeries = {
    instrument: "HO",
    ticker: "HO=F",
    days,
    latestPrice: days.length > 0 ? days[days.length - 1].close : 0,
    fetchedAt: new Date(),
  };

  cache.set(cacheKey, { data, fetchedAt: Date.now() });
  return data;
}

/**
 * Get both RBOB and HO data in parallel.
 */
export async function fetchAllFutures(range = "3mo"): Promise<{
  rbob: FuturesTimeSeries;
  ho: FuturesTimeSeries;
}> {
  const [rbob, ho] = await Promise.all([fetchRBOB(range), fetchHO(range)]);
  return { rbob, ho };
}

/**
 * Get just the latest prices for both instruments (uses cache).
 */
export async function getLatestFuturesPrices(): Promise<{
  rbob: number;
  ho: number;
  fetchedAt: Date;
}> {
  const { rbob, ho } = await fetchAllFutures();
  return {
    rbob: rbob.latestPrice,
    ho: ho.latestPrice,
    fetchedAt: rbob.fetchedAt,
  };
}

/**
 * Clear the cache (e.g., when you need a fresh fetch).
 */
export function clearFuturesCache(): void {
  cache.clear();
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
