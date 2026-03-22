"use client";

import { useEffect, useState } from "react";

interface ExposureSummary {
  totalActivePlans: number;
  totalMaxExposure: number;
  totalPremiumCollected: number;
  premiumToExposureRatio: number;
  totalGallonsCovered: number;
}

interface ExposurePlan {
  id: string;
  userEmail: string;
  userName: string | null;
  strikePrice: number;
  spotAtPurchase: number;
  currentRetailPrice: number | null;
  priceAboveStrike: number;
  termDays: number;
  gallonsPerMonth: number;
  daysRemaining: number;
  gallonsRemaining: number;
  maxExposure: number;
  premiumPaid: number;
  stateCode: string | null;
  startDate: string;
  endDate: string;
}

interface MemberSummary {
  total: number;
}

interface HedgeSnapshot {
  totalPremiumCollected: number;
  totalHedgeCost: number;
  rebatesPaid: number;
  openLiability: number;
  projectedLiability: number;
  hedgeMtmValue: number;
  realizedPnl: number;
  netPnl: number;
  hedgePositionCount: number;
  totalContractsOpen: number;
  totalGallonsCovered: number;
  totalMembers: number;
}

// --- Helpers ---

function fmtUsd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminDashboard() {
  const [exposure, setExposure] = useState<ExposureSummary | null>(null);
  const [plans, setPlans] = useState<ExposurePlan[]>([]);
  const [members, setMembers] = useState<MemberSummary | null>(null);
  const [hedge, setHedge] = useState<HedgeSnapshot | null>(null);
  const [hasHedgeData, setHasHedgeData] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/exposure").then((r) => r.json()),
      fetch("/api/admin/members").then((r) => r.json()),
      fetch("/api/admin/hedge-book?model=MATCHING_CALLS").then((r) => r.json()),
    ])
      .then(([exp, mem, hb]) => {
        setExposure(exp.summary);
        setPlans(exp.plans || []);
        setMembers({ total: mem.total });
        if (hb.latestSnapshot) {
          setHedge(hb.latestSnapshot);
          setHasHedgeData(true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-400 py-12 text-center">Loading dashboard...</div>;
  }

  // Count plans with exposure (retail > strike)
  const plansWithExposure = plans.filter((p) => p.priceAboveStrike > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Row 1: Revenue & Costs */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard
          label="Membership Fees"
          value={fmtUsd(exposure?.totalPremiumCollected ?? 0)}
          color="emerald"
        />
        <KpiCard
          label="Hedge Cost"
          value={hasHedgeData ? fmtUsd(hedge!.totalHedgeCost) : "—"}
          sub={hasHedgeData ? `${hedge!.hedgePositionCount} open positions` : "Run simulation first"}
        />
        <KpiCard
          label="Rebates Paid"
          value={hasHedgeData ? fmtUsd(hedge!.rebatesPaid) : "—"}
          color="red"
          sub="Cumulative payouts to members"
        />
        <KpiCard
          label="Open Liability"
          value={hasHedgeData ? fmtUsd(hedge!.openLiability) : "—"}
          color="amber"
          sub="Accrued, not yet settled"
        />
        <KpiCard
          label="Projected Liability"
          value={fmtUsd(exposure?.totalMaxExposure ?? 0)}
          color="amber"
          sub="At today's retail prices"
        />
      </div>

      {/* Row 2: Hedge & P&L */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard
          label="Hedge MTM (Open)"
          value={hasHedgeData ? fmtUsd(hedge!.hedgeMtmValue) : "—"}
          color={hasHedgeData && hedge!.hedgeMtmValue >= 0 ? "emerald" : "red"}
          sub="Mark-to-market of open positions"
        />
        <KpiCard
          label="Hedge Gain"
          value={hasHedgeData ? fmtUsd(hedge!.realizedPnl) : "—"}
          color={hasHedgeData && hedge!.realizedPnl >= 0 ? "emerald" : "red"}
          sub="Profit from closing positions"
        />
        <KpiCard
          label="Net P&L"
          value={hasHedgeData ? fmtUsd(hedge!.netPnl) : "—"}
          color={hasHedgeData && hedge!.netPnl >= 0 ? "emerald" : "red"}
          sub="Fees - Hedging - Rebates"
        />
        <KpiCard
          label="Hedge Ratio"
          value={hasHedgeData && hedge!.totalGallonsCovered > 0
            ? `${((hedge!.totalContractsOpen * 4200 / hedge!.totalGallonsCovered) * 100).toFixed(0)}%`
            : "—"
          }
          sub={hasHedgeData ? `${(hedge!.totalContractsOpen * 4200).toLocaleString()} gal hedged` : undefined}
        />
        <KpiCard
          label="Members"
          value={`${members?.total ?? 0}`}
          sub={`${exposure?.totalActivePlans ?? 0} active plans`}
        />
      </div>

      {/* Real exposure: Plans with current retail > strike */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Live Exposure</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Active plans where current retail price exceeds member&apos;s max — based on live GasBuddy prices
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Plans with exposure</p>
            <p className="text-lg font-bold text-amber-600">
              {plansWithExposure.length} of {exposure?.totalActivePlans ?? 0}
            </p>
          </div>
        </div>

        {plansWithExposure.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            No active plans currently have gas above their max price
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-3 py-2 text-left">Member</th>
                  <th className="px-3 py-2 text-right">Max Price</th>
                  <th className="px-3 py-2 text-right">Current</th>
                  <th className="px-3 py-2 text-right">Over Max</th>
                  <th className="px-3 py-2 text-right">Days Left</th>
                  <th className="px-3 py-2 text-right">Gal Left</th>
                  <th className="px-3 py-2 text-right">Exposure</th>
                  <th className="px-3 py-2 text-right">Fee Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {plansWithExposure
                  .sort((a, b) => b.maxExposure - a.maxExposure)
                  .map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 text-gray-700">{p.userEmail}</td>
                      <td className="px-3 py-2 text-right text-gray-700">${p.strikePrice.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-red-600">
                        ${p.currentRetailPrice?.toFixed(2) ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-red-600 font-medium">
                        +${p.priceAboveStrike.toFixed(3)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">{p.daysRemaining}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{p.gallonsRemaining}</td>
                      <td className="px-3 py-2 text-right text-amber-600 font-medium">
                        {fmtUsd(p.maxExposure)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">{fmtUsd(p.premiumPaid)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Coverage summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Gallons Covered</p>
          <p className="text-2xl font-bold text-gray-900">
            {(exposure?.totalGallonsCovered ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Premium / Exposure</p>
          <p className="text-2xl font-bold text-gray-900">
            {((exposure?.premiumToExposureRatio ?? 0) * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">How much premium covers projected liability</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Avg Fee Per Plan</p>
          <p className="text-2xl font-bold text-gray-900">
            {exposure && exposure.totalActivePlans > 0
              ? fmtUsd(exposure.totalPremiumCollected / exposure.totalActivePlans)
              : "$0.00"}
          </p>
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
  color?: string;
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
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
