"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  priceProtectionPlan,
  generateTierComparison,
  TERM_OPTIONS,
  type PricingResult,
  type TierRow,
} from "@/lib/pricing-engine";
import { lookupPrice, type LocalPriceResult } from "@/lib/gas-prices";
import { searchAddresses, isNonUsAddress, type AddressResult } from "@/lib/address-search";

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

/** Shield + gas nozzle logo used in nav and footer */
function PumpLockLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      {/* Shield body */}
      <path d="M14 2 L4 7 L4 18 C4 24 14 30 14 30 C14 30 24 24 24 18 L24 7 Z" fill="#059669" />
      {/* Fuel drop inside shield */}
      <path d="M14 10 C14 10 10 15 10 18 C10 20.2 11.8 22 14 22 C16.2 22 18 20.2 18 18 C18 15 14 10 14 10Z" fill="white" opacity="0.9" />
      {/* Gas nozzle handle */}
      <rect x="24" y="9" width="3.5" height="2.5" rx="0.5" fill="#059669" />
      {/* Hose curving down */}
      <path d="M27.5 11.5 C27.5 11.5 29 11.5 29 13.5 L29 21" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
      {/* Nozzle tip */}
      <path d="M27.5 21 L30.5 21 L30.5 25 L29.5 26.5 L28.5 25 L27.5 25 Z" fill="#059669" />
    </svg>
  );
}

