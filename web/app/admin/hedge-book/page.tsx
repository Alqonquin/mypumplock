"use client";

import { useEffect, useState, useCallback } from "react";

// --- Types ---

interface Snapshot {
  date: string;
  model: string;
  dayNumber: number;
  totalMembers: number;
  newMembersToday: number;
  totalGallonsCovered: number;
  totalPremiumCollected: number;
  totalHedgeCost: number;
  hedgePositionCount: number;
  totalContractsOpen: number;
  hedgeMtmValue: number;
  netPnl: number;
  realizedPnl: number;
  rebatesPaid: number;
  openLiability: number;
  projectedLiability: number;
  rbobPrice: number;
  hoPrice: number;
  portfolioDelta: number;
  portfolioGamma: number;
  portfolioVega: number;
  portfolioTheta: number;
}

interface FuturesPrice {
  date: string;
  instrument: string;
  settle: number;
  high: number;
  low: number;
}

interface Position {
  id: string;
  model: string;
  openDate: string;
  closeDate: string | null;
  instrument: string;
  strikePrice: number;
  expiryDate: string;
  contracts: number;
  contractSize: number;
  premiumPerUnit: number;
  totalPremium: number;
  currentValue: number;
  isOpen: boolean;
}

interface DashboardData {
  latestSnapshot: Snapshot | null;
  snapshots: Snapshot[];
  futuresPrices: FuturesPrice[];
  openPositions: Position[];
  allPositions: Position[];
  memberStats: { fuelType: string; _count: number; _sum: { upfrontPrice: number; gallonsPerMonth: number } }[];
  totalMembers: number;
  activeMembers: number;
  membersByDay: { dayNumber: number; _count: number; _sum: { upfrontPrice: number } }[];
  config: { lastRunAt: string | null } | null;
}

// --- Helpers ---

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtUsd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- SVG Mini-Chart ---

function SparkLine({
  data,
  width = 600,
  height = 120,
  color = "#10b981",
  showZero = false,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showZero?: boolean;
}) {
  if (data.length < 2) return null;
  const min = showZero ? Math.min(0, ...data) : Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return `${x},${y}`;
  });

  // Zero line
  let zeroY: number | null = null;
  if (showZero && min < 0) {
    zeroY = pad + h - ((0 - min) / range) * h;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      {zeroY !== null && (
        <line x1={pad} y1={zeroY} x2={width - pad} y2={zeroY} stroke="#9ca3af" strokeWidth={0.5} strokeDasharray="4,4" />
      )}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        points={points.join(" ")}
      />
    </svg>
  );
}

function DualLine({
  data1,
  data2,
  width = 600,
  height = 140,
  color1 = "#10b981",
  color2 = "#6366f1",
  label1 = "Series 1",
  label2 = "Series 2",
}: {
  data1: number[];
  data2: number[];
  labels?: string[];
  width?: number;
  height?: number;
  color1?: string;
  color2?: string;
  label1?: string;
  label2?: string;
}) {
  const all = [...data1, ...data2];
  if (all.length < 2) return null;
  const min = Math.min(0, ...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2 - 20;

  function toPoints(data: number[]) {
    return data.map((v, i) => {
      const x = pad + (i / (Math.max(data.length, 2) - 1)) * w;
      const y = pad + h - ((v - min) / range) * h;
      return `${x},${y}`;
    }).join(" ");
  }

  const zeroY = min < 0 ? pad + h - ((0 - min) / range) * h : null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      {zeroY !== null && (
        <line x1={pad} y1={zeroY} x2={width - pad} y2={zeroY} stroke="#9ca3af" strokeWidth={0.5} strokeDasharray="4,4" />
      )}
      <polyline fill="none" stroke={color1} strokeWidth={2} points={toPoints(data1)} />
      <polyline fill="none" stroke={color2} strokeWidth={2} points={toPoints(data2)} />
      {/* Legend */}
      <rect x={pad} y={height - 16} width={10} height={3} fill={color1} />
      <text x={pad + 14} y={height - 12} fontSize={10} fill="#6b7280">{label1}</text>
      <rect x={pad + 120} y={height - 16} width={10} height={3} fill={color2} />
      <text x={pad + 134} y={height - 12} fontSize={10} fill="#6b7280">{label2}</text>
    </svg>
  );
}

// --- Page ---

