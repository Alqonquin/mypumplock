"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PumpLockLogo } from "@/components/pumplock-logo";

interface Plan {
  id: string;
  status: string;
  strikePrice: number;
  spotPrice: number;
  termDays: number;
  gallonsPerMonth: number;
  upfrontPrice: number;
  monthlyEquivalent: number;
  vehicleYear: number | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  fuelType: string | null;
  zip: string;
  cityState: string | null;
  startDate: string;
  endDate: string;
}

interface DayRow {
  day: number;
  date: string;
  dailyGallons: number;
  dailyAvgPrice: number;
  maxMemberPrice: number;
  dailyRebate: number;
  totalRebate: number;
}

interface PlanDetail {
  plan: Plan;
  totalDays: number;
  elapsedDays: number;
  dailyGallons: number;
  days: DayRow[];
}

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/account");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/member/plans")
        .then((r) => r.json())
        .then((data) => {
          setPlans(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [status]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const activePlans = plans.filter((p) => p.status === "ACTIVE");
  const pastPlans = plans.filter((p) => p.status !== "ACTIVE");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-lg font-black text-gray-900">
            <PumpLockLogo className="w-7 h-7" />
            PumpLock
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{session?.user?.email}</span>
            {session?.user?.role === "ADMIN" && (
              <Link href="/admin" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                Admin
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">My Account</h1>

        {/* Active Memberships */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Active Memberships{" "}
            {activePlans.length > 0 && (
              <span className="text-sm font-normal text-gray-400">({activePlans.length})</span>
            )}
          </h2>

          {loading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              Loading memberships...
            </div>
          ) : activePlans.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-gray-500 mb-4">You don&apos;t have any active memberships yet.</p>
              <Link
                href="/#quote"
                className="inline-block px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition"
              >
                Get a Quote
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {activePlans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
              {/* WHY: Make it obvious a household can protect multiple vehicles
                  under one account — each plan covers a different car. */}
              <Link
                href="/#calculator"
                className="block text-center p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition text-sm font-semibold text-gray-400 hover:text-emerald-600"
              >
                + Add another vehicle
              </Link>
            </div>
          )}
        </section>

        {/* Past Memberships */}
        {pastPlans.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Past Memberships{" "}
              <span className="text-sm font-normal text-gray-400">({pastPlans.length})</span>
            </h2>
            <div className="space-y-4">
              {pastPlans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const start = new Date(plan.startDate);
  const end = new Date(plan.endDate);
  const now = new Date();
  const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const elapsedDays = Math.max(0, (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const progress = Math.min(100, (elapsedDays / totalDays) * 100);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const vehicle = plan.vehicleYear
    ? `${plan.vehicleYear} ${plan.vehicleMake} ${plan.vehicleModel}`
    : null;

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700",
    EXPIRED: "bg-gray-100 text-gray-500",
    CANCELLED: "bg-red-100 text-red-600",
  };

  function handleToggle() {
    const next = !expanded;
    setExpanded(next);
    // WHY: Fetch detail data on first expand, cache after that.
    if (next && !detail && !detailLoading) {
      setDetailLoading(true);
      fetch(`/api/member/plans/${plan.id}`)
        .then((r) => r.json())
        .then((d) => {
          setDetail(d);
          setDetailLoading(false);
        })
        .catch(() => setDetailLoading(false));
    }
  }

  const lastRow = detail?.days[detail.days.length - 1];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Collapsed summary — always visible */}
      <button
        onClick={handleToggle}
        className="w-full text-left p-5 hover:bg-gray-50/50 transition cursor-pointer"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg font-bold text-gray-900">
                ${plan.strikePrice.toFixed(2)}/gal max
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[plan.status] || "bg-gray-100 text-gray-500"}`}>
                {plan.status}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {plan.termDays}-day membership &middot; {plan.gallonsPerMonth} gal/mo &middot; {plan.cityState || plan.zip}
            </p>
            {vehicle && (
              <p className="text-sm text-gray-400 mt-0.5">{vehicle}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-lg font-bold text-emerald-600">${plan.upfrontPrice.toFixed(2)}</p>
              <p className="text-xs text-gray-400">${plan.monthlyEquivalent.toFixed(2)}/mo</p>
            </div>
            {/* WHY: Chevron rotates to indicate expand/collapse state */}
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {plan.status === "ACTIVE" && (
          <div>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
              <span>{start.toLocaleDateString()}</span>
              <span>{daysLeft} days left</span>
              <span>{end.toLocaleDateString()}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </button>

      {/* Expanded detail — summary stats + daily table */}
      {expanded && (
        <div className="border-t border-gray-100">
          {detailLoading ? (
            <div className="p-8 text-center text-gray-400">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading details...
            </div>
          ) : detail ? (
            <>
              {/* Summary stats row */}
              <div className="grid grid-cols-5 gap-4 px-5 py-4 bg-gray-50/50 text-center">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Fuel Type</p>
                  <p className="text-sm font-bold text-gray-900">
                    {plan.fuelType === "Premium Gasoline"
                      ? "Premium"
                      : plan.fuelType === "Diesel"
                      ? "Diesel"
                      : "Regular"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Daily Gallons</p>
                  <p className="text-sm font-bold text-gray-900">
                    {detail.dailyGallons.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Membership Cost</p>
                  <p className="text-sm font-bold text-gray-900">
                    ${plan.upfrontPrice.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Day</p>
                  <p className="text-sm font-bold text-gray-900">
                    {detail.elapsedDays}{" "}
                    <span className="font-normal text-gray-400">/ {detail.totalDays}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Total Rebate</p>
                  <p className="text-sm font-bold text-emerald-600">
                    ${lastRow ? lastRow.totalRebate.toFixed(2) : "0.00"}
                  </p>
                </div>
              </div>

              {/* Daily breakdown table */}
              <div className="px-5 py-3 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">
                  Daily Rebate Breakdown
                </h3>
                <p className="text-xs text-gray-400">
                  {detail.elapsedDays} of {detail.totalDays} days elapsed
                </p>
              </div>

              {detail.days.length === 0 ? (
                <div className="px-5 pb-5 text-center text-sm text-gray-400">
                  No days elapsed yet — check back tomorrow.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-2.5">Day</th>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5 text-right">Daily Gallons</th>
                        <th className="px-4 py-2.5 text-right">Daily Avg Price</th>
                        <th className="px-4 py-2.5 text-right">Max Member Price</th>
                        <th className="px-4 py-2.5 text-right">Member Daily Rebate</th>
                        <th className="px-4 py-2.5 text-right">Member Total Rebate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detail.days.map((row) => {
                        const hasRebate = row.dailyRebate > 0;
                        return (
                          <tr
                            key={row.day}
                            className={hasRebate ? "bg-emerald-50/40" : ""}
                          >
                            <td className="px-4 py-2 font-medium text-gray-900">{row.day}</td>
                            <td className="px-4 py-2 text-gray-500">
                              {new Date(row.date + "T00:00:00").toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-700">{row.dailyGallons.toFixed(2)}</td>
                            <td className={`px-4 py-2 text-right font-medium ${
                              row.dailyAvgPrice > row.maxMemberPrice ? "text-red-600" : "text-gray-700"
                            }`}>
                              ${row.dailyAvgPrice.toFixed(3)}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-700">${row.maxMemberPrice.toFixed(3)}</td>
                            <td className={`px-4 py-2 text-right font-medium ${
                              hasRebate ? "text-emerald-600" : "text-gray-300"
                            }`}>
                              {hasRebate ? `$${row.dailyRebate.toFixed(2)}` : "—"}
                            </td>
                            <td className="px-4 py-2 text-right font-bold text-emerald-600">
                              ${row.totalRebate.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
