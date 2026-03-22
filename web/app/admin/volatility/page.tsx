"use client";

import { useEffect, useState, useCallback } from "react";

interface VolData {
  effectiveVol: number;
  configVol: number;
  realtimeVol: number;
  hoRealtimeVol: number;
  regime: "CALM" | "NORMAL" | "ELEVATED" | "CRISIS";
  hoRegime: "CALM" | "NORMAL" | "ELEVATED" | "CRISIS";
  overrideActive: boolean;
  recentMove: number;
  hoRecentMove: number;
  computedAt: string;
  dataPoints: number;
  hoDataPoints: number;
  priceHistory: { date: string; close: number }[];
  hoPriceHistory: { date: string; close: number }[];
  impacts: {
    vol: number;
    fromPrice: number;
    toPrice: number;
    diff: number;
    pctChange: number;
  }[];
}

const REGIME_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  CALM: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Calm" },
  NORMAL: { bg: "bg-blue-100", text: "text-blue-700", label: "Normal" },
  ELEVATED: { bg: "bg-amber-100", text: "text-amber-700", label: "Elevated" },
  CRISIS: { bg: "bg-red-100", text: "text-red-700", label: "Crisis" },
};

function SparkLine({
  data,
  height = 120,
  color = "#10b981",
}: {
  data: number[];
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const width = 600;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * w;
      const y = pad + h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <polyline fill="none" stroke={color} strokeWidth={2} points={points} />
    </svg>
  );
}

