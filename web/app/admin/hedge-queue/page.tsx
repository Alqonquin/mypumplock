"use client";

import { useEffect, useState, useCallback } from "react";

interface BucketData {
  id: string;
  strikePrice: number;
  instrument: string;
  expiryMonth: string;
  accumulatedGallons: number;
  memberCount: number;
  triggerThreshold: number;
  triggerOverride: number | null;
  fillPercent: number;
  gallonsToTrigger: number;
  contractsNeeded: number;
  status: string;
}

interface QueueSummary {
  totalBuckets: number;
  fillingBuckets: number;
  readyBuckets: number;
  executedBuckets: number;
  totalUnhedgedGallons: number;
  totalHedgedGallons: number;
}

interface NearThreshold {
  id: string;
  strikePrice: number;
  instrument: string;
  expiryMonth: string;
  fillPercent: number;
}

interface MarketStatus {
  isOpen: boolean;
  hoursSinceClose: number;
  currentBuffer: number;
  nextOpen: string;
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default function HedgeQueuePage() {
  const [buckets, setBuckets] = useState<BucketData[]>([]);
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [nearThreshold, setNearThreshold] = useState<NearThreshold[]>([]);
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editingTrigger, setEditingTrigger] = useState<string | null>(null);
  const [triggerInput, setTriggerInput] = useState("");
  const [filter, setFilter] = useState<"ALL" | "FILLING" | "READY" | "EXECUTED">("ALL");

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/hedge-queue");
      const data = await res.json();
      setBuckets(data.buckets || []);
      setSummary(data.summary);
      setNearThreshold(data.nearThreshold || []);
      setMarketStatus(data.marketStatus);
    } catch {
      setMessage("Failed to load hedge queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function executeBucket(bucketId: string) {
    try {
      const res = await fetch("/api/admin/hedge-queue", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "execute", bucketId }),
      });
      if (res.ok) {
        setMessage("Bucket marked as executed");
        setTimeout(() => setMessage(""), 3000);
        await loadData();
      }
    } catch {
      setMessage("Failed to execute bucket");
    }
  }

  async function saveTriggerOverride(bucketId: string) {
    try {
      const threshold = triggerInput === "" ? null : parseInt(triggerInput);
      const res = await fetch("/api/admin/hedge-queue", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setTrigger", bucketId, threshold }),
      });
      if (res.ok) {
        setEditingTrigger(null);
        setMessage("Trigger updated");
        setTimeout(() => setMessage(""), 3000);
        await loadData();
      }
    } catch {
      setMessage("Failed to update trigger");
    }
  }

  const filteredBuckets = filter === "ALL"
    ? buckets
    : buckets.filter((b) => b.status === filter);

  // Sort: READY first (highest priority), then FILLING by fill%, then EXECUTED
  const sortedBuckets = [...filteredBuckets].sort((a, b) => {
    const statusOrder: Record<string, number> = { READY: 0, FILLING: 1, EXECUTED: 2 };
    const aDiff = statusOrder[a.status] ?? 1;
    const bDiff = statusOrder[b.status] ?? 1;
    if (aDiff !== bDiff) return aDiff - bDiff;
    return b.fillPercent - a.fillPercent;
  });

  if (loading) {
    return <div className="text-gray-400 py-12 text-center">Loading hedge queue...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Hedge Queue</h1>
        <div className="flex items-center gap-3">
          {message && (
            <span className={`text-sm font-medium ${message.includes("Failed") ? "text-red-600" : "text-emerald-600"}`}>
              {message}
            </span>
          )}
          <button
            onClick={loadData}
            className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Market Status Banner */}
      {marketStatus && (
        <div className={`rounded-xl border p-4 ${marketStatus.isOpen ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${marketStatus.isOpen ? "bg-emerald-500" : "bg-amber-500"}`} />
            <span className="font-semibold text-gray-900">
              CME: {marketStatus.isOpen ? "Open — Executions Active" : "Closed — Queued for Market Open"}
            </span>
            {!marketStatus.isOpen && (
              <span className="text-sm text-gray-600">Reopens {marketStatus.nextOpen}</span>
            )}
          </div>
        </div>
      )}

      {/* Near-Threshold Alerts */}
      {nearThreshold.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">Near-Threshold Alerts</h3>
          <div className="space-y-1">
            {nearThreshold.map((b) => (
              <p key={b.id} className="text-sm text-amber-700">
                <span className="font-mono font-medium">{fmtUsd(b.strikePrice)} {b.instrument}</span>
                {" "}({b.expiryMonth}) at {(b.fillPercent * 100).toFixed(0)}% — approaching trigger
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-5 gap-4">
          <KpiCard label="Total Buckets" value={String(summary.totalBuckets)} />
          <KpiCard
            label="Ready to Execute"
            value={String(summary.readyBuckets)}
            color={summary.readyBuckets > 0 ? "amber" : undefined}
          />
          <KpiCard label="Filling" value={String(summary.fillingBuckets)} />
          <KpiCard
            label="Unhedged Gallons"
            value={summary.totalUnhedgedGallons.toLocaleString()}
            color="amber"
            sub={`~${Math.ceil(summary.totalUnhedgedGallons / 4200)} contracts needed`}
          />
          <KpiCard
            label="Hedged Gallons"
            value={summary.totalHedgedGallons.toLocaleString()}
            color="emerald"
            sub={`${summary.executedBuckets} buckets executed`}
          />
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(["ALL", "READY", "FILLING", "EXECUTED"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
              filter === f
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f}
            {f !== "ALL" && (
              <span className="ml-1 text-xs opacity-70">
                ({buckets.filter((b) => b.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bucket Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        {sortedBuckets.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            No strike buckets yet. Buckets are created as members sign up.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Strike</th>
                  <th className="px-4 py-3 text-left">Instrument</th>
                  <th className="px-4 py-3 text-left">Expiry</th>
                  <th className="px-4 py-3 text-right">Gallons</th>
                  <th className="px-4 py-3 text-right">Members</th>
                  <th className="px-4 py-3 text-center">Fill</th>
                  <th className="px-4 py-3 text-right">Trigger</th>
                  <th className="px-4 py-3 text-right">Contracts</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedBuckets.map((b) => (
                  <tr key={b.id} className={b.status === "READY" ? "bg-amber-50" : ""}>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                      {fmtUsd(b.strikePrice)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{b.instrument}</td>
                    <td className="px-4 py-3 text-gray-700">{b.expiryMonth}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {b.accumulatedGallons.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{b.memberCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 min-w-[60px]">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              b.fillPercent >= 100
                                ? "bg-amber-500"
                                : b.fillPercent >= 80
                                  ? "bg-yellow-400"
                                  : "bg-blue-400"
                            }`}
                            style={{ width: `${Math.min(100, b.fillPercent)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">
                          {b.fillPercent}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingTrigger === b.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <input
                            type="number"
                            step="100"
                            placeholder="default"
                            value={triggerInput}
                            onChange={(e) => setTriggerInput(e.target.value)}
                            className="w-20 text-right border rounded px-1 py-0.5 text-xs"
                          />
                          <button
                            onClick={() => saveTriggerOverride(b.id)}
                            className="text-xs text-emerald-600 font-medium"
                          >
                            OK
                          </button>
                          <button
                            onClick={() => setEditingTrigger(null)}
                            className="text-xs text-gray-400"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingTrigger(b.id);
                            setTriggerInput(b.triggerOverride?.toString() ?? "");
                          }}
                          className="text-xs font-mono text-gray-600 hover:text-blue-600"
                        >
                          {b.triggerThreshold.toLocaleString()}
                          {b.triggerOverride !== null && (
                            <span className="text-blue-500 ml-0.5">*</span>
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {b.contractsNeeded}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {b.status === "READY" && (
                        <button
                          onClick={() => executeBucket(b.id)}
                          className="px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition"
                        >
                          Execute
                        </button>
                      )}
                      {b.status === "EXECUTED" && (
                        <span className="text-xs text-emerald-600 font-medium">Done</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    FILLING: "bg-blue-100 text-blue-700",
    READY: "bg-amber-100 text-amber-700",
    EXECUTED: "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

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
    color === "emerald" ? "text-emerald-600"
      : color === "red" ? "text-red-600"
        : color === "amber" ? "text-amber-600"
          : "text-gray-900";
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${colorClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
