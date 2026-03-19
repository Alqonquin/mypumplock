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
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
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

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">My Account</h1>

        {/* Active Plans */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Active Plans{" "}
            {activePlans.length > 0 && (
              <span className="text-sm font-normal text-gray-400">({activePlans.length})</span>
            )}
          </h2>

          {loading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              Loading plans...
            </div>
          ) : activePlans.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-gray-500 mb-4">You don&apos;t have any active plans yet.</p>
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
            </div>
          )}
        </section>

        {/* Past Plans */}
        {pastPlans.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Past Plans{" "}
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
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
            {plan.termMonths}-month plan &middot; {plan.gallonsPerMonth} gal/mo &middot; {plan.cityState || plan.zip}
          </p>
          {vehicle && (
            <p className="text-sm text-gray-400 mt-0.5">{vehicle}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-emerald-600">${plan.upfrontPrice.toFixed(2)}</p>
          <p className="text-xs text-gray-400">${plan.monthlyEquivalent.toFixed(2)}/mo</p>
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
    </div>
  );
}
