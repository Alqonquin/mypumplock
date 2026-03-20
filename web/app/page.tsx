"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
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
import { estimateMonthlyGallons } from "@/lib/vehicles";

// WHY: Normal volatility (40%) is the default for consumer-facing pricing.
// We don't expose volatility selection to end users — it's an internal lever.
const DEFAULT_VOLATILITY = 0.40;
const DEFAULT_RISK_FREE_RATE = 0.045;

const MILEAGE_PRESETS = [
  { label: "Light", miles: 500, desc: "Work from home" },
  { label: "Average", miles: 1000, desc: "Typical commuter" },
  { label: "Heavy", miles: 1500, desc: "Long commute" },
  { label: "Road Warrior", miles: 2500, desc: "Always on the road" },
];

import { PumpLockLogo } from "@/components/pumplock-logo";
import { PriceChartBg } from "@/components/price-chart-bg";

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
  const topRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<HTMLDivElement>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  // WHY: After signup redirect, create the plan that was stashed in sessionStorage
  useEffect(() => {
    if (!session) return;
    const pending = sessionStorage.getItem("pendingPlan");
    if (!pending) return;
    sessionStorage.removeItem("pendingPlan");

    fetch("/api/member/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: pending,
    }).then((res) => {
      if (res.ok) router.push("/account");
    });
  }, [session, router]);

  // Calculator state
  const [calcStep, setCalcStep] = useState(1);
  const [locationQuery, setLocationQuery] = useState("");
  const [addressResults, setAddressResults] = useState<AddressResult[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [nonUsError, setNonUsError] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null);
  const [localPrice, setLocalPrice] = useState<LocalPriceResult | null>(null);
  const [cityState, setCityState] = useState("");
  const [monthlyMiles, setMonthlyMiles] = useState(1000);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMake, setSelectedMake] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [makeOptions, setMakeOptions] = useState<string[]>([]);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [vehicleMpg, setVehicleMpg] = useState<number | null>(null);
  const [vehicleFuel, setVehicleFuel] = useState("");
  const [vehicleLoading, setVehicleLoading] = useState(false);
  // WHY: skipVehicle lets users who can't find their vehicle (old trucks,
  // fleet vehicles, etc.) enter monthly gallons directly instead of using MPG.
  const [skipVehicle, setSkipVehicle] = useState(false);
  const [manualGallons, setManualGallons] = useState(80);
  const [monthlyGallons, setMonthlyGallons] = useState(50);
  const [strikePrice, setStrikePrice] = useState(0);
  const [selectedTerm, setSelectedTerm] = useState(6);
  const [result, setResult] = useState<PricingResult | null>(null);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [tiers1mo, setTiers1mo] = useState<TierRow[]>([]);
  const [tiers3mo, setTiers3mo] = useState<TierRow[]>([]);

  // WHY: Fetch admin-controlled pricing config so changes in the admin panel
  // are reflected in consumer quotes without code changes.
  const [pricingVolatility, setPricingVolatility] = useState(DEFAULT_VOLATILITY);
  const [pricingRate, setPricingRate] = useState(DEFAULT_RISK_FREE_RATE);
  const [pricingOpLoad, setPricingOpLoad] = useState(0.05);
  const [pricingProfit, setPricingProfit] = useState(0.03);
  const [pricingAdvSel, setPricingAdvSel] = useState(0.10);

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((config) => {
        if (config) {
          setPricingVolatility(config.volatility);
          setPricingRate(config.riskFreeRate);
          setPricingOpLoad(config.operationalLoad);
          setPricingProfit(config.profitMargin);
          setPricingAdvSel(config.adverseSelectionLoad);
        }
      })
      .catch(() => {}); // Silently use defaults if fetch fails
  }, []);

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

  async function handleLocationSubmit() {
    const zip = locationQuery.replace(/\D/g, "");
    if (zip.length !== 5) return;

    // WHY: Fetch live AAA pricing and city name in parallel for speed.
    let livePrice: number | null = null;
    let stateCode = "";
    let city = "";
    let state = "";

    const [priceRes, geoRes] = await Promise.allSettled([
      fetch(`/api/gas-price?zip=${zip}`),
      fetch(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({
        postalcode: zip, country: "us", format: "json", addressdetails: "1", limit: "1",
      })}`, { headers: { "User-Agent": "PumpLock/1.0 (mypumplock.com)" } }),
    ]);

    // Extract live price from AAA
    if (priceRes.status === "fulfilled" && priceRes.value.ok) {
      const data = await priceRes.value.json();
      if (data.price) {
        livePrice = data.price;
        stateCode = data.stateCode || "";
      }
    }

    // Extract city/state from Nominatim
    if (geoRes.status === "fulfilled" && geoRes.value.ok) {
      const data = await geoRes.value.json();
      if (data.length > 0) {
        const addr = data[0].address;
        city = addr.city || addr.town || addr.village || addr.county || "";
        state = addr.state || "";
      }
    }

    // Use live price if available, otherwise fall back to hardcoded
    let finalPrice: number;
    let areaName: string;

    if (livePrice) {
      finalPrice = livePrice;
      areaName = stateCode;
    } else {
      const fallback = lookupPrice(zip);
      if (fallback.source === "national") return;
      finalPrice = fallback.price;
      areaName = fallback.areaName;
    }

    if (city && state) setCityState(`${city}, ${state}`);
    else if (state) setCityState(state);
    else setCityState(areaName);

    setLocalPrice({ price: finalPrice, areaName, source: "state" });
    setStrikePrice(Math.round((finalPrice + 0.50) * 100) / 100);
    setCalcStep(2);
  }


  function computeQuote(termMonths: number) {
    if (!localPrice) return;
    const currentMonth = new Date().getMonth() + 1;
    const pricingResult = priceProtectionPlan({
      spotPrice: localPrice.price,
      strikePrice,
      gallonsPerMonth: monthlyGallons,
      volatility: pricingVolatility,
      riskFreeRate: pricingRate,
      currentMonth,
      termMonths,
      operationalLoad: pricingOpLoad,
      profitMargin: pricingProfit,
      adverseSelectionLoad: pricingAdvSel,
    });
    setResult(pricingResult);
    const genTiers = (months: number) => generateTierComparison(
      localPrice.price, monthlyGallons, pricingVolatility, pricingRate, currentMonth, months
    );
    setTiers1mo(genTiers(1));
    setTiers3mo(genTiers(3));
    setTiers(genTiers(termMonths));
  }

  function handleGetQuote() {
    computeQuote(selectedTerm);
    setCalcStep(5);
  }

  function handleTermChange(months: number) {
    setSelectedTerm(months);
    computeQuote(months);
  }

  function handleStartOver() {
    setCalcStep(1);
    setLocalPrice(null);
    setCityState("");
    setResult(null);
    setTiers([]);
    setTiers1mo([]);
    setTiers3mo([]);
    setLocationQuery("");
    setSelectedAddress(null);
    setAddressResults([]);
    setNonUsError(false);
    setMonthlyMiles(1000);
    setSelectedYear("");
    setSelectedMake("");
    setSelectedModel("");
    setMakeOptions([]);
    setModelOptions([]);
    setVehicleMpg(null);
    setVehicleFuel("");
    setVehicleLoading(false);
    setSkipVehicle(false);
    setManualGallons(80);
    setMonthlyGallons(50);
    setSelectedTerm(6);
  }

  const faqs: { q: string; a: React.ReactNode }[] = [
    {
      q: "What is PumpLock?",
      a: 'PumpLock is a digital membership that shields your budget from rising gas prices. Think of it as a "Price Ceiling" for your car. You choose a Protection Price, and if the market average in your Zip Code rises above that number, we cover the difference for your monthly gallon tier.',
    },
    {
      q: "How do I get paid when prices spike?",
      a: (
        <>
          <p className="mb-3">We&apos;ve made it completely frictionless.</p>
          <p className="mb-2"><span className="font-semibold text-gray-900">Automatic Tracking:</span> We monitor the daily average price in your Zip Code using validated third-party data.</p>
          <p className="mb-2"><span className="font-semibold text-gray-900">Daily Accrual:</span> Every day the market is above your Protection Price, a &ldquo;Membership Benefit&rdquo; is added to your account.</p>
          <p><span className="font-semibold text-gray-900">Direct Payout:</span> At the end of the month, if your total benefit is $2.00 or more, we automatically credit your linked payment method. No receipts, no scanning, and no manual claims required.</p>
        </>
      ),
    },
    {
      q: "Is this insurance?",
      a: 'No. PumpLock is a service-based membership. Unlike insurance, we do not indemnify you for personal losses or require you to "prove" you bought gas. Your benefit is tied strictly to the publicly verifiable market index in your area. If the local average goes up, you earn a benefit, regardless of where or when you choose to fill up.',
    },
    {
      q: "What if gas prices go down?",
      a: 'If gas prices stay below your Protection Price, you\u2019ve had a great month! You simply pay the lower price at the pump and enjoy the savings. Your membership fee ensures that your "Price Shield" is always active, providing you with budget certainty even if the market stays stable.',
    },
    {
      q: "What plan lengths are available?",
      a: (
        <>
          <p className="mb-3">To help you lock in the best rates, we currently offer:</p>
          <p className="mb-2"><span className="font-semibold text-gray-900">Monthly Protection:</span> For those who want flexibility month-to-month.</p>
          <p className="mb-2"><span className="font-semibold text-gray-900">3-Month &ldquo;Quarterly&rdquo; Shield:</span> Our most popular plan, ideal for seasonal price surges (like summer travel).</p>
          <p><span className="font-semibold text-gray-900">6-Month &ldquo;Fixed&rdquo; Protection:</span> For maximum budget stability and the lowest per-month membership rates.</p>
        </>
      ),
    },
    {
      q: "How is the price calculated?",
      a: (
        <>
          <p className="mb-3">Your benefit is calculated using a simple, transparent formula:</p>
          <p className="mb-3 font-medium text-gray-900 bg-gray-50 rounded-lg px-4 py-2 text-center">
            (Actual Local Average &minus; Your Protection Price) &times; Your Daily Gallon Allocation = Your Daily Benefit
          </p>
          <p>We sum up these daily wins over the course of the month to determine your total payout. We use hyper-local data for your specific Zip Code, ensuring your protection matches the prices you see at your neighborhood stations.</p>
        </>
      ),
    },
  ];

  // WHY: When user clicks "Get Protected", either create the plan (if logged in)
  // or redirect to signup with a callback that creates it after auth.
  async function handleGetProtected() {
    if (!result || !localPrice) return;

    const planData = {
      spotPrice: localPrice.price,
      strikePrice: result.strikePrice,
      termMonths: selectedTerm,
      gallonsPerMonth: monthlyGallons,
      premiumPerGallon: result.totalPremiumPerGallon,
      upfrontPrice: result.upfrontPrice,
      monthlyEquivalent: result.monthlyEquivalent,
      vehicleYear: selectedYear ? parseInt(selectedYear) : null,
      vehicleMake: selectedMake || null,
      vehicleModel: selectedModel || null,
      vehicleMpg: vehicleMpg,
      monthlyMiles: monthlyMiles,
      fuelType: vehicleFuel || null,
      zip: locationQuery.replace(/\D/g, ""),
      cityState: cityState || null,
      stateCode: localPrice.areaName || null,
    };

    if (!session) {
      // Store plan data in sessionStorage so we can create it after signup
      sessionStorage.setItem("pendingPlan", JSON.stringify(planData));
      router.push("/signup?callbackUrl=/");
      return;
    }

    try {
      const res = await fetch("/api/member/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planData),
      });

      if (res.ok) {
        router.push("/account");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create plan");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    }
  }

  return (
    <div ref={topRef} className="min-h-screen bg-gray-50 text-gray-900">
      {/* ── Nav ── */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={scrollToTop} className="flex items-center gap-2 hover:opacity-80 transition">
            <PumpLockLogo className="w-8 h-8" />
            <span className="text-lg font-bold text-gray-900 tracking-tight">PumpLock</span>
          </button>
          <div className="hidden sm:flex items-center gap-1 text-sm font-medium text-gray-600">
            <a href="#how-it-works" className="px-4 py-2 rounded-full hover:bg-emerald-50 hover:text-emerald-700 transition">How It Works</a>
            <span className="text-gray-300">·</span>
            <a href="#calculator" className="px-4 py-2 rounded-full hover:bg-emerald-50 hover:text-emerald-700 transition">Get a Quote</a>
            <span className="text-gray-300">·</span>
            <a href="#faq" className="px-4 py-2 rounded-full hover:bg-emerald-50 hover:text-emerald-700 transition">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            {session ? (
              <a
                href="/account"
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-emerald-700 rounded-full hover:bg-emerald-50 transition"
              >
                My Account
              </a>
            ) : (
              <button
                onClick={() => signIn()}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-emerald-700 rounded-full hover:bg-emerald-50 transition"
              >
                Log In
              </button>
            )}
            <button
              onClick={scrollToCalculator}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition"
            >
              Get Protected
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero (text + image) ── */}
      <section className="pt-28 pb-16 sm:pt-36 sm:pb-24 px-4 bg-gradient-to-b from-emerald-50 to-white">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          {/* Left: text */}
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-tight tracking-tight mb-4">
              Never Overpay for
              <br />
              <span className="text-emerald-600">Gas Again</span>
            </h1>
            <p className="text-lg text-gray-600 max-w-lg mb-8">
              The first smart membership that caps the price you pay at the pump.
              We track your local price and pay you back when fuel costs rise.
              Choose the protection that fits you and lock in your gas price today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={scrollToCalculator}
                className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold rounded-xl transition shadow-lg shadow-emerald-600/20"
              >
                Join Now
              </button>
              <a
                href="#how-it-works"
                className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-700 text-lg font-semibold rounded-xl transition border border-gray-200 shadow-sm text-center"
              >
                Learn More
              </a>
            </div>
          </div>

          {/* Right: hero image — edges fade into background via CSS mask */}
          <div className="relative hidden md:block">
            <div className="aspect-[4/3] relative">
              <Image
                src="/hero.jpg"
                alt="Driver filling up at the pump — protected by PumpLock"
                fill
                className="object-cover"
                sizes="(min-width: 768px) 50vw, 100vw"
                priority
                style={{
                  /* WHY: A radial-gradient mask fades all edges to transparent smoothly,
                     eliminating any visible border between the photo and the background. */
                  mask: "radial-gradient(ellipse 77% 72% at center, black 30%, transparent 75%)",
                  WebkitMask: "radial-gradient(ellipse 77% 72% at center, black 30%, transparent 75%)",
                }}
              />
            </div>
            {/* WHY: Badge positioned to align with the CTA buttons on the left column. */}
            <div className="absolute bottom-8 left-4 right-4 flex justify-center">
              <div className="bg-white/90 backdrop-blur rounded-xl px-5 py-3 shadow-md flex items-center gap-3">
                <PumpLockLogo className="w-8 h-8 shrink-0" />
                <p className="text-sm text-gray-700">
                  You pay your locked price. <span className="font-semibold text-emerald-600">We cover the rest.</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Example Savings ── */}
      <section className="relative py-20 px-4 border-t border-gray-200 overflow-hidden">
        {/* Background video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/pump-counter.mp4" type="video/mp4" />
        </video>
        {/* WHY: Dark overlay so the white text and cards remain legible over the video. */}
        <div className="absolute inset-0 bg-gray-900/75" />

        <div className="relative max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-white text-center mb-10">
            When Gas Prices Go Up, Your Price Doesn&apos;t
          </h2>
          {/* Your plan card */}
          <div className="text-center px-8 py-5 rounded-2xl bg-white/10 border border-white/20 backdrop-blur max-w-sm mx-auto mb-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1">My 3 Month PumpLock Max Price</p>
            <p className="text-4xl font-black text-white">$3.50<span className="text-lg font-semibold text-gray-300">/gal</span></p>
            <p className="text-xs text-gray-400 mt-1">100 gallons per month</p>
          </div>

          {/* Month-by-month breakdown */}
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {/* Month 1 */}
            <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur px-6 py-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <span className="text-sm font-bold text-white">Month <span className="text-lg">1</span> of 3</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">rising</span>
              </div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm text-gray-300">Avg pump price</span>
                <span className="text-lg font-bold text-red-400">$3.75</span>
              </div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm text-gray-300">Overage/gal</span>
                <span className="text-lg font-bold text-white">$0.25</span>
              </div>
              <div className="border-t border-white/10 mt-3 pt-3 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-emerald-300">Your payout</span>
                <span className="text-2xl font-black text-emerald-400">$25</span>
              </div>
            </div>
            {/* Month 2 */}
            <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur px-6 py-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <span className="text-sm font-bold text-white">Month <span className="text-lg">2</span> of 3</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-yellow-500">climbing</span>
              </div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm text-gray-300">Avg pump price</span>
                <span className="text-lg font-bold text-red-400">$4.00</span>
              </div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm text-gray-300">Overage/gal</span>
                <span className="text-lg font-bold text-white">$0.50</span>
              </div>
              <div className="border-t border-white/10 mt-3 pt-3 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-emerald-300">Your payout</span>
                <span className="text-2xl font-black text-emerald-400">$50</span>
              </div>
            </div>
            {/* Month 3 */}
            <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur px-6 py-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <span className="text-sm font-bold text-white">Month <span className="text-lg">3</span> of 3</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">spiking</span>
              </div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm text-gray-300">Avg pump price</span>
                <span className="text-lg font-bold text-red-400">$4.25</span>
              </div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm text-gray-300">Overage/gal</span>
                <span className="text-lg font-bold text-white">$0.75</span>
              </div>
              <div className="border-t border-white/10 mt-3 pt-3 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-emerald-300">Your payout</span>
                <span className="text-2xl font-black text-emerald-400">$75</span>
              </div>
            </div>
          </div>

          {/* Total savings */}
          <div className="text-center px-8 py-5 rounded-2xl bg-emerald-950/60 border-2 border-emerald-400/50 backdrop-blur max-w-sm mx-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300 mb-1">Total savings over 3 months</p>
            <p className="text-5xl font-black text-emerald-400">$150</p>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative py-20 px-4 border-t border-gray-200 overflow-hidden">
        {/* Background video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/driving.mp4" type="video/mp4" />
        </video>
        {/* WHY: Light overlay keeps cards legible while letting the driving video show through. */}
        <div className="absolute inset-0 bg-white/85 backdrop-blur-sm" />

        <div className="relative max-w-5xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600 text-center mb-2">Get protected in minutes</p>
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 text-center mb-4">
            How PumpLock Works
          </h2>
          <p className="text-gray-500 text-center mb-16 max-w-lg mx-auto">
            No car inspections. No paperwork. No hassle.
          </p>

          <div className="grid sm:grid-cols-3 gap-6 relative">
            {/* WHY: Connecting line between steps visible on desktop only,
                gives a timeline feel linking the three cards together. */}
            <div className="hidden sm:block absolute top-12 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-amber-200 via-amber-300 to-amber-200" />

            {/* Step 1 */}
            <div className="relative bg-white/90 backdrop-blur rounded-2xl border border-gray-200 p-8 text-center hover:shadow-lg hover:border-amber-200 transition-all duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-600/20">
                <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>
              <span className="inline-block text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 mb-3">Step 1</span>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Enter Your Location</h3>
              <p className="text-gray-500 text-sm leading-relaxed">We pull the current average gas price in your area so your plan is priced to your local market.</p>
            </div>

            {/* Step 2 */}
            <div className="relative bg-white/90 backdrop-blur rounded-2xl border border-gray-200 p-8 text-center hover:shadow-lg hover:border-amber-200 transition-all duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-600/20">
                <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="inline-block text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 mb-3">Step 2</span>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Set Your Max Price</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Choose the most you&apos;re willing to pay per gallon, how much gas you use, and your plan length.</p>
            </div>

            {/* Step 3 */}
            <div className="relative bg-white/90 backdrop-blur rounded-2xl border border-gray-200 p-8 text-center hover:shadow-lg hover:border-amber-200 transition-all duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-600/20">
                <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <span className="inline-block text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 mb-3">Step 3</span>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Pay Once, Stay Protected</h3>
              <p className="text-gray-500 text-sm leading-relaxed">One upfront payment locks in your protection. If prices spike, we pay you the difference each month.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Calculator ── */}
      <section id="calculator" ref={calculatorRef} className="relative py-20 px-4 bg-gray-50 border-t border-gray-200 overflow-hidden">
        <PriceChartBg step={calcStep} />
        <div className="relative max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 text-center mb-2">
            Get Your Quote
          </h2>
          <p className="text-gray-600 text-center mb-10">
            See your personalized protection plan price in seconds.
          </p>

          {/* Progress */}
          <div className="flex gap-1 mb-8">
            {[1, 2, 3, 4, 5].map((s) => (
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
                  Enter your zip code to get local gas prices.
                </p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="e.g. 90210"
                value={locationQuery}
                onChange={(e) => {
                  // WHY: Only allow digits so the input stays clean
                  const val = e.target.value.replace(/\D/g, "");
                  setLocationQuery(val);
                  setNonUsError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLocationSubmit();
                }}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />

              <button
                onClick={handleLocationSubmit}
                disabled={locationQuery.length !== 5}
                className={`px-5 py-2 text-sm font-semibold rounded-lg transition ${
                  locationQuery.length === 5
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                Next
              </button>
            </div>
          )}

          {/* Step 2: Vehicle Picker */}
          {calcStep === 2 && localPrice && (
            <div className="space-y-6 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">What do you drive?</h3>
                <p className="text-gray-500 text-sm">
                  {cityState || localPrice.areaName} — avg: <span className="text-gray-900 font-semibold">${localPrice.price.toFixed(2)}/gal</span>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Year */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
                  <select
                    value={selectedYear}
                    onChange={async (e) => {
                      const yr = e.target.value;
                      setSelectedYear(yr);
                      setSelectedMake("");
                      setSelectedModel("");
                      setMakeOptions([]);
                      setModelOptions([]);
                      setVehicleMpg(null);
                      setVehicleFuel("");
                      if (!yr) return;
                      setVehicleLoading(true);
                      try {
                        const res = await fetch(`/api/vehicles?step=makes&year=${yr}`);
                        const data = await res.json();
                        const items = Array.isArray(data.menuItem) ? data.menuItem : data.menuItem ? [data.menuItem] : [];
                        setMakeOptions(items.map((i: { text: string }) => i.text));
                      } catch { setMakeOptions([]); }
                      setVehicleLoading(false);
                    }}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Select year...</option>
                    {Array.from({ length: new Date().getFullYear() - 1999 + 1 }, (_, i) => new Date().getFullYear() + 1 - i).map((yr) => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>
                {/* Make */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Make</label>
                  <select
                    value={selectedMake}
                    onChange={async (e) => {
                      const make = e.target.value;
                      setSelectedMake(make);
                      setSelectedModel("");
                      setModelOptions([]);
                      setVehicleMpg(null);
                      setVehicleFuel("");
                      if (!make || !selectedYear) return;
                      setVehicleLoading(true);
                      try {
                        const res = await fetch(`/api/vehicles?step=models&year=${selectedYear}&make=${encodeURIComponent(make)}`);
                        const data = await res.json();
                        const items = Array.isArray(data.menuItem) ? data.menuItem : data.menuItem ? [data.menuItem] : [];
                        setModelOptions(items.map((i: { text: string }) => i.text));
                      } catch { setModelOptions([]); }
                      setVehicleLoading(false);
                    }}
                    disabled={!selectedYear || makeOptions.length === 0}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                  >
                    <option value="">{vehicleLoading ? "Loading..." : "Select make..."}</option>
                    {makeOptions.map((make) => (
                      <option key={make} value={make}>{make}</option>
                    ))}
                  </select>
                </div>
                {/* Model */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Model</label>
                  <select
                    value={selectedModel}
                    onChange={async (e) => {
                      const model = e.target.value;
                      setSelectedModel(model);
                      setVehicleMpg(null);
                      setVehicleFuel("");
                      if (!model || !selectedYear || !selectedMake) return;
                      setVehicleLoading(true);
                      try {
                        const optRes = await fetch(`/api/vehicles?step=options&year=${selectedYear}&make=${encodeURIComponent(selectedMake)}&model=${encodeURIComponent(model)}`);
                        const optData = await optRes.json();
                        const options = Array.isArray(optData.menuItem) ? optData.menuItem : optData.menuItem ? [optData.menuItem] : [];
                        if (options.length > 0) {
                          const vehRes = await fetch(`/api/vehicles?step=vehicle&id=${options[0].value}`);
                          const vehData = await vehRes.json();
                          const mpg = parseInt(vehData.comb08);
                          if (!isNaN(mpg) && mpg > 0) {
                            setVehicleMpg(mpg);
                            setVehicleFuel(vehData.fuelType1 || "");
                          }
                        }
                      } catch { /* non-critical */ }
                      setVehicleLoading(false);
                    }}
                    disabled={!selectedMake || modelOptions.length === 0}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                  >
                    <option value="">{vehicleLoading ? "Loading..." : "Select model..."}</option>
                    {modelOptions.map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
              </div>

              {vehicleMpg && vehicleMpg > 0 && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-sm text-gray-600">
                    {selectedYear} {selectedMake} {selectedModel} — <span className="font-bold text-emerald-600">{vehicleMpg} MPG</span> ({vehicleFuel})
                  </p>
                </div>
              )}

              {vehicleLoading && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  Loading vehicle data...
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCalcStep(1)}
                  className="px-5 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    setSkipVehicle(false);
                    setCalcStep(3);
                  }}
                  disabled={!vehicleMpg}
                  className={`px-5 py-2 text-sm font-semibold rounded-lg transition ${
                    vehicleMpg
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  Next
                </button>
                <button
                  onClick={() => {
                    setSkipVehicle(true);
                    setManualGallons(80);
                    setCalcStep(3);
                  }}
                  className="ml-auto text-sm text-gray-400 hover:text-emerald-600 transition"
                >
                  Skip &mdash; enter gallons instead
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Monthly Miles (vehicle selected) OR Monthly Gallons (skipped) */}
          {calcStep === 3 && localPrice && (
            <div className="space-y-6 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              {!skipVehicle ? (
                <>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">How many miles do you drive per month?</h3>
                    <p className="text-gray-500 text-sm">
                      {selectedYear} {selectedMake} {selectedModel} — {vehicleMpg} MPG
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {MILEAGE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => setMonthlyMiles(preset.miles)}
                        className={`p-3 rounded-xl border text-center transition ${
                          monthlyMiles === preset.miles
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-gray-200 bg-gray-50 hover:border-gray-300"
                        }`}
                      >
                        <p className={`text-lg font-bold ${monthlyMiles === preset.miles ? "text-emerald-600" : "text-gray-900"}`}>
                          {preset.miles.toLocaleString()}
                        </p>
                        <p className={`text-xs ${monthlyMiles === preset.miles ? "text-emerald-600" : "text-gray-500"}`}>
                          miles per month
                        </p>
                        <p className={`text-xs mt-1 ${monthlyMiles === preset.miles ? "text-emerald-500" : "text-gray-400"}`}>
                          {preset.desc}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-sm text-gray-500 mb-2">
                      Or set your own: <span className="text-gray-900 font-semibold">{monthlyMiles.toLocaleString()} miles per month</span>
                    </label>
                    <input
                      type="range"
                      min={200}
                      max={4000}
                      step={100}
                      value={monthlyMiles}
                      onChange={(e) => setMonthlyMiles(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>

                  {vehicleMpg && vehicleMpg > 0 && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-gray-600">
                          {vehicleMpg} MPG × {monthlyMiles.toLocaleString()} mi/mo
                        </span>
                        <span className="text-lg font-bold text-emerald-600">
                          ~{estimateMonthlyGallons(vehicleMpg, monthlyMiles)} gal/mo
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">How much gas do you use?</h3>
                    <p className="text-gray-500 text-sm">
                      Enter your estimated monthly fuel usage in gallons.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Monthly gallons</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min={20}
                        max={500}
                        step={5}
                        value={manualGallons}
                        onChange={(e) => setManualGallons(Number(e.target.value))}
                        className="flex-1 accent-emerald-500"
                      />
                      <div className="w-24 text-center">
                        <span className="text-2xl font-bold text-gray-900">{manualGallons}</span>
                        <span className="text-sm text-gray-500 ml-1">gal</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
                      <span>20 gal</span>
                      <span>500 gal</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Sedan", gal: 50 },
                      { label: "SUV", gal: 80 },
                      { label: "Truck", gal: 120 },
                      { label: "Work Van", gal: 160 },
                      { label: "Fleet Vehicle", gal: 250 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => setManualGallons(preset.gal)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
                          manualGallons === preset.gal
                            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                            : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {preset.label} (~{preset.gal} gal)
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setCalcStep(2)}
                  className="px-5 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    if (skipVehicle) {
                      setMonthlyGallons(manualGallons);
                    } else if (vehicleMpg && vehicleMpg > 0) {
                      setMonthlyGallons(estimateMonthlyGallons(vehicleMpg, monthlyMiles));
                    }
                    setCalcStep(4);
                  }}
                  className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Max Price */}
          {calcStep === 4 && localPrice && (
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
                {strikePrice > localPrice.price && (
                  <p className="text-xs text-gray-400 mt-2">
                    At this ceiling, you&apos;d pay up to <span className="font-semibold text-gray-600">${((strikePrice - localPrice.price) * monthlyGallons).toFixed(2)}/mo</span> more in fuel costs ({monthlyGallons} gal &times; ${(strikePrice - localPrice.price).toFixed(2)})
                  </p>
                )}
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
                  onClick={() => setCalcStep(3)}
                  className="px-5 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition"
                >
                  Back
                </button>
                <button
                  onClick={handleGetQuote}
                  className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Quote */}
          {calcStep === 5 && result && localPrice && (
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
                  Your {result.policyMonths}-Month PumpLock Membership Plan
                </p>
                <p className="text-7xl sm:text-8xl font-black text-emerald-600 mb-1">
                  ${result.monthlyEquivalent.toFixed(2)}
                </p>
                <p className="text-xl font-bold text-gray-900 mb-3">per month</p>
                <p className="text-sm text-gray-500 mb-5">
                  One payment of ${result.upfrontPrice.toFixed(2)}
                </p>
                <button
                  onClick={handleGetProtected}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold rounded-xl transition shadow-lg shadow-emerald-600/20"
                >
                  {session ? "Get Protected Now" : "Sign Up & Get Protected"}
                </button>
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
                  <p className="text-xs text-gray-400 mt-1">Click any row to select that plan</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">Max Price</th>
                        <th className="px-4 py-3 text-right">~Per Month</th>
                        <th className="px-4 py-3 text-right">1-Mo Plan</th>
                        <th className="px-4 py-3 text-right">3-Mo Plan</th>
                        <th className="px-4 py-3 text-right">6-Mo Plan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tiers.map((tier, i) => {
                        const isSelected = Math.abs(tier.strikePrice - result.strikePrice) < 0.01;
                        const t1 = tiers1mo[i];
                        const t3 = tiers3mo[i];
                        return (
                          <tr
                            key={tier.strikePrice}
                            onClick={() => {
                              setStrikePrice(tier.strikePrice);
                              // WHY: Recompute the hero quote with the clicked tier's strike price
                              if (!localPrice) return;
                              const currentMonth = new Date().getMonth() + 1;
                              const newResult = priceProtectionPlan({
                                spotPrice: localPrice.price,
                                strikePrice: tier.strikePrice,
                                gallonsPerMonth: monthlyGallons,
                                volatility: pricingVolatility,
                                riskFreeRate: pricingRate,
                                currentMonth,
                                termMonths: selectedTerm,
                                operationalLoad: pricingOpLoad,
                                profitMargin: pricingProfit,
                                adverseSelectionLoad: pricingAdvSel,
                              });
                              setResult(newResult);
                            }}
                            className={`border-t border-gray-100 cursor-pointer transition-colors hover:bg-emerald-50/50 ${isSelected ? "bg-emerald-50" : ""}`}
                          >
                            <td className={`px-4 py-3 font-medium ${isSelected ? "text-emerald-600" : "text-gray-900"}`}>
                              ${tier.strikePrice.toFixed(2)}
                              {isSelected && <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Selected</span>}
                            </td>
                            <td className={`px-4 py-3 text-right font-semibold ${isSelected ? "text-emerald-600" : "text-gray-900"}`}>
                              ${tier.monthlyEquivalent.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500 font-mono">
                              {t1 ? `$${t1.upfrontPrice.toFixed(2)}` : "—"}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500 font-mono">
                              {t3 ? `$${t3.upfrontPrice.toFixed(2)}` : "—"}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500 font-mono">
                              ${tier.upfrontPrice.toFixed(2)}
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
                  onClick={() => setCalcStep(4)}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition"
                >
                  Back
                </button>
                <button
                  onClick={handleGetProtected}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition"
                >
                  {session ? "Get Protected" : "Sign Up & Get Protected"} &mdash; ${result.upfrontPrice.toFixed(2)}
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
            <a href="/privacy" className="hover:text-gray-600 transition">Privacy</a>
            <a href="/terms" className="hover:text-gray-600 transition">Terms</a>
            <a href="/contact" className="hover:text-gray-600 transition">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
