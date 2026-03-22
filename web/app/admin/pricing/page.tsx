"use client";

import { useEffect, useState } from "react";

interface PricingConfig {
  id: string;
  label: string | null;
  isActive: boolean;
  effectiveAt: string | null;
  volatility: number;
  riskFreeRate: number;
  operationalLoad: number;
  profitMargin: number;
  adverseSelectionLoad: number;
  seasonalAdjustments: Record<string, number> | null;
  createdBy: string | null;
  createdAt: string;
}

const FIELD_LABELS: Record<string, { label: string; hint: string; step: string; min: string; max: string }> = {
  volatility: { label: "Volatility (σ)", hint: "Gas price volatility. 0.40 = 40% annualized", step: "0.01", min: "0.05", max: "2.0" },
  riskFreeRate: { label: "Risk-Free Rate", hint: "Treasury rate. 0.045 = 4.5%", step: "0.005", min: "0", max: "0.2" },
  operationalLoad: { label: "Operational Load ($/gal)", hint: "Admin + claims processing per gallon", step: "0.01", min: "0", max: "0.50" },
  profitMargin: { label: "Profit Margin ($/gal)", hint: "Per-gallon profit target", step: "0.01", min: "0", max: "0.50" },
  adverseSelectionLoad: { label: "Adverse Selection", hint: "Multiplier on fair value. 0.10 = 10%", step: "0.01", min: "0", max: "1.0" },
};

export default function AdminPricingPage() {
  const [configs, setConfigs] = useState<PricingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    label: "",
    effectiveAt: "",
    volatility: 0.40,
    riskFreeRate: 0.045,
    operationalLoad: 0.05,
    profitMargin: 0.03,
    adverseSelectionLoad: 0.10,
  });

  useEffect(() => {
    fetch("/api/admin/pricing")
      .then((r) => r.json())
      .then((data) => {
        setConfigs(data);
        const active = data.find((c: PricingConfig) => c.isActive);
        if (active) {
          setForm({
            label: "",
            effectiveAt: "",
            volatility: active.volatility,
            riskFreeRate: active.riskFreeRate,
            operationalLoad: active.operationalLoad,
            profitMargin: active.profitMargin,
            adverseSelectionLoad: active.adverseSelectionLoad,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          effectiveAt: form.effectiveAt || null,
        }),
      });
      if (res.ok) {
        const newConfig = await res.json();
        setConfigs((prev) => [
          newConfig,
          ...prev.map((c) => ({ ...c, isActive: false })),
        ]);
        setMessage("Pricing config saved and activated");
      } else {
        setMessage("Failed to save pricing config");
      }
    } catch {
      setMessage("Failed to save pricing config");
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="text-gray-400 py-12 text-center">Loading pricing configs...</div>;
  }

  const activeConfig = configs.find((c) => c.isActive);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Pricing Controls</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Edit form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
            {activeConfig ? "Update Pricing" : "Set Initial Pricing"}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pricing Plan</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. Summer 2026 pricing"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date/Time</label>
              <input
                type="datetime-local"
                value={form.effectiveAt}
                onChange={(e) => setForm({ ...form, effectiveAt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">Leave blank to activate immediately</p>
            </div>

            {Object.entries(FIELD_LABELS).map(([key, meta]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{meta.label}</label>
                <input
                  type="number"
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: parseFloat(e.target.value) || 0 })}
                  step={meta.step}
                  min={meta.min}
                  max={meta.max}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-gray-400 mt-0.5">{meta.hint}</p>
              </div>
            ))}

            {message && (
              <div className={`p-3 rounded-lg text-sm ${message.includes("Failed") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                {message}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-semibold rounded-lg transition"
            >
              {saving ? "Saving..." : form.effectiveAt ? "Save & Schedule" : "Save & Activate"}
            </button>
          </div>
        </div>

        {/* History */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
            Config History
          </h2>
          <div className="space-y-3">
            {configs.map((config) => (
              <div
                key={config.id}
                className={`rounded-xl border p-4 ${config.isActive ? "bg-emerald-50 border-emerald-200" : "bg-white border-gray-200"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {config.isActive ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                        Active
                      </span>
                    ) : config.effectiveAt && new Date(config.effectiveAt) > new Date() ? (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                        Scheduled
                      </span>
                    ) : null}
                    <span className="text-sm font-medium text-gray-900">
                      {config.label || "Untitled"}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(config.createdAt).toLocaleString()}
                  </span>
                </div>
                {config.effectiveAt && (
                  <p className="text-xs text-amber-600 mb-1">
                    {new Date(config.effectiveAt) > new Date()
                      ? `Starts ${new Date(config.effectiveAt).toLocaleString()}`
                      : `Started ${new Date(config.effectiveAt).toLocaleString()}`}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400">Vol:</span>{" "}
                    <span className="font-mono">{(config.volatility * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Rate:</span>{" "}
                    <span className="font-mono">{(config.riskFreeRate * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Op:</span>{" "}
                    <span className="font-mono">${config.operationalLoad.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Profit:</span>{" "}
                    <span className="font-mono">${config.profitMargin.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Adv Sel:</span>{" "}
                    <span className="font-mono">{(config.adverseSelectionLoad * 100).toFixed(0)}%</span>
                  </div>
                  {config.createdBy && (
                    <div>
                      <span className="text-gray-400">By:</span>{" "}
                      <span>{config.createdBy}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {configs.length === 0 && (
              <p className="text-sm text-gray-400">No pricing configs yet. Save one to get started.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
