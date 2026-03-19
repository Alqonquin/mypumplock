"use client";

import { useState, useRef } from "react";
import {
  priceProtectionPlan,
  generateTierComparison,
  POLICY_TERM_MONTHS,
  type PricingResult,
  type TierRow,
} from "@/lib/pricing-engine";
import { lookupPrice, getAllMetros, type LocalPriceResult } from "@/lib/gas-prices";

// WHY: Normal volatility (40%) is the default for consumer-facing pricing.
// We don't expose volatility selection to end users — it's an internal lever.
const DEFAULT_VOLATILITY = 0.40;
const DEFAULT_RISK_FREE_RATE = 0.045;

const GALLON_PRESETS = [
  { label: "Light", gallons: 30, desc: "Short commute, sedan" },
  { label: "Average", gallons: 50, desc: "Typical driver" },
  { label: "Heavy", gallons: 80, desc: "Long commute, SUV/truck" },
  { label: "Road Warrior", gallons: 120, desc: "High mileage" },
];

export default function Home() {
  const calculatorRef = useRef<HTMLDivElement>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  // Calculator state
  const [calcStep, setCalcStep] = useState(1);
  const [locationQuery, setLocationQuery] = useState("");
  const [localPrice, setLocalPrice] = useState<LocalPriceResult | null>(null);
  const [monthlyGallons, setMonthlyGallons] = useState(50);
  const [strikePrice, setStrikePrice] = useState(0);
  const [result, setResult] = useState<PricingResult | null>(null);
  const [tiers, setTiers] = useState<TierRow[]>([]);

  function scrollToCalculator() {
    calculatorRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleLocationSubmit() {
    const q = locationQuery.trim() || "national";
    const price = lookupPrice(q);
    setLocalPrice(price);
    setStrikePrice(Math.round((price.price + 0.50) * 100) / 100);
    setCalcStep(2);
  }

  function handleGallonsSubmit() {
    setCalcStep(3);
  }

  function handleGetQuote() {
    if (!localPrice) return;
    const currentMonth = new Date().getMonth() + 1;
    const pricingResult = priceProtectionPlan({
      spotPrice: localPrice.price,
      strikePrice,
      gallonsPerMonth: monthlyGallons,
      volatility: DEFAULT_VOLATILITY,
      riskFreeRate: DEFAULT_RISK_FREE_RATE,
      currentMonth,
    });
    setResult(pricingResult);
    setTiers(
      generateTierComparison(
        localPrice.price,
        monthlyGallons,
        DEFAULT_VOLATILITY,
        DEFAULT_RISK_FREE_RATE,
        currentMonth
      )
    );
    setCalcStep(4);
  }

  function handleStartOver() {
    setCalcStep(1);
    setLocalPrice(null);
    setResult(null);
    setTiers([]);
    setLocationQuery("");
    setMonthlyGallons(50);
  }

  const faqs = [
    {
      q: "What is PumpLock?",
      a: "PumpLock is a gas price protection plan. You pay once upfront, and for the next 6 months, if gas prices in your area rise above your locked-in max price, we pay you the difference for every gallon you buy.",
    },
    {
      q: "How do I get paid when prices spike?",
      a: "When you fill up and the pump price exceeds your max, we automatically calculate the difference and deposit it to your linked account. No claims to file, no receipts to upload.",
    },
    {
      q: "Is this insurance?",
      a: "PumpLock is a price protection plan, not a traditional insurance product. We use financial instruments (fuel futures and options) to back every plan we sell, similar to how airlines hedge their fuel costs.",
    },
    {
      q: "What if gas prices go down?",
      a: "You pay the lower market price at the pump. Your PumpLock plan is there as a ceiling — you always pay whichever is less: the pump price or your locked max price.",
    },
    {
      q: "Can I cancel mid-plan?",
      a: "Plans are prepaid for 6 months and are non-refundable. This allows us to hedge your coverage upfront and keep prices low.",
    },
    {
      q: "How is the price calculated?",
      a: "We use an adapted Black-Scholes options pricing model — the same math used by Wall Street and major airlines to price fuel hedges — calibrated to real-time gasoline futures and local market data.",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* ── Nav ── */}
      <nav className="fixed top-0 w-full z-50 bg-gray-950/80 backdrop-blur-lg border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white tracking-tight">PumpLock</span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm text-gray-400">
            <a href="#how-it-works" className="hover:text-white transition">How It Works</a>
            <a href="#calculator" className="hover:text-white transition">Get a Quote</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </div>
          <button
            onClick={scrollToCalculator}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition"
          >
            Get Protected
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 sm:pt-40 sm:pb-28 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            6-month protection plans available now
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white leading-tight tracking-tight mb-6">
            Never Overpay for
            <br />
            <span className="text-emerald-400">Gas Again</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Lock in your max price per gallon. If gas prices spike, we pay you the difference.
            One upfront payment. 6 months of protection.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={scrollToCalculator}
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-bold rounded-xl transition shadow-lg shadow-emerald-500/20"
            >
              Get Your Quote
            </button>
            <a
              href="#how-it-works"
              className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white text-lg font-semibold rounded-xl transition"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* ── Example Savings ── */}
      <section className="py-16 px-4 border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="text-center p-8 rounded-2xl bg-gray-900 border border-gray-800">
              <p className="text-3xl font-black text-red-400 mb-2">$4.50</p>
              <p className="text-sm text-gray-400">Gas spikes to</p>
            </div>
            <div className="text-center p-8 rounded-2xl bg-gray-900 border border-gray-800">
              <p className="text-3xl font-black text-white mb-2">$3.50</p>
              <p className="text-sm text-gray-400">Your locked max price</p>
            </div>
            <div className="text-center p-8 rounded-2xl bg-emerald-900/30 border border-emerald-700">
              <p className="text-3xl font-black text-emerald-400 mb-2">$1.00</p>
              <p className="text-sm text-emerald-300/70">We pay you per gallon</p>
            </div>
          </div>
          <p className="text-center text-gray-500 text-sm mt-6">
            That&apos;s $50 back on just one month of fill-ups for a typical driver.
          </p>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-20 px-4 bg-gray-900/50 border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-4">
            How PumpLock Works
          </h2>
          <p className="text-gray-400 text-center mb-16 max-w-xl mx-auto">
            Three steps. No car inspections, no paperwork, no hassle.
          </p>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Enter Your Location",
                desc: "We pull the current average gas price in your area so your plan is priced to your local market.",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                ),
              },
              {
                step: "2",
                title: "Set Your Max Price",
                desc: "Choose the most you're willing to pay per gallon and how much gas you use each month.",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
              {
                step: "3",
                title: "Pay Once, Stay Protected",
                desc: "One upfront payment locks in your protection for 6 full months. If prices spike, we pay you the difference.",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-4">
                  {item.icon}
                </div>
                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold mb-3">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Calculator ── */}
      <section id="calculator" ref={calculatorRef} className="py-20 px-4 border-t border-gray-800/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-2">
            Get Your Quote
          </h2>
          <p className="text-gray-400 text-center mb-10">
            See your personalized protection plan price in seconds.
          </p>

          {/* Progress */}
          <div className="flex gap-1 mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  s <= calcStep ? "bg-emerald-500" : "bg-gray-800"
                }`}
              />
            ))}
          </div>

          {/* Step 1: Location */}
          {calcStep === 1 && (
            <div className="space-y-6 bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Where do you fill up?</h3>
                <p className="text-gray-400 text-sm">
                  We&apos;ll look up the average gas price in your area.
                </p>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="City (Miami) or state code (FL)..."
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLocationSubmit()}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  autoFocus
                />
                <div className="flex flex-wrap gap-2 mt-3">
                  {["Miami", "Houston", "LA", "Chicago", "NYC", "Atlanta"].map((city) => (
                    <button
                      key={city}
                      onClick={() => { setLocationQuery(city); }}
                      className="px-3 py-1 text-xs bg-gray-800 border border-gray-700 rounded-full text-gray-400 hover:text-white hover:border-gray-600 transition"
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleLocationSubmit}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition"
              >
                {locationQuery.trim() ? "Look up my area" : "Use national average"}
              </button>
            </div>
          )}

          {/* Step 2: Gallons */}
          {calcStep === 2 && localPrice && (
            <div className="space-y-6 bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">How much gas do you use?</h3>
                <p className="text-gray-400 text-sm">
                  {localPrice.areaName} average: <span className="text-white font-semibold">${localPrice.price.toFixed(2)}/gal</span>
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {GALLON_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setMonthlyGallons(preset.gallons)}
                    className={`p-3 rounded-xl border text-center transition ${
                      monthlyGallons === preset.gallons
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-gray-700 bg-gray-800 hover:border-gray-600"
                    }`}
                  >
                    <p className={`text-lg font-bold ${monthlyGallons === preset.gallons ? "text-emerald-400" : "text-white"}`}>
                      {preset.gallons}
                    </p>
                    <p className={`text-xs ${monthlyGallons === preset.gallons ? "text-emerald-400/70" : "text-gray-400"}`}>
                      gal/mo
                    </p>
                    <p className={`text-xs mt-1 ${monthlyGallons === preset.gallons ? "text-emerald-400/50" : "text-gray-500"}`}>
                      {preset.desc}
                    </p>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Or set your own: <span className="text-white font-semibold">{monthlyGallons} gal/month</span>
                  <span className="text-gray-500 ml-2">({monthlyGallons * POLICY_TERM_MONTHS} gal over 6 months)</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={200}
                  step={5}
                  value={monthlyGallons}
                  onChange={(e) => setMonthlyGallons(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCalcStep(1)}
                  className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl transition"
                >
                  Back
                </button>
                <button
                  onClick={handleGallonsSubmit}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Max Price */}
          {calcStep === 3 && localPrice && (
            <div className="space-y-6 bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Set your price ceiling</h3>
                <p className="text-gray-400 text-sm">
                  Current average in {localPrice.areaName}: <span className="text-white font-semibold">${localPrice.price.toFixed(2)}/gal</span>.
                  What&apos;s the most you&apos;d want to pay?
                </p>
              </div>

              <div className="text-center py-4">
                <p className="text-5xl font-black text-white mb-1">
                  ${strikePrice.toFixed(2)}
                  <span className="text-lg text-gray-400 font-normal">/gal</span>
                </p>
                <p className="text-sm text-emerald-400">
                  +${(strikePrice - localPrice.price).toFixed(2)} above current price
                </p>
              </div>

              <div>
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
                  <span>${localPrice.price.toFixed(2)} (tighter = more protection)</span>
                  <span>${(localPrice.price + 3).toFixed(2)} (wider = lower price)</span>
                </div>
              </div>

              {strikePrice <= localPrice.price && (
                <div className="p-3 bg-amber-900/20 border border-amber-800/50 rounded-xl text-sm text-amber-300">
                  Your max is at or below the current average. You&apos;d start receiving payouts immediately, so the plan price will be higher.
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setCalcStep(2)}
                  className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl transition"
                >
                  Back
                </button>
                <button
                  onClick={handleGetQuote}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-bold rounded-xl transition"
                >
                  See My Price
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Quote */}
          {calcStep === 4 && result && localPrice && (
            <div className="space-y-6">
              {/* Hero price card */}
              <div className="text-center p-8 sm:p-10 bg-gradient-to-b from-emerald-900/30 to-gray-900 border border-emerald-800/50 rounded-2xl">
                <p className="text-sm text-emerald-400 uppercase tracking-widest mb-3">
                  Your 6-Month PumpLock Plan
                </p>
                <p className="text-6xl sm:text-7xl font-black text-white mb-2">
                  ${result.upfrontPrice.toFixed(2)}
                </p>
                <p className="text-gray-400">
                  One payment &middot; ~${result.monthlyEquivalent.toFixed(2)}/mo
                </p>
              </div>

              {/* Coverage details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Location</p>
                  <p className="text-white font-semibold mt-1">{localPrice.areaName}</p>
                </div>
                <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Current Avg</p>
                  <p className="text-white font-semibold mt-1">${result.spotPrice.toFixed(2)}/gal</p>
                </div>
                <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Your Max</p>
                  <p className="text-emerald-400 font-semibold mt-1">${result.strikePrice.toFixed(2)}/gal</p>
                </div>
                <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Gallons Covered</p>
                  <p className="text-white font-semibold mt-1">{result.totalGallonsCovered}</p>
                </div>
              </div>

              {/* How the payout works */}
              <div className="p-5 bg-emerald-900/20 border border-emerald-800/40 rounded-xl">
                <h4 className="text-sm font-semibold text-emerald-400 mb-2">How your payout works</h4>
                <p className="text-sm text-gray-300">
                  If gas hits <span className="text-white font-semibold">${(result.strikePrice + 1.00).toFixed(2)}/gal</span> and
                  your max is <span className="text-emerald-400 font-semibold">${result.strikePrice.toFixed(2)}</span>, we pay
                  you <span className="text-white font-semibold">$1.00 for every gallon</span> you buy&nbsp;&mdash;&nbsp;up
                  to {result.gallonsPerMonth} gallons per month.
                </p>
              </div>

              {/* Tier comparison */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-800">
                  <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    Compare Protection Levels
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs uppercase tracking-wider">
                        <th className="px-5 py-3 text-left">Max Price</th>
                        <th className="px-5 py-3 text-right">Buffer</th>
                        <th className="px-5 py-3 text-right">6-Mo Plan</th>
                        <th className="px-5 py-3 text-right">~Per Month</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tiers.map((tier) => {
                        const isSelected = Math.abs(tier.strikePrice - result.strikePrice) < 0.01;
                        return (
                          <tr
                            key={tier.strikePrice}
                            className={`border-t border-gray-800 ${isSelected ? "bg-emerald-500/5" : ""}`}
                          >
                            <td className={`px-5 py-3 font-medium ${isSelected ? "text-emerald-400" : "text-white"}`}>
                              ${tier.strikePrice.toFixed(2)}
                              {isSelected && <span className="ml-2 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Selected</span>}
                            </td>
                            <td className="px-5 py-3 text-right text-gray-400">+${tier.buffer.toFixed(2)}</td>
                            <td className={`px-5 py-3 text-right font-mono font-semibold ${isSelected ? "text-emerald-400" : "text-white"}`}>
                              ${tier.upfrontPrice.toFixed(2)}
                            </td>
                            <td className="px-5 py-3 text-right text-gray-400">
                              ${tier.monthlyEquivalent.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleStartOver}
                  className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl transition"
                >
                  Start Over
                </button>
                <button className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-bold rounded-xl transition">
                  Get Protected &mdash; ${result.upfrontPrice.toFixed(2)}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 px-4 bg-gray-900/50 border-t border-gray-800/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/50 transition"
                >
                  <span className="font-semibold text-white pr-4">{faq.q}</span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${faqOpen === i ? "rotate-180" : ""}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {faqOpen === i && (
                  <div className="px-5 pb-4 text-gray-400 text-sm leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-20 px-4 border-t border-gray-800/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Stop worrying about gas prices.
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            Lock in your max price today. Protection starts immediately.
          </p>
          <button
            onClick={scrollToCalculator}
            className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-bold rounded-xl transition shadow-lg shadow-emerald-500/20"
          >
            Get Your Quote
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-800 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-400">PumpLock</span>
          </div>
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} PumpLock. For illustration purposes. Not financial advice.
          </p>
          <div className="flex gap-4 text-xs text-gray-500">
            <a href="#" className="hover:text-gray-300 transition">Privacy</a>
            <a href="#" className="hover:text-gray-300 transition">Terms</a>
            <a href="#" className="hover:text-gray-300 transition">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
