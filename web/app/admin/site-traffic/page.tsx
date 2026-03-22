"use client";

import { useEffect, useState, useCallback } from "react";

interface FunnelStep {
  step: string;
  label: string;
  sessions: number;
  detail?: { selected: number; skipped: number };
}

interface DailyPoint {
  date: string;
  sessions: number;
}

interface TrafficData {
  funnel: FunnelStep[];
  daily: DailyPoint[];
}

const RANGE_OPTIONS = [
  { label: "Today", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "All time", days: 0 },
];

export default function SiteTrafficPage() {
  const [data, setData] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const fetchData = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/site-traffic?days=${d}`);
      if (res.ok) setData(await res.json());
    } catch {
      // Silently fail — admin can retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  const maxSessions = data ? Math.max(...data.funnel.map((s) => s.sessions), 1) : 1;
  const totalSessions = data?.funnel[0]?.sessions ?? 0;
  const completedSessions = data?.funnel[data.funnel.length - 1]?.sessions ?? 0;
  const completionRate = totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : "0.0";

  // WHY: Find the step with the biggest absolute drop-off to highlight
  // where the most users are lost in the funnel.
  let biggestDropStep = "";
  let biggestDrop = 0;
  if (data && data.funnel.length > 1) {
    for (let i = 1; i < data.funnel.length; i++) {
      const drop = data.funnel[i - 1].sessions - data.funnel[i].sessions;
      if (drop > biggestDrop) {
        biggestDrop = drop;
        biggestDropStep = data.funnel[i - 1].label;
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Site Traffic</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setDays(opt.days)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                days === opt.days
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500 mb-1">Total Sessions</p>
          <p className="text-2xl font-bold text-gray-900">
            {loading ? "..." : totalSessions.toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500 mb-1">Completion Rate</p>
          <p className="text-2xl font-bold text-emerald-600">
            {loading ? "..." : `${completionRate}%`}
          </p>
          <p className="text-xs text-gray-400 mt-1">Zip entry &rarr; Waitlist submit</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500 mb-1">Biggest Drop-off</p>
          <p className="text-2xl font-bold text-red-500">
            {loading ? "..." : biggestDrop > 0 ? biggestDrop.toLocaleString() : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {biggestDropStep ? `After "${biggestDropStep}"` : "No data yet"}
          </p>
        </div>
      </div>

      {/* Funnel Chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quote Funnel</h2>
        {loading ? (
          <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
        ) : !data || data.funnel.every((s) => s.sessions === 0) ? (
          <div className="text-gray-400 text-sm py-8 text-center">
            No funnel data yet. Events will appear as visitors use the quote calculator.
          </div>
        ) : (
          <div className="space-y-3">
            {data.funnel.map((step, i) => {
              const pct = maxSessions > 0 ? (step.sessions / maxSessions) * 100 : 0;
              const prevSessions = i > 0 ? data.funnel[i - 1].sessions : step.sessions;
              const dropPct =
                prevSessions > 0
                  ? (((prevSessions - step.sessions) / prevSessions) * 100).toFixed(0)
                  : "0";
              const convPct =
                totalSessions > 0
                  ? ((step.sessions / totalSessions) * 100).toFixed(0)
                  : "0";

              return (
                <div key={step.step} className="flex items-center gap-4">
                  <div className="w-40 text-sm text-gray-700 font-medium truncate">
                    {step.label}
                  </div>
                  <div className="flex-1 relative">
                    <div className="h-8 bg-gray-100 rounded-md overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-md transition-all duration-500"
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm font-semibold text-gray-900">
                    {step.sessions.toLocaleString()}
                  </div>
                  <div className="w-14 text-right text-xs text-gray-400">{convPct}%</div>
                  {i > 0 && Number(dropPct) > 0 ? (
                    <div className="w-20 text-right text-xs text-red-400">
                      &minus;{dropPct}% drop
                    </div>
                  ) : (
                    <div className="w-20" />
                  )}
                </div>
              );
            })}
          </div>
        )}
        {data && data.funnel.some((s) => s.step === "vehicle_step" && s.detail) && (
          <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400">
            Vehicle step breakdown:{" "}
            {data.funnel.find((s) => s.step === "vehicle_step")?.detail?.selected ?? 0} selected a vehicle,{" "}
            {data.funnel.find((s) => s.step === "vehicle_step")?.detail?.skipped ?? 0} skipped
          </div>
        )}
      </div>

      {/* Daily Sessions Trend */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Sessions</h2>
        {loading ? (
          <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
        ) : !data || data.daily.length === 0 ? (
          <div className="text-gray-400 text-sm py-8 text-center">No daily data yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium text-right">Sessions</th>
                  <th className="py-2 font-medium pl-4">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {data.daily.map((d) => {
                  const dailyMax = Math.max(...data.daily.map((p) => p.sessions), 1);
                  const barPct = (d.sessions / dailyMax) * 100;
                  return (
                    <tr key={d.date} className="border-b border-gray-50">
                      <td className="py-2 text-gray-700 font-mono">{d.date}</td>
                      <td className="py-2 text-right font-semibold text-gray-900">
                        {d.sessions.toLocaleString()}
                      </td>
                      <td className="py-2 pl-4">
                        <div className="h-4 bg-gray-100 rounded overflow-hidden w-48">
                          <div
                            className="h-full bg-emerald-400 rounded"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