export default function Home() {
  const topRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<HTMLDivElement>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  // Calculator state
  const [calcStep, setCalcStep] = useState(1);
  const [locationQuery, setLocationQuery] = useState("");
  const [addressResults, setAddressResults] = useState<AddressResult[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [nonUsError, setNonUsError] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null);
  const [localPrice, setLocalPrice] = useState<LocalPriceResult | null>(null);
  const [monthlyGallons, setMonthlyGallons] = useState(50);
  const [strikePrice, setStrikePrice] = useState(0);
  const [selectedTerm, setSelectedTerm] = useState(6);
  const [result, setResult] = useState<PricingResult | null>(null);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // WHY: Debounce address lookups to respect Nominatim 1 req/sec rate limit
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAddressSearch = useCallback((query: string) => {
    setLocationQuery(query);
    setNonUsError(false);
    setSelectedAddress(null);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (query.trim().length < 3) {
      setAddressResults([]);
      setShowDropdown(false);
      return;
    }

    setAddressLoading(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await searchAddresses(query);
        if (results.length > 0) {
          setAddressResults(results);
          setShowDropdown(true);
          setNonUsError(false);
        } else {
          setAddressResults([]);
          // Check if it's a non-US address
          const isNonUs = await isNonUsAddress(query);
          setNonUsError(isNonUs);
          setShowDropdown(false);
        }
      } catch {
        setAddressResults([]);
      } finally {
        setAddressLoading(false);
      }
    }, 600); // WHY: 600ms debounce balances responsiveness with Nominatim rate limit
  }, []);

  function handleSelectAddress(addr: AddressResult) {
    setSelectedAddress(addr);
    setLocationQuery(addr.displayName);
    setShowDropdown(false);
    setNonUsError(false);
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function scrollToTop() {
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function scrollToCalculator() {
    calculatorRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleLocationSubmit() {
    // Use selected address city/state, or fall back to raw query
    let q = "national";
    if (selectedAddress) {
      // WHY: Try city first for metro-level pricing, fall back to state code
      q = selectedAddress.city || selectedAddress.stateCode;
    } else if (locationQuery.trim()) {
      q = locationQuery.trim();
    }
    const price = lookupPrice(q);
    // WHY: If city didn't match a metro, try state code for state-level pricing
    if (price.source === "national" && selectedAddress?.stateCode) {
      const statePrice = lookupPrice(selectedAddress.stateCode);
      if (statePrice.source === "state") {
        setLocalPrice(statePrice);
        setStrikePrice(Math.round((statePrice.price + 0.50) * 100) / 100);
        setCalcStep(2);
        return;
      }
    }
    setLocalPrice(price);
    setStrikePrice(Math.round((price.price + 0.50) * 100) / 100);
    setCalcStep(2);
  }

  function handleGallonsSubmit() {
    setCalcStep(3);
  }

  function computeQuote(termMonths: number) {
    if (!localPrice) return;
    const currentMonth = new Date().getMonth() + 1;
    const pricingResult = priceProtectionPlan({
      spotPrice: localPrice.price,
      strikePrice,
      gallonsPerMonth: monthlyGallons,
      volatility: DEFAULT_VOLATILITY,
      riskFreeRate: DEFAULT_RISK_FREE_RATE,
      currentMonth,
      termMonths,
    });
    setResult(pricingResult);
    setTiers(
      generateTierComparison(
        localPrice.price,
        monthlyGallons,
        DEFAULT_VOLATILITY,
        DEFAULT_RISK_FREE_RATE,
        currentMonth,
        termMonths
      )
    );
  }

  function handleGetQuote() {
    computeQuote(selectedTerm);
    setCalcStep(4);
  }

  function handleTermChange(months: number) {
    setSelectedTerm(months);
    computeQuote(months);
  }

  function handleStartOver() {
    setCalcStep(1);
    setLocalPrice(null);
    setResult(null);
    setTiers([]);
    setLocationQuery("");
    setSelectedAddress(null);
    setAddressResults([]);
    setNonUsError(false);
    setMonthlyGallons(50);
    setSelectedTerm(6);
  }

  const faqs = [
    {
      q: "What is PumpLock?",
      a: "PumpLock is a gas price protection plan. You pay once upfront, and for the duration of your plan, if gas prices in your area rise above your locked-in max price, we pay you the difference for every gallon you buy.",
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
      q: "What plan lengths are available?",
      a: "We offer 1-month, 3-month, and 6-month plans. Longer plans have a lower per-month cost. All plans are prepaid upfront so we can hedge your coverage immediately.",
    },
    {
      q: "How is the price calculated?",
      a: "We use an adapted Black-Scholes options pricing model — the same math used by Wall Street and major airlines to price fuel hedges — calibrated to real-time gasoline futures and local market data.",
    },
  ];

  return (
    <div ref={topRef} className="min-h-screen bg-gray-50 text-gray-900">
      {/* ── Nav ── */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={scrollToTop} className="flex items-center gap-2 hover:opacity-80 transition">
            <PumpLockLogo className="w-8 h-8" />
            <span className="text-lg font-bold text-gray-900 tracking-tight">PumpLock</span>
          </button>
          <div className="hidden sm:flex items-center gap-6 text-sm text-gray-500">
            <a href="#how-it-works" className="hover:text-gray-900 transition">How It Works</a>
            <a href="#calculator" className="hover:text-gray-900 transition">Get a Quote</a>
            <a href="#faq" className="hover:text-gray-900 transition">FAQ</a>
          </div>
          <button
            onClick={scrollToCalculator}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition"
          >
            Get Protected
          </button>
        </div>
      </nav>

      {/* ── Hero (text + image) ── */}
      <section className="pt-28 pb-16 sm:pt-36 sm:pb-24 px-4 bg-gradient-to-b from-emerald-50 to-white">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          {/* Left: text */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 text-sm mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Protection plans available now
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-tight tracking-tight mb-6">
              Never Overpay for
              <br />
              <span className="text-emerald-600">Gas Again</span>
            </h1>
            <p className="text-lg text-gray-600 max-w-lg mb-8">
              Lock in your max price per gallon. If gas prices spike, we pay you the difference.
              One upfront payment. Choose 1, 3, or 6 months of protection.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={scrollToCalculator}
                className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold rounded-xl transition shadow-lg shadow-emerald-600/20"
              >
                Get Your Quote
              </button>
              <a
                href="#how-it-works"
                className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-700 text-lg font-semibold rounded-xl transition border border-gray-200 shadow-sm text-center"
              >
                Learn More
              </a>
            </div>
          </div>

          {/* Right: hero image */}
          <div className="relative hidden md:block">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-lg border border-emerald-200 relative">
              <Image
                src="/hero.jpg"
                alt="Driver filling up at the pump — protected by PumpLock"
                fill
                className="object-cover"
                sizes="(min-width: 768px) 50vw, 100vw"
                priority
              />
              {/* Emerald tint overlay to match brand */}
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-900/30 via-transparent to-emerald-600/10" />
              {/* Price protection badge */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-center">
                <div className="bg-white/90 backdrop-blur rounded-xl px-5 py-3 shadow-md flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-emerald-600" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-700">
                    You pay your locked price. <span className="font-semibold text-emerald-600">We cover the rest.</span>
                  </p>
                </div>
              </div>
            </div>
            {/* Photo credit — Unsplash license requires attribution */}
            <p className="text-[10px] text-gray-400 mt-2 text-right">
              Photo by <a href="https://unsplash.com/@enginakyurt" className="underline hover:text-gray-600" target="_blank" rel="noopener noreferrer">Engin Akyurt</a> on Unsplash
            </p>
          </div>
        </div>
      </section>

      {/* ── Example Savings ── */}
      <section className="py-16 px-4 border-t border-gray-200">
        <div className="max-w-5xl mx-auto">
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="text-center p-8 rounded-2xl bg-white border border-gray-200 shadow-sm">
              <p className="text-3xl font-black text-red-600 mb-2">$4.50</p>
              <p className="text-sm text-gray-500">Gas spikes to</p>
            </div>
            <div className="text-center p-8 rounded-2xl bg-white border border-gray-200 shadow-sm">
              <p className="text-3xl font-black text-gray-900 mb-2">$3.50</p>
              <p className="text-sm text-gray-500">Your locked max price</p>
            </div>
            <div className="text-center p-8 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-sm">
              <p className="text-3xl font-black text-emerald-600 mb-2">$1.00</p>
              <p className="text-sm text-emerald-700">We pay you per gallon</p>
            </div>
          </div>
          <p className="text-center text-gray-500 text-sm mt-6">
            That&apos;s $50 back on just one month of fill-ups for a typical driver.
          </p>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-20 px-4 bg-white border-t border-gray-200">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 text-center mb-4">
            How PumpLock Works
          </h2>
          <p className="text-gray-600 text-center mb-16 max-w-xl mx-auto">
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
                desc: "Choose the most you're willing to pay per gallon, how much gas you use, and your plan length.",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
              {
                step: "3",
                title: "Pay Once, Stay Protected",
                desc: "One upfront payment locks in your protection. If prices spike, we pay you the difference.",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto mb-4">
                  {item.icon}
                </div>
                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold mb-3">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Calculator ── */}
      <section id="calculator" ref={calculatorRef} className="py-20 px-4 bg-gray-50 border-t border-gray-200">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 text-center mb-2">
            Get Your Quote
          </h2>
          <p className="text-gray-600 text-center mb-10">
            See your personalized protection plan price in seconds.
          </p>

          {/* Progress */}
          <div className="flex gap-1 mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  s <= calcStep ? "bg-emerald-500" : "bg-gray-200"
                }`}
              />
            ))}
          </div>

          {/* Step 1: Location */}
          {calcStep === 1 && (
            <div className="space-y-6 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Where do you fill up?</h3>
                <p className="text-gray-500 text-sm">
                  Enter your home or work address below.
                </p>
              </div>
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Start typing your address..."
                    value={locationQuery}
                    onChange={(e) => handleAddressSearch(e.target.value)}
                    onFocus={() => addressResults.length > 0 && setShowDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setShowDropdown(false);
                        handleLocationSubmit();
                      }
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    autoFocus
                  />
                  {addressLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Address autocomplete dropdown */}
                {showDropdown && addressResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {addressResults.map((addr, i) => (
                      <button
                        key={`${addr.city}-${addr.stateCode}-${i}`}
                        onClick={() => handleSelectAddress(addr)}
                        className="w-full px-4 py-3 text-left hover:bg-emerald-50 transition flex items-center gap-3 border-b border-gray-100 last:border-b-0"
                      >
                        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-gray-400 shrink-0" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{addr.displayName}</p>
                          <p className="text-xs text-gray-500">{addr.state}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Non-US error */}
              {nonUsError && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <p className="text-sm text-amber-700">
                    Sorry, PumpLock is only available in the USA currently. We&apos;re working on expanding to more countries.
                  </p>
                </div>
              )}

              {/* Selected address confirmation */}
              {selectedAddress && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-emerald-600 shrink-0" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-emerald-700">
                    <span className="font-semibold">{selectedAddress.displayName}</span> — we&apos;ll use local gas prices for this area.
                  </p>
                </div>
              )}

              <button
                onClick={handleLocationSubmit}
                disabled={nonUsError}
                className={`w-full py-3 font-semibold rounded-xl transition ${
                  nonUsError
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                {selectedAddress
                  ? "Continue with this location"
                  : locationQuery.trim()
                    ? "Look up my area"
                    : "Use national average"}
              </button>
            </div>
          )}

          {/* Step 2: Gallons */}
          {calcStep === 2 && localPrice && (
            <div className="space-y-6 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">How much gas do you use?</h3>
                <p className="text-gray-500 text-sm">
                  {localPrice.areaName} average: <span className="text-gray-900 font-semibold">${localPrice.price.toFixed(2)}/gal</span>
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {GALLON_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setMonthlyGallons(preset.gallons)}
                    className={`p-3 rounded-xl border text-center transition ${
                      monthlyGallons === preset.gallons
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-200 bg-gray-50 hover:border-gray-300"
                    }`}
                  >
                    <p className={`text-lg font-bold ${monthlyGallons === preset.gallons ? "text-emerald-600" : "text-gray-900"}`}>
                      {preset.gallons}
                    </p>
                    <p className={`text-xs ${monthlyGallons === preset.gallons ? "text-emerald-600" : "text-gray-500"}`}>
                      gal/mo
                    </p>
                    <p className={`text-xs mt-1 ${monthlyGallons === preset.gallons ? "text-emerald-500" : "text-gray-400"}`}>
                      {preset.desc}
                    </p>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-2">
                  Or set your own: <span className="text-gray-900 font-semibold">{monthlyGallons} gal/month</span>
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
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition"
                >
                  Back
                </button>
                <button
                  onClick={handleGallonsSubmit}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Max Price */}
          {calcStep === 3 && localPrice && (
            <div className="space-y-6 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Set your price ceiling</h3>
                <p className="text-gray-500 text-sm">
                  Current average in {localPrice.areaName}: <span className="text-gray-900 font-semibold">${localPrice.price.toFixed(2)}/gal</span>.
                  What&apos;s the most you&apos;d want to pay?
                </p>
              </div>

              <div className="text-center py-4">
                <p className="text-5xl font-black text-gray-900 mb-1">
                  ${strikePrice.toFixed(2)}
                  <span className="text-lg text-gray-500 font-normal">/gal</span>
                </p>
                <p className="text-sm text-emerald-600">
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
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>${localPrice.price.toFixed(2)} (tighter = more protection)</span>
                  <span>${(localPrice.price + 3).toFixed(2)} (wider = lower price)</span>
                </div>
              </div>

              {strikePrice <= localPrice.price && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                  Your max is at or below the current average. You&apos;d start receiving payouts immediately, so the plan price will be higher.
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setCalcStep(2)}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition"
                >
                  Back
                </button>
                <button
                  onClick={handleGetQuote}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold rounded-xl transition"
                >
                  See My Price
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Quote */}
          {calcStep === 4 && result && localPrice && (
            <div className="space-y-6">
              {/* Term selector */}
              <div className="flex gap-2 bg-white border border-gray-200 rounded-xl p-1.5 shadow-sm">
                {TERM_OPTIONS.map((term) => (
                  <button
                    key={term.months}
                    onClick={() => handleTermChange(term.months)}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition ${
                      selectedTerm === term.months
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span className="block">{term.label}</span>
                    <span className={`block text-xs font-normal mt-0.5 ${
                      selectedTerm === term.months ? "text-emerald-100" : "text-gray-400"
                    }`}>
                      {term.desc}
                    </span>
                  </button>
                ))}
              </div>

              {/* Hero price card */}
              <div className="text-center p-8 sm:p-10 bg-gradient-to-b from-emerald-50 to-white border border-emerald-200 rounded-2xl shadow-sm">
                <p className="text-sm text-emerald-600 uppercase tracking-widest mb-3">
                  Your {result.policyMonths}-Month PumpLock Plan
                </p>
                <p className="text-6xl sm:text-7xl font-black text-gray-900 mb-2">
                  ${result.upfrontPrice.toFixed(2)}
                </p>
                <p className="text-gray-500">
                  One payment &middot; ~${result.monthlyEquivalent.toFixed(2)}/mo
                </p>
              </div>

              {/* Coverage details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Location</p>
                  <p className="text-gray-900 font-semibold mt-1">{localPrice.areaName}</p>
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Current Avg</p>
                  <p className="text-gray-900 font-semibold mt-1">${result.spotPrice.toFixed(2)}/gal</p>
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Your Max</p>
                  <p className="text-emerald-600 font-semibold mt-1">${result.strikePrice.toFixed(2)}/gal</p>
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Gallons Covered</p>
                  <p className="text-gray-900 font-semibold mt-1">{result.totalGallonsCovered}</p>
                </div>
              </div>

              {/* How the payout works */}
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <h4 className="text-sm font-semibold text-emerald-700 mb-2">How your payout works</h4>
                <p className="text-sm text-gray-700">
                  If gas hits <span className="text-gray-900 font-semibold">${(result.strikePrice + 1.00).toFixed(2)}/gal</span> and
                  your max is <span className="text-emerald-600 font-semibold">${result.strikePrice.toFixed(2)}</span>, we pay
                  you <span className="text-gray-900 font-semibold">$1.00 for every gallon</span> you buy&nbsp;&mdash;&nbsp;up
                  to {result.gallonsPerMonth} gallons per month.
                </p>
              </div>

              {/* Tier comparison */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                    Compare Protection Levels
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-xs uppercase tracking-wider">
                        <th className="px-5 py-3 text-left">Max Price</th>
                        <th className="px-5 py-3 text-right">Buffer</th>
                        <th className="px-5 py-3 text-right">{result.policyMonths}-Mo Plan</th>
                        <th className="px-5 py-3 text-right">~Per Month</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tiers.map((tier) => {
                        const isSelected = Math.abs(tier.strikePrice - result.strikePrice) < 0.01;
                        return (
                          <tr
                            key={tier.strikePrice}
                            className={`border-t border-gray-100 ${isSelected ? "bg-emerald-50" : ""}`}
                          >
                            <td className={`px-5 py-3 font-medium ${isSelected ? "text-emerald-600" : "text-gray-900"}`}>
                              ${tier.strikePrice.toFixed(2)}
                              {isSelected && <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Selected</span>}
                            </td>
                            <td className="px-5 py-3 text-right text-gray-500">+${tier.buffer.toFixed(2)}</td>
                            <td className={`px-5 py-3 text-right font-mono font-semibold ${isSelected ? "text-emerald-600" : "text-gray-900"}`}>
                              ${tier.upfrontPrice.toFixed(2)}
                            </td>
                            <td className="px-5 py-3 text-right text-gray-500">
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
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition"
                >
                  Start Over
                </button>
                <button className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold rounded-xl transition">
                  Get Protected &mdash; ${result.upfrontPrice.toFixed(2)}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 px-4 bg-white border-t border-gray-200">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
                >
                  <span className="font-semibold text-gray-900 pr-4">{faq.q}</span>
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
                  <div className="px-5 pb-4 text-gray-600 text-sm leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-20 px-4 bg-emerald-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Stop worrying about gas prices.
          </h2>
          <p className="text-emerald-100 text-lg mb-8">
            Lock in your max price today. Protection starts immediately.
          </p>
          <button
            onClick={scrollToCalculator}
            className="px-10 py-4 bg-white hover:bg-gray-50 text-emerald-700 text-lg font-bold rounded-xl transition shadow-lg"
          >
            Get Your Quote
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 bg-white py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <button onClick={scrollToTop} className="flex items-center gap-2 hover:opacity-80 transition">
            <PumpLockLogo className="w-6 h-6" />
            <span className="text-sm font-semibold text-gray-500">PumpLock</span>
          </button>
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} PumpLock. For illustration purposes. Not financial advice.
          </p>
          <div className="flex gap-4 text-xs text-gray-400">
            <a href="#" className="hover:text-gray-600 transition">Privacy</a>
            <a href="#" className="hover:text-gray-600 transition">Terms</a>
            <a href="#" className="hover:text-gray-600 transition">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
