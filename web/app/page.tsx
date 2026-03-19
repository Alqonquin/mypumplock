"use client";

import { useState, useMemo } from "react";
import {
  priceProtectionPlan,
  generateTierComparison,
  POLICY_TERM_MONTHS,
  VOLATILITY_PRESETS,
  type PricingResult,
  type TierRow,
} from "@/lib/pricing-engine";
import {
  getUniqueMakes,
  getModelsForMake,
  getYearsForMakeModel,
  findVehicle,
  estimateMonthlyGallons,
  type VehicleSpec,
} from "@/lib/vehicles";
import { lookupPrice, getAllMetros, type LocalPriceResult } from "@/lib/gas-prices";

type Step = "location" | "vehicle" | "driving" | "protection" | "quote";

export default function Home() {
  // Step tracking
  const [step, setStep] = useState<Step>("location");

  // Location
  const [locationQuery, setLocationQuery] = useState("");
  const [localPrice, setLocalPrice] = useState<LocalPriceResult | null>(null);

  // Vehicle
  const [selectedMake, setSelectedMake] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [vehicle, setVehicle] = useState<VehicleSpec | null>(null);

  // Driving
  const [weeklyMiles, setWeeklyMiles] = useState(250);
  const [monthlyGallons, setMonthlyGallons] = useState(0);

  // Protection
  const [strikePrice, setStrikePrice] = useState(0);
  const [volatility, setVolatility] = useState<number>(VOLATILITY_PRESETS.normal.value);

  // Results
  const [result, setResult] = useState<PricingResult | null>(null);
  const [tiers, setTiers] = useState<TierRow[]>([]);

  const makes = useMemo(() => getUniqueMakes(), []);
  const models = useMemo(
    () => (selectedMake ? getModelsForMake(selectedMake) : []),
    [selectedMake]
  );
  const years = useMemo(
    () =>
      selectedMake && selectedModel
        ? getYearsForMakeModel(selectedMake, selectedModel)
        : [],
    [selectedMake, selectedModel]
  );
  const metros = useMemo(() => getAllMetros(), []);

  function handleLocationSubmit() {
    const q = locationQuery.trim() || "national";
    const result = lookupPrice(q);
    setLocalPrice(result);
    setStrikePrice(Math.round((result.price + 0.5) * 100) / 100);
    setStep("vehicle");
  }

  function handleVehicleSubmit() {
    if (!selectedMake || !selectedModel || !selectedYear) return;
    const v = findVehicle(selectedMake, selectedModel, selectedYear);
    if (!v) return;
    if (v.fuelType === "electric") {
      alert("Electric vehicles don't need gas price protection!");
      return;
    }
    setVehicle(v);
    const gal = estimateMonthlyGallons(v, weeklyMiles);
    setMonthlyGallons(gal);
    setStep("driving");
  }

  function handleDrivingSubmit() {
    if (!vehicle) return;
    const gal = estimateMonthlyGallons(vehicle, weeklyMiles);
    setMonthlyGallons(gal);
    setStep("protection");
  }

  function handleQuote() {
    if (!localPrice) return;
    const currentMonth = new Date().getMonth() + 1;
    const pricingResult = priceProtectionPlan({
      spotPrice: localPrice.price,
      strikePrice,
      gallonsPerMonth: monthlyGallons,
      volatility,
      riskFreeRate: 0.045,
      currentMonth,
    });
    setResult(pricingResult);

    const tierRows = generateTierComparison(
      localPrice.price,
      monthlyGallons,
      volatility,
      0.045,
      currentMonth
    );
    setTiers(tierRows);
    setStep("quote");
  }

  function handleStartOver() {
    setStep("location");
    setLocalPrice(null);
    setVehicle(null);
    setResult(null);
    setTiers([]);
    setSelectedMake("");
    setSelectedModel("");
    setSelectedYear(null);
    setLocationQuery("");
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Gas Price Shield
            </h1>
            <p className="text-sm text-gray-400">
              {POLICY_TERM_MONTHS}-month protection &middot; One payment &middot; Never overpay
            </p>
          </div>
          {step !== "location" && (
            <button
              onClick={handleStartOver}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Start over
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 w-full">
        {/* Progress */}
        <div className="flex gap-1 mb-8">
          {(["location", "vehicle", "driving", "protection", "quote"] as Step[]).map(
            (s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <=
                  ["location", "vehicle", "driving", "protection", "quote"].indexOf(step)
                    ? "bg-emerald-500"
                    : "bg-gray-800"
                }`}
              />
            )
          )}
        </div>

        {/* Step 1: Location */}
        {step === "location" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Where do you live?</h2>
              <p className="text-gray-400">
                We&apos;ll pull the average gas price for your area.
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Enter city (Miami) or state code (FL)..."
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLocationSubmit()}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                autoFocus
              />
              <p className="text-xs text-gray-500">
                Popular: Miami, Houston, Los Angeles, Chicago, New York, Atlanta, Denver
              </p>
            </div>

            <button
              onClick={handleLocationSubmit}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition"
            >
              {locationQuery.trim() ? "Look up gas prices" : "Use national average"}
            </button>
          </div>
        )}

        {/* Step 2: Vehicle */}
        {step === "vehicle" && localPrice && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">What do you drive?</h2>
              <p className="text-gray-400">
                {localPrice.areaName} avg: ${localPrice.price.toFixed(2)}/gal
              </p>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Make</label>
                <select
                  value={selectedMake}
                  onChange={(e) => {
                    setSelectedMake(e.target.value);
                    setSelectedModel("");
                    setSelectedYear(null);
                  }}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Select make...</option>
                  {makes.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {selectedMake && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      setSelectedModel(e.target.value);
                      setSelectedYear(null);
                    }}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Select model...</option>
                    {models.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedModel && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Year</label>
                  <select
                    value={selectedYear ?? ""}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Select year...</option>
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedYear && findVehicle(selectedMake, selectedModel, selectedYear) && (
                <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg">
                  <p className="text-white font-medium">
                    {selectedYear} {selectedMake} {selectedModel}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    Tank: {findVehicle(selectedMake, selectedModel, selectedYear)!.tankGallons} gal
                    &nbsp;&middot;&nbsp;
                    {findVehicle(selectedMake, selectedModel, selectedYear)!.combinedMpg} MPG
                    &nbsp;&middot;&nbsp;
                    {findVehicle(selectedMake, selectedModel, selectedYear)!.fuelType}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleVehicleSubmit}
              disabled={!selectedMake || !selectedModel || !selectedYear}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 3: Driving */}
        {step === "driving" && vehicle && localPrice && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">How much do you drive?</h2>
              <p className="text-gray-400">
                {vehicle.year} {vehicle.make} {vehicle.model} &middot; {vehicle.combinedMpg} MPG
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Weekly miles: <span className="text-white font-medium">{weeklyMiles}</span>
              </label>
              <input
                type="range"
                min={50}
                max={800}
                step={10}
                value={weeklyMiles}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setWeeklyMiles(v);
                  setMonthlyGallons(estimateMonthlyGallons(vehicle, v));
                }}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>50 mi</span>
                <span>800 mi</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-center">
                <p className="text-2xl font-bold text-white">
                  {estimateMonthlyGallons(vehicle, weeklyMiles)}
                </p>
                <p className="text-xs text-gray-400">gal/month</p>
              </div>
              <div className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-center">
                <p className="text-2xl font-bold text-white">
                  {Math.round(estimateMonthlyGallons(vehicle, weeklyMiles) * POLICY_TERM_MONTHS)}
                </p>
                <p className="text-xs text-gray-400">gal / 6 months</p>
              </div>
              <div className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-center">
                <p className="text-2xl font-bold text-white">
                  {vehicle.tankGallons > 0
                    ? (
                        estimateMonthlyGallons(vehicle, weeklyMiles) /
                        vehicle.tankGallons
                      ).toFixed(1)
                    : "0"}
                </p>
                <p className="text-xs text-gray-400">fills/month</p>
              </div>
            </div>

            <button
              onClick={handleDrivingSubmit}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 4: Protection Level */}
        {step === "protection" && localPrice && vehicle && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                Set your price ceiling
              </h2>
              <p className="text-gray-400">
                Current avg in {localPrice.areaName}: ${localPrice.price.toFixed(2)}/gal.
                What&apos;s the most you&apos;d want to pay?
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Max price:{" "}
                <span className="text-white text-lg font-bold">
                  ${strikePrice.toFixed(2)}/gal
                </span>
                <span className="text-gray-500 ml-2">
                  (+${(strikePrice - localPrice.price).toFixed(2)} buffer)
                </span>
              </label>
              <input
                type="range"
                min={Math.round(localPrice.price * 100)}
                max={Math.round((localPrice.price + 3) * 100)}
                step={5}
                value={Math.round(strikePrice * 100)}
                onChange={(e) => setStrikePrice(Number(e.target.value) / 100)}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>${localPrice.price.toFixed(2)} (current)</span>
                <span>${(localPrice.price + 3).toFixed(2)}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Market volatility
              </label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(VOLATILITY_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => setVolatility(preset.value)}
                    className={`p-2 rounded-lg border text-center transition text-sm ${
                      volatility === preset.value
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                        : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <p className="font-medium">{preset.label}</p>
                    <p className="text-xs opacity-70">{Math.round(preset.value * 100)}%</p>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleQuote}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-bold rounded-lg transition"
            >
              Get my quote
            </button>
          </div>
        )}

        {/* Step 5: Quote */}
        {step === "quote" && result && localPrice && vehicle && (
          <div className="space-y-6">
            {/* Hero price */}
            <div className="text-center p-8 bg-gradient-to-b from-emerald-900/30 to-gray-900 border border-emerald-800 rounded-2xl">
              <p className="text-sm text-emerald-400 uppercase tracking-wider mb-2">
                Your 6-Month Gas Price Shield
              </p>
              <p className="text-5xl font-black text-white mb-1">
                ${result.upfrontPrice.toFixed(2)}
              </p>
              <p className="text-gray-400">
                One payment &middot; ~${result.monthlyEquivalent.toFixed(2)}/mo equivalent
              </p>
            </div>

            {/* Coverage summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                <p className="text-sm text-gray-400">Vehicle</p>
                <p className="text-white font-medium">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </p>
              </div>
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                <p className="text-sm text-gray-400">Location</p>
                <p className="text-white font-medium">{localPrice.areaName}</p>
              </div>
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                <p className="text-sm text-gray-400">Current avg price</p>
                <p className="text-white font-medium">
                  ${result.spotPrice.toFixed(2)}/gal
                </p>
              </div>
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                <p className="text-sm text-gray-400">Your max price</p>
                <p className="text-white font-medium">
                  ${result.strikePrice.toFixed(2)}/gal
                </p>
              </div>
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                <p className="text-sm text-gray-400">Gallons covered</p>
                <p className="text-white font-medium">
                  {result.totalGallonsCovered} over 6 months
                </p>
              </div>
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                <p className="text-sm text-gray-400">Prob. of payout</p>
                <p className="text-white font-medium">
                  {(result.probabilityItm * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Per-gallon breakdown */}
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <h3 className="text-sm text-gray-400 mb-3 uppercase tracking-wider">
                Per-Gallon Premium Breakdown
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Black-Scholes fair value</span>
                  <span className="text-white font-mono">
                    ${result.fairValuePerGallon.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Adverse selection buffer</span>
                  <span className="text-white font-mono">
                    ${result.adverseSelectionPerGallon.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Operational cost</span>
                  <span className="text-white font-mono">
                    ${result.operationalLoadPerGallon.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Profit margin</span>
                  <span className="text-white font-mono">
                    ${result.profitMarginPerGallon.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-700 pt-2">
                  <span className="text-white font-semibold">Total per gallon</span>
                  <span className="text-emerald-400 font-mono font-bold">
                    ${result.totalPremiumPerGallon.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>

            {/* Risk metrics */}
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <h3 className="text-sm text-gray-400 mb-3 uppercase tracking-wider">
                Risk Metrics (Greeks)
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-400">Delta </span>
                  <span className="text-white font-mono">{result.delta.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Gamma </span>
                  <span className="text-white font-mono">{result.gamma.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Vega </span>
                  <span className="text-white font-mono">{result.vega.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Theta </span>
                  <span className="text-white font-mono">{result.theta.toFixed(4)}</span>
                </div>
              </div>
            </div>

            {/* Tier comparison */}
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <h3 className="text-sm text-gray-400 mb-3 uppercase tracking-wider">
                Other Protection Levels
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-left">
                      <th className="pb-2 pr-4">Max Price</th>
                      <th className="pb-2 pr-4 text-right">Buffer</th>
                      <th className="pb-2 pr-4 text-right">6-Mo Price</th>
                      <th className="pb-2 text-right">P(ITM)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((tier) => (
                      <tr
                        key={tier.strikePrice}
                        className={`border-t border-gray-800 ${
                          Math.abs(tier.strikePrice - result.strikePrice) < 0.01
                            ? "text-emerald-400 font-semibold"
                            : "text-gray-300"
                        }`}
                      >
                        <td className="py-2 pr-4">${tier.strikePrice.toFixed(2)}</td>
                        <td className="py-2 pr-4 text-right">+${tier.buffer.toFixed(2)}</td>
                        <td className="py-2 pr-4 text-right font-mono">
                          ${tier.upfrontPrice.toFixed(2)}
                        </td>
                        <td className="py-2 text-right">
                          {(tier.probabilityItm * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Break-even */}
            {result.totalPremiumPerGallon > 0 && (
              <div className="p-4 bg-amber-900/20 border border-amber-800/50 rounded-xl">
                <h3 className="text-sm text-amber-400 mb-1">Break-Even Analysis</h3>
                <p className="text-gray-300 text-sm">
                  Gas must exceed{" "}
                  <span className="text-white font-bold">
                    $
                    {(result.strikePrice + result.totalPremiumPerGallon).toFixed(
                      2
                    )}
                    /gal
                  </span>{" "}
                  for payouts to exceed your premium. That&apos;s a{" "}
                  {(
                    ((result.strikePrice +
                      result.totalPremiumPerGallon -
                      result.spotPrice) /
                      result.spotPrice) *
                    100
                  ).toFixed(1)}
                  % increase from today.
                </p>
              </div>
            )}

            <button
              onClick={handleStartOver}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition"
            >
              Start over with new inputs
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-800 py-4 text-center text-xs text-gray-500">
        Gas Price Shield &middot; Pricing powered by adapted Black-Scholes model &middot; For illustration purposes
      </footer>
    </div>
  );
}