export default function VolatilityPage() {
  const [data, setData] = useState<VolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/volatility")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchData();
    // WHY: Auto-refresh every 60 seconds to keep the dashboard current.
    // The vol-monitor has its own 15-min cache so this won't hammer Yahoo.
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function forceRefresh() {
    setRefreshing(true);
    try {
      await fetch("/api/admin/volatility", { method: "POST" });
      await fetchData();
    } catch {
      // fetchData will handle the error
    }
    setRefreshing(false);
  }

  if (loading && !data) {
    return <div className="text-gray-400 py-12 text-center">Loading volatility data...</div>;
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const regimeStyle = REGIME_STYLES[data.regime] || REGIME_STYLES.NORMAL;
  const hoRegimeStyle = REGIME_STYLES[data.hoRegime] || REGIME_STYLES.NORMAL;
  const prices = data.priceHistory.map((p) => p.close);
  const hoPrices = (data.hoPriceHistory || []).map((p) => p.close);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Volatility Monitor</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time RBOB & HO futures volatility — auto-adjusts member pricing when markets move
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Updated {new Date(data.computedAt).toLocaleTimeString()}
          </span>
          <button
            onClick={forceRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
          >
            {refreshing && (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Refresh Now
          </button>
        </div>
      </div>

      {/* Override Alert */}
      {data.overrideActive && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Real-time vol override active.</span>{" "}
            Market volatility ({(data.effectiveVol * 100).toFixed(0)}%) differs from your config ({(data.configVol * 100).toFixed(0)}%).
            All member quotes are using the real-time rate.
          </p>
        </div>
      )}

      {/* Top Cards — Row 1: Overall + Config */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 mb-1">Effective Vol</p>
          <p className="text-2xl font-bold text-gray-900">{(data.effectiveVol * 100).toFixed(0)}%</p>
          <p className="text-xs text-gray-400">Max of RBOB & HO — used for all quotes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 mb-1">Config Vol (floor)</p>
          <p className="text-2xl font-bold text-gray-900">{(data.configVol * 100).toFixed(0)}%</p>
          <p className="text-xs text-gray-400">Set in Pricing</p>
        </div>
        <div className={`rounded-xl border p-5 ${data.overrideActive ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}>
          <p className="text-xs font-medium text-gray-500 mb-1">Override</p>
          <p className={`text-2xl font-bold ${data.overrideActive ? "text-amber-600" : "text-emerald-600"}`}>
            {data.overrideActive ? "Active" : "Inactive"}
          </p>
          <p className="text-xs text-gray-400">
            {data.overrideActive ? "Real-time vol exceeds config" : "Config vol is being used"}
          </p>
        </div>
      </div>

      {/* Row 2: RBOB vs HO side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* RBOB */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">RBOB Gasoline</h3>
              <p className="text-xs text-gray-400">Regular & Premium fuel hedge</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${regimeStyle.bg} ${regimeStyle.text}`}>
              {regimeStyle.label}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-gray-400">Realized Vol</p>
              <p className="text-lg font-bold text-gray-900">{(data.realtimeVol * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Latest Move</p>
              <p className={`text-lg font-bold ${data.recentMove >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                {data.recentMove >= 0 ? "+" : ""}{(data.recentMove * 100).toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Data Points</p>
              <p className="text-lg font-bold text-gray-900">{data.dataPoints}</p>
            </div>
          </div>
        </div>

        {/* HO */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Heating Oil (HO)</h3>
              <p className="text-xs text-gray-400">Diesel fuel hedge</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${hoRegimeStyle.bg} ${hoRegimeStyle.text}`}>
              {hoRegimeStyle.label}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-gray-400">Realized Vol</p>
              <p className="text-lg font-bold text-gray-900">{((data.hoRealtimeVol ?? 0) * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Latest Move</p>
              <p className={`text-lg font-bold ${(data.hoRecentMove ?? 0) >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                {(data.hoRecentMove ?? 0) >= 0 ? "+" : ""}{((data.hoRecentMove ?? 0) * 100).toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Data Points</p>
              <p className="text-lg font-bold text-gray-900">{data.hoDataPoints ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Price Charts — RBOB & HO side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">RBOB Futures (RB=F)</h3>
          <p className="text-xs text-gray-400 mb-3">
            NYMEX settlement — {data.priceHistory.length} trading days
          </p>
          {prices.length > 1 ? (
            <>
              <SparkLine data={prices} color="#f59e0b" height={120} />
              <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
                <span>{data.priceHistory[0]?.date}</span>
                <span>Latest: ${prices[prices.length - 1]?.toFixed(4)}/gal</span>
                <span>{data.priceHistory[data.priceHistory.length - 1]?.date}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No data available</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Heating Oil Futures (HO=F)</h3>
          <p className="text-xs text-gray-400 mb-3">
            NYMEX settlement — {(data.hoPriceHistory || []).length} trading days
          </p>
          {hoPrices.length > 1 ? (
            <>
              <SparkLine data={hoPrices} color="#3b82f6" height={120} />
              <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
                <span>{data.hoPriceHistory[0]?.date}</span>
                <span>Latest: ${hoPrices[hoPrices.length - 1]?.toFixed(4)}/gal</span>
                <span>{data.hoPriceHistory[data.hoPriceHistory.length - 1]?.date}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No data available</p>
          )}
        </div>
      </div>

      {/* Regime Scale */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Volatility Regime Scale</h3>
        <div className="relative h-8 rounded-full overflow-hidden bg-gray-100 mb-3">
          {/* Colored segments */}
          <div className="absolute inset-y-0 left-0 w-[25%] bg-emerald-200" />
          <div className="absolute inset-y-0 left-[25%] w-[25%] bg-blue-200" />
          <div className="absolute inset-y-0 left-[50%] w-[30%] bg-amber-200" />
          <div className="absolute inset-y-0 left-[80%] w-[20%] bg-red-200" />
          {/* Marker */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-gray-900 rounded-full"
            style={{ left: `${Math.min(100, (data.effectiveVol / 1.2) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>Calm (0–25%)</span>
          <span>Normal (25–50%)</span>
          <span>Elevated (50–80%)</span>
          <span>Crisis (80%+)</span>
        </div>
      </div>

      {/* Impact Preview Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">
            Pricing Impact Preview
          </h3>
          <p className="text-xs text-gray-400">
            Typical 90-day, 65 gal/mo membership with $0.50 buffer above spot
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-5 py-2.5">Volatility</th>
              <th className="px-5 py-2.5">Regime</th>
              <th className="px-5 py-2.5 text-right">Membership Price</th>
              <th className="px-5 py-2.5 text-right">vs Current Config</th>
              <th className="px-5 py-2.5 text-right">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.impacts.map((impact) => {
              const regime =
                impact.vol >= 0.8 ? "CRISIS" :
                impact.vol >= 0.5 ? "ELEVATED" :
                impact.vol >= 0.25 ? "NORMAL" : "CALM";
              const rs = REGIME_STYLES[regime];
              const isActive = Math.abs(impact.vol - data.effectiveVol) < 0.01;
              return (
                <tr key={impact.vol} className={isActive ? "bg-emerald-50/50" : ""}>
                  <td className="px-5 py-2.5 font-medium text-gray-900">
                    {(impact.vol * 100).toFixed(0)}%
                    {isActive && (
                      <span className="ml-2 text-xs text-emerald-600 font-normal">(current)</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rs.bg} ${rs.text}`}>
                      {rs.label}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono text-gray-700">
                    ${impact.toPrice.toFixed(2)}
                  </td>
                  <td className={`px-5 py-2.5 text-right font-mono ${impact.diff >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {impact.diff >= 0 ? "+" : ""}${impact.diff.toFixed(2)}
                  </td>
                  <td className={`px-5 py-2.5 text-right ${impact.pctChange >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {impact.pctChange >= 0 ? "+" : ""}{impact.pctChange.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* How it works */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">How It Works</h3>
        <div className="text-xs text-gray-500 space-y-1">
          <p>1. Every 15 minutes, we fetch the latest RBOB and HO futures prices from Yahoo Finance (NYMEX RB=F and HO=F).</p>
          <p>2. We compute realized volatility for both instruments from the last 60+ trading days of settlement prices.</p>
          <p>3. If the latest price is a big move from the 5-day average, we boost the vol estimate to reflect the shock.</p>
          <p>4. The effective vol is <strong>max(RBOB vol, HO vol)</strong> — if either market spikes, pricing adjusts.</p>
          <p>5. WHY both: Diesel (HO) can spike independently from gasoline — winter heating demand, refinery outages, or supply disruptions. RBOB-only monitoring misses diesel-specific risk.</p>
        </div>
      </div>
    </div>
  );
}
