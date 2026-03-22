"use client";

import { useEffect, useState } from "react";

interface PlanDetail {
  id: string;
  userEmail: string;
  userName: string | null;
  strikePrice: number;
  spotAtPurchase: number;
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

interface ExposureData {
  summary: {
    totalActivePlans: number;
    totalMaxExposure: number;
    totalPremiumCollected: number;
    premiumToExposureRatio: number;
    totalGallonsCovered: number;
  };
  byState: Record<string, { plans: number; exposure: number; premium: number }>;
  byTerm: Record<string, { plans: number; exposure: number; premium: number }>;
  plans: PlanDetail[];
}

export default function AdminExposurePage() {
  const [data, setData] = useState<ExposureData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/exposure")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-400 py-12 text-center">Loading exposure data...</div>;
  }

  if (!data) {
    return <div className="text-red-500 py-12 text-center">Failed to load exposure data</div>;
  }

  const { summary, byState, byTerm, plans } = data;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Open Exposure</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Plans" value={summary.totalActivePlans} format="number" />
        <StatCard label="Premium Collected" value={summary.totalPremiumCollected} format="currency" color="text-emerald-600" />
        <StatCard label="Max Exposure" value={summary.totalMaxExposure} format="currency" color="text-amber-600" />
        <StatCard label="Coverage Ratio" value={summary.premiumToExposureRatio} format="ratio" />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* By State */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">By State</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-2 text-left">State</th>
                <th className="px-4 py-2 text-center">Plans</th>
                <th className="px-4 py-2 text-right">Premium</th>
                <th className="px-4 py-2 text-right">Exposure</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byState)
                .sort(([, a], [, b]) => b.exposure - a.exposure)
                .map(([state, d]) => (
                  <tr key={state} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium">{state}</td>
                    <td className="px-4 py-2 text-center">{d.plans}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-600">${d.premium.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono text-amber-600">${d.exposure.toFixed(2)}</td>
                  </tr>
                ))}
              {Object.keys(byState).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* By Term */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">By Term</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-2 text-left">Term</th>
                <th className="px-4 py-2 text-center">Plans</th>
                <th className="px-4 py-2 text-right">Premium</th>
                <th className="px-4 py-2 text-right">Exposure</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byTerm)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([term, d]) => (
                  <tr key={term} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium">{term}-month</td>
                    <td className="px-4 py-2 text-center">{d.plans}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-600">${d.premium.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono text-amber-600">${d.exposure.toFixed(2)}</td>
                  </tr>
                ))}
              {Object.keys(byTerm).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Plans Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
            All Active Plans ({plans.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-2 text-left">Member</th>
                <th className="px-4 py-2 text-right">Strike</th>
                <th className="px-4 py-2 text-right">Spot (buy)</th>
                <th className="px-4 py-2 text-center">Term</th>
                <th className="px-4 py-2 text-right">Gal/Mo</th>
                <th className="px-4 py-2 text-right">Mo Left</th>
                <th className="px-4 py-2 text-right">Premium</th>
                <th className="px-4 py-2 text-right">Max Exposure</th>
                <th className="px-4 py-2 text-left">State</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-900">{plan.userName || "—"}</div>
                    <div className="text-xs text-gray-400">{plan.userEmail}</div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">${plan.strikePrice.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-mono text-gray-500">${plan.spotAtPurchase.toFixed(2)}</td>
                  <td className="px-4 py-2 text-center">{plan.termDays}d</td>
                  <td className="px-4 py-2 text-right">{plan.gallonsPerMonth}</td>
                  <td className="px-4 py-2 text-right">{plan.daysRemaining}</td>
                  <td className="px-4 py-2 text-right font-mono text-emerald-600">${plan.premiumPaid.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-mono text-amber-600">${plan.maxExposure.toFixed(2)}</td>
                  <td className="px-4 py-2">{plan.stateCode || "—"}</td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    No active plans
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  format,
  color = "text-gray-900",
}: {
  label: string;
  value: number;
  format: "number" | "currency" | "ratio";
  color?: string;
}) {
  let display: string;
  if (format === "currency") {
    display = `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (format === "ratio") {
    display = `${(value * 100).toFixed(1)}%`;
  } else {
    display = value.toLocaleString();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{display}</p>
    </div>
  );
}
