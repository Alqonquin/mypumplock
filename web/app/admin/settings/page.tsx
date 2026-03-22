"use client";

import { useEffect, useState, useCallback } from "react";

interface AdminSettingsData {
  afterHoursBufferRate: number;
  signupsPaused: boolean;
  maxActivePlansPerUser: number;
  maxPurchasesPerDay: number;
  afterHoursVolumeCap: number;
  hedgeTriggerGallons: number;
  nearThresholdAlertPct: number;
}

interface StateSpreadData {
  id: string;
  stateCode: string;
  stateName: string;
  regularSpread: number;
  premiumSpread: number;
  dieselSpread: number;
  lastUpdated: string;
  source: string;
}

interface MarketStatus {
  isOpen: boolean;
  hoursSinceClose: number;
  currentBuffer: number;
  nextOpen: string;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminSettingsData | null>(null);
  const [stateSpreads, setStateSpreads] = useState<StateSpreadData[]>([]);
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editingSpread, setEditingSpread] = useState<string | null>(null);
  const [spreadEdit, setSpreadEdit] = useState<{ regular: string; premium: string; diesel: string }>({
    regular: "", premium: "", diesel: "",
  });

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      setSettings(data.settings);
      setStateSpreads(data.stateSpreads || []);
      setMarketStatus(data.marketStatus);
    } catch {
      setMessage("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function saveSettings(updates: Partial<AdminSettingsData>) {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateSettings", ...updates }),
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data.settings);
        setMessage("Settings saved");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(data.error || "Failed to save");
      }
    } catch {
      setMessage("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function seedSpreads() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seedStateSpreads" }),
      });
      const data = await res.json();
      setMessage(data.message || "Seeded");
      await loadData();
    } catch {
      setMessage("Failed to seed spreads");
    } finally {
      setSaving(false);
    }
  }

  async function saveSpread(stateCode: string) {
    setSaving(true);
    try {
      const existing = stateSpreads.find((s) => s.stateCode === stateCode);
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateStateSpread",
          stateCode,
          stateName: existing?.stateName || stateCode,
          regularSpread: parseFloat(spreadEdit.regular),
          premiumSpread: parseFloat(spreadEdit.premium),
          dieselSpread: parseFloat(spreadEdit.diesel),
        }),
      });
      if (res.ok) {
        setEditingSpread(null);
        setMessage("Spread updated");
        setTimeout(() => setMessage(""), 3000);
        await loadData();
      }
    } catch {
      setMessage("Failed to update spread");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-gray-400 py-12 text-center">Loading settings...</div>;
  }

  if (!settings) {
    return <div className="text-red-500 py-12 text-center">Failed to load settings</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        {message && (
          <span className={`text-sm font-medium ${message.includes("Failed") ? "text-red-600" : "text-emerald-600"}`}>
            {message}
          </span>
        )}
      </div>

      {/* Market Status Banner */}
      {marketStatus && (
        <div className={`rounded-xl border p-4 ${marketStatus.isOpen ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${marketStatus.isOpen ? "bg-emerald-500" : "bg-amber-500"}`} />
              <div>
                <p className="font-semibold text-gray-900">
                  CME Globex: {marketStatus.isOpen ? "Open" : "Closed"}
                </p>
                {!marketStatus.isOpen && (
                  <p className="text-sm text-gray-600">
                    Closed for {marketStatus.hoursSinceClose.toFixed(1)}h — buffer at {fmtPct(marketStatus.currentBuffer)} — reopens {marketStatus.nextOpen}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kill Switch */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Kill Switch</h2>
            <p className="text-sm text-gray-500 mt-1">
              Immediately pause all new plan purchases. Use during extreme market events.
            </p>
          </div>
          <button
            onClick={() => saveSettings({ signupsPaused: !settings.signupsPaused })}
            disabled={saving}
            className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition ${
              settings.signupsPaused
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {settings.signupsPaused ? "SIGNUPS PAUSED — Click to Resume" : "Signups Active"}
          </button>
        </div>
      </div>

      {/* Pricing Section */}
      <Section title="Pricing" description="After-hours buffer protects against gap risk when CME is closed">
        <SettingRow
          label="After-Hours Buffer Base Rate"
          description="Base rate for sqrt(time)-scaled buffer. 3% = $0.10 buffer on $3.23 RBOB after 24 hours."
          value={settings.afterHoursBufferRate}
          suffix="%"
          displayMultiplier={100}
          onChange={(v) => saveSettings({ afterHoursBufferRate: v / 100 })}
          disabled={saving}
        />
      </Section>

      {/* Membership Controls */}
      <Section title="Membership Controls" description="Rate limiting and anti-arbitrage protections">
        <SettingRow
          label="Max Active Plans Per User"
          description="Prevents individual arb. Default 2 covers a two-car household."
          value={settings.maxActivePlansPerUser}
          onChange={(v) => saveSettings({ maxActivePlansPerUser: Math.round(v) })}
          disabled={saving}
          step={1}
        />
        <SettingRow
          label="Purchases Per Day Per User"
          description="Rate limit to prevent rapid-fire purchases from bots."
          value={settings.maxPurchasesPerDay}
          onChange={(v) => saveSettings({ maxPurchasesPerDay: Math.round(v) })}
          disabled={saving}
          step={1}
        />
        <SettingRow
          label="After-Hours Volume Cap"
          description="Max new plans during any closed-market window, system-wide."
          value={settings.afterHoursVolumeCap}
          onChange={(v) => saveSettings({ afterHoursVolumeCap: Math.round(v) })}
          disabled={saving}
          step={1}
        />
      </Section>

      {/* Hedging */}
      <Section title="Hedging" description="Strike bucket pooling and trigger configuration">
        <SettingRow
          label="Hedge Trigger Threshold (gallons)"
          description="Global default. When a strike bucket hits this, it's ready for execution. 4,200 = 1 micro contract."
          value={settings.hedgeTriggerGallons}
          onChange={(v) => saveSettings({ hedgeTriggerGallons: Math.round(v) })}
          disabled={saving}
          step={100}
        />
        <SettingRow
          label="Near-Threshold Alert"
          description="Alert when a bucket reaches this % of the trigger. Default 80%."
          value={settings.nearThresholdAlertPct}
          suffix="%"
          displayMultiplier={100}
          onChange={(v) => saveSettings({ nearThresholdAlertPct: v / 100 })}
          disabled={saving}
        />
        <div className="flex items-center justify-between py-3 border-t border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-700">Contract Size</p>
            <p className="text-xs text-gray-400">CME micro RBOB/HO — fixed by exchange</p>
          </div>
          <p className="text-sm font-mono text-gray-500">4,200 gallons</p>
        </div>
      </Section>

      {/* State Spreads */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">State Retail Spreads</h2>
            <p className="text-sm text-gray-500 mt-1">
              $/gallon gap between wholesale futures and retail pump price. Updated quarterly from API/EIA data.
            </p>
          </div>
          {stateSpreads.length === 0 && (
            <button
              onClick={seedSpreads}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Seed Default Spreads
            </button>
          )}
        </div>

        {stateSpreads.length > 0 ? (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-3 py-2 text-left">State</th>
                  <th className="px-3 py-2 text-right">Regular</th>
                  <th className="px-3 py-2 text-right">Premium</th>
                  <th className="px-3 py-2 text-right">Diesel</th>
                  <th className="px-3 py-2 text-right">Updated</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stateSpreads.map((s) => (
                  <tr key={s.stateCode}>
                    <td className="px-3 py-2 text-gray-700 font-medium">
                      {s.stateCode} <span className="text-gray-400 font-normal">{s.stateName}</span>
                    </td>
                    {editingSpread === s.stateCode ? (
                      <>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={spreadEdit.regular}
                            onChange={(e) => setSpreadEdit({ ...spreadEdit, regular: e.target.value })}
                            className="w-20 text-right border rounded px-1 py-0.5 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={spreadEdit.premium}
                            onChange={(e) => setSpreadEdit({ ...spreadEdit, premium: e.target.value })}
                            className="w-20 text-right border rounded px-1 py-0.5 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={spreadEdit.diesel}
                            onChange={(e) => setSpreadEdit({ ...spreadEdit, diesel: e.target.value })}
                            className="w-20 text-right border rounded px-1 py-0.5 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-gray-400 text-xs">
                          {new Date(s.lastUpdated).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 text-right space-x-1">
                          <button
                            onClick={() => saveSpread(s.stateCode)}
                            disabled={saving}
                            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingSpread(null)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-right text-gray-700 font-mono">${s.regularSpread.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-gray-700 font-mono">${s.premiumSpread.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-gray-700 font-mono">${s.dieselSpread.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-gray-400 text-xs">
                          {new Date(s.lastUpdated).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => {
                              setEditingSpread(s.stateCode);
                              setSpreadEdit({
                                regular: s.regularSpread.toFixed(2),
                                premium: s.premiumSpread.toFixed(2),
                                diesel: s.dieselSpread.toFixed(2),
                              });
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Edit
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            No state spreads configured. Click &quot;Seed Default Spreads&quot; to populate from defaults.
          </p>
        )}
      </div>
    </div>
  );
}

// --- Reusable Components ---

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500 mt-1 mb-4">{description}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  value,
  onChange,
  disabled,
  suffix,
  displayMultiplier = 1,
  step = 0.1,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
  suffix?: string;
  displayMultiplier?: number;
  step?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");

  const displayVal = (value * displayMultiplier).toFixed(displayMultiplier > 1 ? 1 : 0);

  return (
    <div className="flex items-center justify-between py-3 border-t border-gray-100">
      <div className="pr-4">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            step={step}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            className="w-24 text-right border rounded px-2 py-1 text-sm"
            autoFocus
          />
          {suffix && <span className="text-sm text-gray-400">{suffix}</span>}
          <button
            onClick={() => {
              onChange(parseFloat(inputVal));
              setEditing(false);
            }}
            disabled={disabled}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setInputVal(displayVal);
            setEditing(true);
          }}
          className="text-sm font-mono text-gray-700 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition"
        >
          {displayVal}{suffix}
        </button>
      )}
    </div>
  );
}