export default function HedgeBookPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedModel, setSelectedModel] = useState<"MATCHING_CALLS" | "DELTA_HEDGE">("MATCHING_CALLS");
  const [tab, setTab] = useState<"overview" | "positions" | "members">("overview");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/hedge-book?model=${selectedModel}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch hedge book data:", err);
        setLoading(false);
      });
  }, [selectedModel]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function runSimulation() {
    setRunning(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // WHY: No body params — simulation uses pricing config + market data.
      // Vol comes from RBOB price series, margin from PricingConfig,
      // contract size is always micro (4,200 gal).
      const res = await fetch("/api/admin/simulation", { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Simulation failed");
      setSuccessMsg(
        `Simulation complete: ${result.totalMembers.toLocaleString()} members, ` +
        `${result.totalPositions} positions, ${result.futuresPriceDays} trading days`
      );
      fetchData();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading hedge book...</div>
      </div>
    );
  }

  const snap = data?.latestSnapshot;
  const matchingSnapshots = data?.snapshots.filter((s) => s.model === "MATCHING_CALLS") || [];
  const deltaSnapshots = data?.snapshots.filter((s) => s.model === "DELTA_HEDGE") || [];
  const rbobPrices = data?.futuresPrices.filter((p) => p.instrument === "RBOB") || [];
  const hoPrices = data?.futuresPrices.filter((p) => p.instrument === "HO") || [];
  const modelSnapshots = selectedModel === "MATCHING_CALLS" ? matchingSnapshots : deltaSnapshots;

  return (
    <div className="space-y-6">
      {/* Header + Controls */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hedge Book Simulator</h1>
          <p className="text-sm text-gray-500 mt-1">
            Backtest hedge strategies using real RBOB/HO futures from Yahoo Finance
          </p>
        </div>

        <button
          onClick={runSimulation}
          disabled={running}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-semibold rounded-lg transition flex items-center gap-2"
        >
          {running && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {running ? "Running Simulation..." : "Run Simulation"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">
          {successMsg}
        </div>
      )}

      {/* Simulation Config — read-only info card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Simulation Parameters</h2>
        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Volatility</p>
            <p className="text-sm font-bold text-gray-900">Market-derived</p>
            <p className="text-xs text-gray-400">10-day rolling from RBOB prices</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Contract Size</p>
            <p className="text-sm font-bold text-gray-900">Micro (4,200 gal)</p>
            <p className="text-xs text-gray-400">NYMEX micro futures</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Hedge Threshold</p>
            <p className="text-sm font-bold text-gray-900">3,150 gal</p>
            <p className="text-xs text-gray-400">75% of contract before first buy</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Margin / Loads</p>
            <p className="text-sm font-bold text-gray-900">From Pricing Config</p>
            <p className="text-xs text-gray-400">Op load + profit + adverse selection</p>
          </div>
        </div>

        {data?.config?.lastRunAt && (
          <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
            Last run: {new Date(data.config.lastRunAt).toLocaleString()}
          </p>
        )}
      </div>

      {!data?.latestSnapshot ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg mb-2">No simulation data yet</p>
          <p className="text-gray-400 text-sm">
            Click &ldquo;Run Simulation&rdquo; to generate member signups and hedge positions
            using real RBOB/HO futures data and your active pricing config.
          </p>
        </div>
      ) : (
        <>
          {/* Model Toggle + Tabs */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setSelectedModel("MATCHING_CALLS")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  selectedModel === "MATCHING_CALLS"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Matching Calls
              </button>
              <button
                onClick={() => setSelectedModel("DELTA_HEDGE")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  selectedModel === "DELTA_HEDGE"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Delta Hedge
              </button>
            </div>

            <div className="flex items-center gap-1">
              {(["overview", "positions", "members"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    tab === t ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t === "overview" ? "Overview" : t === "positions" ? "Positions" : "Members"}
                </button>
              ))}
            </div>
          </div>

          {tab === "overview" && (
            <OverviewTab
              snap={snap!}
              matchingSnapshots={matchingSnapshots}
              deltaSnapshots={deltaSnapshots}
              modelSnapshots={modelSnapshots}
              rbobPrices={rbobPrices}
              hoPrices={hoPrices}
              data={data!}
            />
          )}

          {tab === "positions" && (
            <PositionsTab
              openPositions={data.openPositions}
              allPositions={data.allPositions}
            />
          )}

          {tab === "members" && (
            <MembersTab data={data!} />
          )}
        </>
      )}
    </div>
  );
}

// --- Overview Tab ---

function OverviewTab({
  snap,
  matchingSnapshots,
  deltaSnapshots,
  modelSnapshots,
  rbobPrices,
  hoPrices,
  data,
}: {
  snap: Snapshot;
  matchingSnapshots: Snapshot[];
  deltaSnapshots: Snapshot[];
  modelSnapshots: Snapshot[];
  rbobPrices: FuturesPrice[];
  hoPrices: FuturesPrice[];
  data: DashboardData;
}) {
  // WHY: The lowest cumulative Net P&L during the sim = worst cash deficit.
  // That's the working capital you need on day 1 to stay solvent through
  // the worst-case timing mismatch (hedge costs + rebates outpacing fees).
  const minCashPosition = Math.min(...modelSnapshots.map((s) => s.netPnl));
  const minCashDay = modelSnapshots.find((s) => s.netPnl === minCashPosition);
  const workingCapital = Math.max(0, -minCashPosition);

  return (
    <div className="space-y-6">
      {/* Working Capital callout — only show if there's a cash deficit */}
      {workingCapital > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-amber-900">Working Capital Required</h3>
              <p className="text-xs text-amber-700 mt-1">
                Minimum cash reserve to stay solvent through the worst timing mismatch
              </p>
            </div>
            <p className="text-2xl font-bold text-amber-700">{fmtUsd(workingCapital)}</p>
          </div>
          <p className="text-xs text-amber-600 mt-2">
            Worst cash position: {fmtUsd(minCashPosition)} on Day {minCashDay?.dayNumber ?? "?"}{" "}
            ({minCashDay ? new Date(minCashDay.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""})
            — this is when hedge costs + rebates most exceeded fees collected
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard label="Membership Fees" value={fmtUsd(snap.totalPremiumCollected)} />
        <KpiCard label="Hedge Cost" value={fmtUsd(snap.totalHedgeCost)} sub={`${snap.hedgePositionCount} open positions`} />
        <KpiCard
          label="Rebates Paid"
          value={fmtUsd(snap.rebatesPaid)}
          color="red"
          sub="Cumulative payouts to members"
        />
        <KpiCard label="Open Liability" value={fmtUsd(snap.openLiability)} color="amber" sub="Accrued, not yet settled" />
        <KpiCard
          label="Projected Liability"
          value={fmtUsd(snap.projectedLiability)}
          color="amber"
          sub="If prices stay at today's level"
        />
      </div>
      <div className="grid grid-cols-5 gap-4">
        <KpiCard
          label="Hedge MTM (Open)"
          value={fmtUsd(snap.hedgeMtmValue)}
          color={snap.hedgeMtmValue >= 0 ? "emerald" : "red"}
          sub="Mark-to-market of open positions"
        />
        <KpiCard
          label="Hedge Gain"
          value={fmtUsd(snap.realizedPnl)}
          color={snap.realizedPnl >= 0 ? "emerald" : "red"}
          sub="Profit from closing positions"
        />
        <KpiCard
          label="Net P&L"
          value={fmtUsd(snap.netPnl)}
          color={snap.netPnl >= 0 ? "emerald" : "red"}
          sub={`Fees - Hedging - Rebates`}
        />
        <KpiCard
          label="Hedge Ratio"
          value={`${snap.totalGallonsCovered > 0 ? ((snap.totalContractsOpen * 4200 / snap.totalGallonsCovered) * 100).toFixed(0) : 0}%`}
          sub={`${(snap.totalContractsOpen * 4200).toLocaleString()} gal hedged`}
        />
        <KpiCard label="Members" value={`${snap.totalMembers}`} sub={`${data.activeMembers} active`} />
      </div>

      {/* Greeks */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Portfolio Greeks</h3>
        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-gray-400">Delta (gal)</p>
            <p className="text-lg font-bold text-gray-900">{fmt(snap.portfolioDelta, 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Gamma</p>
            <p className="text-lg font-bold text-gray-900">{fmt(snap.portfolioGamma, 4)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Vega ($/1% vol)</p>
            <p className="text-lg font-bold text-gray-900">{fmt(snap.portfolioVega, 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Theta ($/day)</p>
            <p className="text-lg font-bold text-gray-900">{fmt(snap.portfolioTheta, 0)}</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Futures Price Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">RBOB & HO Futures</h3>
          <p className="text-xs text-gray-400 mb-3">Settlement price $/gal</p>
          <DualLine
            data1={rbobPrices.map((p) => p.settle)}
            data2={hoPrices.map((p) => p.settle)}
            color1="#f59e0b"
            color2="#3b82f6"
            label1="RBOB"
            label2="HO"
          />
          {rbobPrices.length > 0 && (
            <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
              <span>{new Date(rbobPrices[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              <span>{rbobPrices.length} trading days</span>
              <span>{new Date(rbobPrices[rbobPrices.length - 1].date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </div>
          )}
        </div>

        {/* P&L Comparison */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Net P&L Comparison</h3>
          <p className="text-xs text-gray-400 mb-3">Matching Calls vs Delta Hedge</p>
          <DualLine
            data1={matchingSnapshots.map((s) => s.netPnl)}
            data2={deltaSnapshots.map((s) => s.netPnl)}
            color1="#10b981"
            color2="#6366f1"
            label1="Matching Calls"
            label2="Delta Hedge"
          />
          {modelSnapshots.length > 0 && (
            <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
              <span>Day 1</span>
              <span>Day {Math.round(modelSnapshots.length / 2)}</span>
              <span>Day {modelSnapshots.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* More Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Premium vs Hedge Cost */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Premium Collected vs Hedge Cost</h3>
          <p className="text-xs text-gray-400 mb-3">Cumulative over simulation period</p>
          <DualLine
            data1={modelSnapshots.map((s) => s.totalPremiumCollected)}
            data2={modelSnapshots.map((s) => s.totalHedgeCost)}
            color1="#10b981"
            color2="#ef4444"
            label1="Premium"
            label2="Hedge Cost"
          />
        </div>

        {/* Open Liability */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Open Liability</h3>
          <p className="text-xs text-gray-400 mb-3">Estimated member payout obligation</p>
          <SparkLine
            data={modelSnapshots.map((s) => s.openLiability)}
            color="#f59e0b"
          />
        </div>
      </div>

      {/* Member Signup Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Daily Member Signups</h3>
        <p className="text-xs text-gray-400 mb-3">
          {data.totalMembers} total ({data.activeMembers} active)
        </p>
        <SparkLine
          data={data.membersByDay.map((d) => d._count)}
          height={80}
          color="#6366f1"
        />
        {data.membersByDay.length > 0 && (
          <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
            <span>Day 1</span>
            <span>Day {Math.round(data.membersByDay.length / 2)}</span>
            <span>Day {data.membersByDay.length}</span>
          </div>
        )}
      </div>

      {/* Strategy Comparison Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Strategy Comparison (Final Day)</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-5 py-3">Metric</th>
              <th className="px-5 py-3 text-right">Matching Calls</th>
              <th className="px-5 py-3 text-right">Delta Hedge</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(() => {
              const mc = matchingSnapshots[matchingSnapshots.length - 1];
              const dh = deltaSnapshots[deltaSnapshots.length - 1];
              if (!mc || !dh) return null;
              const rows = [
                ["Membership Fees", fmtUsd(mc.totalPremiumCollected), fmtUsd(dh.totalPremiumCollected)],
                ["Hedge Cost", fmtUsd(mc.totalHedgeCost), fmtUsd(dh.totalHedgeCost)],
                ["Rebates Paid", fmtUsd(mc.rebatesPaid), fmtUsd(dh.rebatesPaid)],
                ["Hedge Gain", fmtUsd(mc.realizedPnl), fmtUsd(dh.realizedPnl)],
                ["Hedge MTM (Open)", fmtUsd(mc.hedgeMtmValue), fmtUsd(dh.hedgeMtmValue)],
                ["Open Liability", fmtUsd(mc.openLiability), fmtUsd(dh.openLiability)],
                ["Projected Liability", fmtUsd(mc.projectedLiability), fmtUsd(dh.projectedLiability)],
                ["Net P&L", fmtUsd(mc.netPnl), fmtUsd(dh.netPnl)],
                ["Open Positions", `${mc.hedgePositionCount}`, `${dh.hedgePositionCount}`],
                ["Contracts Open", fmt(mc.totalContractsOpen, 0), fmt(dh.totalContractsOpen, 0)],
                ["Portfolio Delta", fmt(mc.portfolioDelta, 0), fmt(dh.portfolioDelta, 0)],
              ];
              return rows.map(([label, v1, v2]) => (
                <tr key={label}>
                  <td className="px-5 py-2.5 font-medium text-gray-900">{label}</td>
                  <td className="px-5 py-2.5 text-right text-gray-700">{v1}</td>
                  <td className="px-5 py-2.5 text-right text-gray-700">{v2}</td>
                </tr>
              ));
            })()}
          </tbody>
        </table>
      </div>

      {/* Monthly P&L Breakdown */}
      <MonthlyPnlTable snapshots={modelSnapshots} />

      {/* Daily Snapshots Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Daily Snapshots</h3>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5">Day</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5 text-right">RBOB</th>
                <th className="px-4 py-2.5 text-right">Members</th>
                <th className="px-4 py-2.5 text-right">New</th>
                <th className="px-4 py-2.5 text-right">Fees</th>
                <th className="px-4 py-2.5 text-right">Hedge Cost</th>
                <th className="px-4 py-2.5 text-right">Rebates Paid</th>
                <th className="px-4 py-2.5 text-right">Liability</th>
                <th className="px-4 py-2.5 text-right">Net P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {modelSnapshots.map((s) => (
                <tr key={s.dayNumber} className={s.netPnl < 0 ? "bg-red-50/30" : ""}>
                  <td className="px-4 py-2 font-medium text-gray-900">{s.dayNumber}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">${s.rbobPrice.toFixed(3)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{s.totalMembers}</td>
                  <td className="px-4 py-2 text-right text-gray-500">+{s.newMembersToday}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{fmtUsd(s.totalPremiumCollected)}</td>
                  <td className="px-4 py-2 text-right text-red-600">{fmtUsd(s.totalHedgeCost)}</td>
                  <td className="px-4 py-2 text-right text-red-600">{fmtUsd(s.rebatesPaid)}</td>
                  <td className="px-4 py-2 text-right text-amber-600">{fmtUsd(s.openLiability)}</td>
                  <td className={`px-4 py-2 text-right font-bold ${s.netPnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {fmtUsd(s.netPnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">How The Simulation Works</h3>
        <div className="text-xs text-gray-500 space-y-1">
          <p>1. Fetches 3 months of real RBOB and HO futures settlement prices from Yahoo Finance (NYMEX).</p>
          <p>2. Generates simulated member signups (10-50/day ramp) using your active Pricing Config for margin and loads.</p>
          <p>3. Volatility is computed per-day as 10-day trailing realized vol from actual RBOB prices — not a fixed assumption.</p>
          <p>4. Hedge purchases trigger immediately when gallons enter a monthly bucket — no waiting threshold. Over-hedge cost of one micro contract (~$84-$400) is cheaper than unhedged rebate risk.</p>
          <p>5. All contracts are <strong>micro NYMEX</strong> (4,200 gal). Options are bought per monthly expiry bucket and sold ~4 days before expiry to capture remaining time value.</p>
          <p>6. <strong>Position decay</strong>: As members consume gallons and plans expire, excess hedge positions are sold back to keep coverage matched to actual exposure.</p>
          <p>7. <strong>Transaction costs</strong>: Includes $0.003/gal bid/ask spread on entry, $2.00/contract commission per side, and 2% spread on sell-back.</p>
          <p>8. Two strategies run in parallel: <strong>Matching Calls</strong> (1:1 gallon coverage) and <strong>Delta Hedge</strong> (delta-adjusted, rebalanced every 5 days).</p>
        </div>
      </div>
    </div>
  );
}

// --- KPI Card ---

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "emerald" | "red" | "amber";
}) {
  const colorClass =
    color === "emerald"
      ? "text-emerald-600"
      : color === "red"
      ? "text-red-600"
      : color === "amber"
      ? "text-amber-600"
      : "text-gray-900";
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${colorClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// --- Positions Tab ---

function PositionsTab({
  openPositions,
  allPositions,
}: {
  openPositions: Position[];
  allPositions: Position[];
}) {
  return (
    <div className="space-y-6">
      {/* Open Positions */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">
            Open Positions <span className="text-gray-400 font-normal">({openPositions.length})</span>
          </h3>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5">Instrument</th>
                <th className="px-4 py-2.5">Opened</th>
                <th className="px-4 py-2.5">Expiry</th>
                <th className="px-4 py-2.5 text-right">Strike</th>
                <th className="px-4 py-2.5 text-right">Contracts</th>
                <th className="px-4 py-2.5 text-right">Size</th>
                <th className="px-4 py-2.5 text-right">Premium Paid</th>
                <th className="px-4 py-2.5 text-right">Current Value</th>
                <th className="px-4 py-2.5 text-right">P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {openPositions.map((p) => {
                const pnl = p.currentValue - p.totalPremium;
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-medium text-gray-900">{p.instrument}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {new Date(p.openDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {new Date(p.expiryDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">${p.strikePrice.toFixed(3)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{p.contracts}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{p.contractSize.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{fmtUsd(p.totalPremium)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{fmtUsd(p.currentValue)}</td>
                    <td className={`px-4 py-2 text-right font-bold ${pnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {pnl >= 0 ? "+" : ""}{fmtUsd(pnl)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Position History */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">
            All Positions <span className="text-gray-400 font-normal">({allPositions.length})</span>
          </h3>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5">Instrument</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Opened</th>
                <th className="px-4 py-2.5">Expiry</th>
                <th className="px-4 py-2.5 text-right">Strike</th>
                <th className="px-4 py-2.5 text-right">Contracts</th>
                <th className="px-4 py-2.5 text-right">Premium/gal</th>
                <th className="px-4 py-2.5 text-right">Total Premium</th>
                <th className="px-4 py-2.5 text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allPositions.slice(0, 100).map((p) => (
                <tr key={p.id} className={!p.isOpen ? "opacity-50" : ""}>
                  <td className="px-4 py-2 font-medium text-gray-900">{p.instrument}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      p.isOpen ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {p.isOpen ? "OPEN" : "CLOSED"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {new Date(p.openDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {new Date(p.expiryDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">${p.strikePrice.toFixed(3)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{p.contracts}</td>
                  <td className="px-4 py-2 text-right text-gray-500">${p.premiumPerUnit.toFixed(4)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{fmtUsd(p.totalPremium)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{fmtUsd(p.currentValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- Members Tab ---

function MembersTab({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-6">
      {/* Member Stats */}
      <div className="grid grid-cols-3 gap-4">
        {data.memberStats.map((s) => (
          <div key={s.fuelType} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 mb-2">{s.fuelType}</p>
            <p className="text-2xl font-bold text-gray-900">{s._count} members</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span>Premium: {fmtUsd(s._sum.upfrontPrice || 0)}</span>
              <span>Avg gal/mo: {Math.round((s._sum.gallonsPerMonth || 0) / s._count)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Signup Ramp */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Daily Signups & Premium</h3>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5">Day</th>
                <th className="px-4 py-2.5 text-right">Signups</th>
                <th className="px-4 py-2.5 text-right">Fees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.membersByDay.map((d) => (
                <tr key={d.dayNumber}>
                  <td className="px-4 py-2 font-medium text-gray-900">Day {d.dayNumber}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{d._count}</td>
                  <td className="px-4 py-2 text-right text-emerald-600">{fmtUsd(d._sum.upfrontPrice || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- Monthly P&L Table ---
// WHY: Shows P&L by calendar month so you can see which months had
// price spikes (losses) and which were profitable. Computed from
// snapshot data by taking the last snapshot of each month and
// computing incremental values.

interface MonthlyPnl {
  month: string;
  fees: number;
  hedgeCost: number;
  rebates: number;
  hedgeGain: number;
  netPnl: number;
  openLiability: number;
  projectedLiab: number;
  hedgeMtm: number;
  members: number;
  rbobPrice: number;
}

function computeMonthlyPnl(snapshots: Snapshot[]): MonthlyPnl[] {
  if (snapshots.length === 0) return [];

  const byMonth = new Map<string, Snapshot[]>();
  for (const s of snapshots) {
    const d = new Date(s.date);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const arr = byMonth.get(key) || [];
    arr.push(s);
    byMonth.set(key, arr);
  }

  const monthKeys = Array.from(byMonth.keys()).sort();
  const months: MonthlyPnl[] = [];
  let prevSnap: Snapshot | null = null;

  for (const key of monthKeys) {
    const monthSnaps = byMonth.get(key)!;
    const last = monthSnaps[monthSnaps.length - 1];

    const fees = last.totalPremiumCollected - (prevSnap?.totalPremiumCollected ?? 0);
    const hedgeCost = last.totalHedgeCost - (prevSnap?.totalHedgeCost ?? 0);
    const rebates = last.rebatesPaid - (prevSnap?.rebatesPaid ?? 0);
    const hedgeGain = last.realizedPnl - (prevSnap?.realizedPnl ?? 0);
    const netPnl = last.netPnl - (prevSnap?.netPnl ?? 0);

    const [yr, mo] = key.split("-").map(Number);
    const monthLabel = new Date(yr, mo - 1, 1).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    months.push({
      month: monthLabel,
      fees,
      hedgeCost,
      rebates,
      hedgeGain,
      netPnl,
      openLiability: last.openLiability,
      projectedLiab: last.projectedLiability,
      hedgeMtm: last.hedgeMtmValue,
      members: last.totalMembers,
      rbobPrice: last.rbobPrice,
    });

    prevSnap = last;
  }

  return months;
}

function MonthlyPnlTable({ snapshots }: { snapshots: Snapshot[] }) {
  const months = computeMonthlyPnl(snapshots);
  if (months.length === 0) return null;

  const totals = {
    fees: months.reduce((s, m) => s + m.fees, 0),
    hedgeCost: months.reduce((s, m) => s + m.hedgeCost, 0),
    rebates: months.reduce((s, m) => s + m.rebates, 0),
    hedgeGain: months.reduce((s, m) => s + m.hedgeGain, 0),
    netPnl: months.reduce((s, m) => s + m.netPnl, 0),
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Monthly P&L Breakdown</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Incremental cash flows by calendar month — shows impact of price spikes and recoveries
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-2.5">Month</th>
              <th className="px-4 py-2.5 text-right">RBOB</th>
              <th className="px-4 py-2.5 text-right">Members</th>
              <th className="px-4 py-2.5 text-right">Fees</th>
              <th className="px-4 py-2.5 text-right">Hedge Cost</th>
              <th className="px-4 py-2.5 text-right">Rebates</th>
              <th className="px-4 py-2.5 text-right">Hedge Gain</th>
              <th className="px-4 py-2.5 text-right">Net P&L</th>
              <th className="px-4 py-2.5 text-right">Open Liab.</th>
              <th className="px-4 py-2.5 text-right">Hedge MTM</th>
              <th className="px-4 py-2.5 text-right">Cash Position</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(() => {
              let runningCash = 0;
              return months.map((m) => {
                runningCash += m.netPnl;
                return (
                  <tr key={m.month} className={m.netPnl < 0 ? "bg-red-50/30" : ""}>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{m.month}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">${m.rbobPrice.toFixed(3)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{m.members.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-600">{fmtUsd(m.fees)}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">{fmtUsd(m.hedgeCost)}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">{fmtUsd(m.rebates)}</td>
                    <td className={`px-4 py-2.5 text-right ${m.hedgeGain >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {fmtUsd(m.hedgeGain)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-bold ${m.netPnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {fmtUsd(m.netPnl)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-amber-600">{fmtUsd(m.openLiability)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{fmtUsd(m.hedgeMtm)}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${runningCash >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {fmtUsd(runningCash)}
                    </td>
                  </tr>
                );
              });
            })()}
            <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
              <td className="px-4 py-2.5 text-gray-900">Total</td>
              <td className="px-4 py-2.5"></td>
              <td className="px-4 py-2.5"></td>
              <td className="px-4 py-2.5 text-right text-emerald-600">{fmtUsd(totals.fees)}</td>
              <td className="px-4 py-2.5 text-right text-red-600">{fmtUsd(totals.hedgeCost)}</td>
              <td className="px-4 py-2.5 text-right text-red-600">{fmtUsd(totals.rebates)}</td>
              <td className={`px-4 py-2.5 text-right ${totals.hedgeGain >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {fmtUsd(totals.hedgeGain)}
              </td>
              <td className={`px-4 py-2.5 text-right ${totals.netPnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {fmtUsd(totals.netPnl)}
              </td>
              <td className="px-4 py-2.5"></td>
              <td className="px-4 py-2.5"></td>
              <td className={`px-4 py-2.5 text-right ${totals.netPnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {fmtUsd(totals.netPnl)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
