"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PumpLockLogo } from "@/components/pumplock-logo";

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
  plan: {
    id: string;
    status: string;
    strikePrice: number;
    spotPrice: number;
    termMonths: number;
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
  };
  totalDays: number;
  elapsedDays: number;
  dailyGallons: number;
  days: DayRow[];
}

export default function PlanDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;

  const [data, setData] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login?callbackUrl=/account");
    }
  }, [authStatus, router]);

  useEffect(() => {
    if (authStatus === "authenticated" && planId) {
      fetch(`/api/member/plans/${planId}`)
        .then((r) => {
          if (!r.ok) throw new Error("Plan not found");
          return r.json();
        })
        .then((d) => {
          setData(d);
          setLoading(false);
        })
        .catch((e) => {
          setError(e.message);
          setLoading(false);
        });
    }
  }, [authStatus, planId]);

  if (authStatus === "loading" || authStatus === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const plan = data?.plan;
  const vehicle =
    plan?.vehicleYear
      ? `${plan.vehicleYear} ${plan.vehicleMake} ${plan.vehicleModel}`
      : null;

  const lastRow = data?.days[data.days.length - 1];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-black text-gray-900"
          >
            <PumpLockLogo className="w-7 h-7" />
            PumpLock
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/account"
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              My Account
            </Link>
            <span className="text-sm text-gray-500">
              {session?.user?.email}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/account"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          &larr; Back to My Account
        </Link>

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading plan details...
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-red-500">
            {error}
          </div>
        ) : data && plan ? (
          <>
            {/* Plan summary card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold text-gray-900">
                      ${plan.strikePrice.toFixed(2)}/gal max
                    </h1>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        plan.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-700"
                          : plan.status === "CANCELLED"
                          ? "bg-red-100 text-red-600"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {plan.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {plan.termMonths}-month plan &middot;{" "}
                    {plan.gallonsPerMonth} gal/mo &middot;{" "}
                    {plan.cityState || plan.zip}
                  </p>
                  {vehicle && (
                    <p className="text-sm text-gray-400 mt-0.5">{vehicle}</p>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-6 text-center">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Fuel Type</p>
                    <p className="text-lg font-bold text-gray-900">
                      {plan.fuelType === "Premium Gasoline"
                        ? "Premium"
                        : plan.fuelType === "Diesel"
                        ? "Diesel"
                        : "Regular"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Daily Gallons</p>
                    <p className="text-lg font-bold text-gray-900">
                      {data.dailyGallons.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Paid</p>
                    <p className="text-lg font-bold text-gray-900">
                      ${plan.upfrontPrice.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Day</p>
                    <p className="text-lg font-bold text-gray-900">
                      {data.elapsedDays}{" "}
                      <span className="text-sm font-normal text-gray-400">
                        / {data.totalDays}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Total Rebate</p>
                    <p className="text-lg font-bold text-emerald-600">
                      ${lastRow ? lastRow.totalRebate.toFixed(2) : "0.00"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily breakdown table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">
                  Daily Rebate Breakdown
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {data.elapsedDays} of {data.totalDays} days elapsed
                </p>
              </div>

              {data.days.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  No days elapsed yet — check back tomorrow.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-3">Day</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">
                          Daily Gallons
                        </th>
                        <th className="px-4 py-3 text-right">
                          Daily Avg Price
                        </th>
                        <th className="px-4 py-3 text-right">
                          Max Member Price
                        </th>
                        <th className="px-4 py-3 text-right">
                          Member Daily Rebate
                        </th>
                        <th className="px-4 py-3 text-right">
                          Member Total Rebate
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.days.map((row) => {
                        const hasRebate = row.dailyRebate > 0;
                        return (
                          <tr
                            key={row.day}
                            className={
                              hasRebate ? "bg-emerald-50/40" : ""
                            }
                          >
                            <td className="px-4 py-2.5 font-medium text-gray-900">
                              {row.day}
                            </td>
                            <td className="px-4 py-2.5 text-gray-500">
                              {new Date(row.date + "T00:00:00").toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                }
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-700">
                              {row.dailyGallons.toFixed(2)}
                            </td>
                            <td
                              className={`px-4 py-2.5 text-right font-medium ${
                                row.dailyAvgPrice > row.maxMemberPrice
                                  ? "text-red-600"
                                  : "text-gray-700"
                              }`}
                            >
                              ${row.dailyAvgPrice.toFixed(3)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-700">
                              ${row.maxMemberPrice.toFixed(3)}
                            </td>
                            <td
                              className={`px-4 py-2.5 text-right font-medium ${
                                hasRebate
                                  ? "text-emerald-600"
                                  : "text-gray-300"
                              }`}
                            >
                              {hasRebate
                                ? `$${row.dailyRebate.toFixed(2)}`
                                : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-emerald-600">
                              ${row.totalRebate.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
