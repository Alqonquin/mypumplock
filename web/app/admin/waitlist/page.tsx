"use client";

import { useEffect, useState } from "react";

interface WaitlistEntry {
  id: string;
  name: string;
  email: string;
  zip: string | null;
  cityState: string | null;
  stateCode: string | null;
  spotPrice: number | null;
  strikePrice: number | null;
  upfrontPrice: number | null;
  monthlyGallons: number | null;
  termDays: number | null;
  fuelType: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  createdAt: string;
}

interface WaitlistSummary {
  total: number;
  uniqueEmails: number;
  uniqueZips: number;
  avgUpfront: number;
  last7Days: number;
  last24Hours: number;
}

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [summary, setSummary] = useState<WaitlistSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/waitlist")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries || []);
        setSummary(data.summary);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-400 py-12 text-center">Loading waitlist...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Waitlist</h1>
        <span className="text-sm text-gray-500">{summary?.total ?? 0} total signups</span>
      </div>

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard label="Total Signups" value={String(summary.total)} />
          <KpiCard label="Last 24 Hours" value={String(summary.last24Hours)} color="emerald" />
          <KpiCard label="Last 7 Days" value={String(summary.last7Days)} color="emerald" />
          <KpiCard label="Unique Emails" value={String(summary.uniqueEmails)} />
          <KpiCard label="Unique Zips" value={String(summary.uniqueZips)} />
          <KpiCard
            label="Avg Quote"
            value={summary.avgUpfront > 0 ? `$${summary.avgUpfront.toFixed(2)}` : "--"}
          />
        </div>
      )}

      {/* Entries Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        {entries.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            No waitlist signups yet. Share the site to start collecting interest!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Location</th>
                  <th className="px-4 py-3 text-right">Gas Price</th>
                  <th className="px-4 py-3 text-right">Max Price</th>
                  <th className="px-4 py-3 text-right">Quote</th>
                  <th className="px-4 py-3 text-right">Gal/Mo</th>
                  <th className="px-4 py-3 text-left">Vehicle</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-medium">{e.name}</td>
                    <td className="px-4 py-3 text-gray-700">{e.email}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {e.cityState || e.stateCode || e.zip || "--"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 font-mono">
                      {e.spotPrice ? `$${e.spotPrice.toFixed(2)}` : "--"}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-mono font-medium">
                      {e.strikePrice ? `$${e.strikePrice.toFixed(2)}` : "--"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 font-mono">
                      {e.upfrontPrice ? `$${e.upfrontPrice.toFixed(2)}` : "--"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {e.monthlyGallons ? Math.round(e.monthlyGallons) : "--"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {e.vehicleMake && e.vehicleModel
                        ? `${e.vehicleMake} ${e.vehicleModel}`
                        : "--"}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleDateString()}{" "}
                      {new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  const colorClass = color === "emerald" ? "text-emerald-600" : "text-gray-900";
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}
