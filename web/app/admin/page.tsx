"use client";

import { useEffect, useState } from "react";

interface ExposureSummary {
  totalActivePlans: number;
  totalMaxExposure: number;
  totalPremiumCollected: number;
  premiumToExposureRatio: number;
  totalGallonsCovered: number;
}

interface MemberSummary {
  total: number;
}

export default function AdminDashboard() {
  const [exposure, setExposure] = useState<ExposureSummary | null>(null);
  const [members, setMembers] = useState<MemberSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/exposure").then((r) => r.json()),
      fetch("/api/admin/members").then((r) => r.json()),
    ])
      .then(([exp, mem]) => {
        setExposure(exp.summary);
        setMembers({ total: mem.total });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-400 py-12 text-center">Loading dashboard...</div>;
  }

  const cards = [
    {
      label: "Total Members",
      value: members?.total ?? 0,
      format: "number",
      color: "text-gray-900",
    },
    {
      label: "Active Plans",
      value: exposure?.totalActivePlans ?? 0,
      format: "number",
      color: "text-emerald-600",
    },
    {
      label: "Premium Collected",
      value: exposure?.totalPremiumCollected ?? 0,
      format: "currency",
      color: "text-emerald-600",
    },
    {
      label: "Max Exposure",
      value: exposure?.totalMaxExposure ?? 0,
      format: "currency",
      color: "text-amber-600",
    },
    {
      label: "Gallons Covered",
      value: exposure?.totalGallonsCovered ?? 0,
      format: "number",
      color: "text-gray-900",
    },
    {
      label: "Premium / Exposure",
      value: exposure?.premiumToExposureRatio ?? 0,
      format: "ratio",
      color: "text-gray-900",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>
              {card.format === "currency"
                ? `$${card.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : card.format === "ratio"
                  ? `${(card.value * 100).toFixed(1)}%`
                  : card.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
