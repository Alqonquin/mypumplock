"use client";

import { useEffect, useState } from "react";

interface MemberPlan {
  id: string;
  status: string;
  strikePrice: number;
  spotPrice: number;
  termMonths: number;
  gallonsPerMonth: number;
  upfrontPrice: number;
  zip: string;
  cityState: string | null;
  startDate: string;
  endDate: string;
}

interface Member {
  id: string;
  email: string;
  name: string | null;
  zip: string | null;
  createdAt: string;
  plans: MemberPlan[];
  activePlans: number;
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);

    fetch(`/api/admin/members?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setMembers(data.members);
        setTotal(data.total);
        setPages(data.pages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Members{" "}
          <span className="text-lg font-normal text-gray-400">({total})</span>
        </h1>
        <input
          type="text"
          placeholder="Search by email, name, or zip..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-72 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-100">
              <th className="px-4 py-3 text-left">Member</th>
              <th className="px-4 py-3 text-left">Zip</th>
              <th className="px-4 py-3 text-center">Active Plans</th>
              <th className="px-4 py-3 text-right">Total Premium</th>
              <th className="px-4 py-3 text-right">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  No members found
                </td>
              </tr>
            ) : (
              members.map((member) => {
                const totalPremium = member.plans.reduce((s, p) => s + p.upfrontPrice, 0);
                const isExpanded = expandedId === member.id;
                return (
                  <>
                    <tr
                      key={member.id}
                      onClick={() => setExpandedId(isExpanded ? null : member.id)}
                      className="border-t border-gray-100 cursor-pointer hover:bg-gray-50 transition"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{member.name || "—"}</div>
                        <div className="text-gray-400 text-xs">{member.email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{member.zip || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        {member.activePlans > 0 ? (
                          <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                            {member.activePlans}
                          </span>
                        ) : (
                          <span className="text-gray-300">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">
                        ${totalPremium.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                    {isExpanded && member.plans.length > 0 && (
                      <tr key={`${member.id}-plans`}>
                        <td colSpan={5} className="bg-gray-50 px-4 py-3">
                          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Plans</div>
                          <div className="space-y-2">
                            {member.plans.map((plan) => (
                              <div key={plan.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-2.5 text-sm">
                                <div className="flex items-center gap-4">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${plan.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                    {plan.status}
                                  </span>
                                  <span className="font-medium">${plan.strikePrice.toFixed(2)}/gal max</span>
                                  <span className="text-gray-400">{plan.termMonths}mo &middot; {plan.gallonsPerMonth} gal/mo</span>
                                </div>
                                <div className="flex items-center gap-4 text-gray-500">
                                  <span>{plan.cityState || plan.zip}</span>
                                  <span className="font-mono">${plan.upfrontPrice.toFixed(2)}</span>
                                  <span className="text-xs">
                                    {new Date(plan.startDate).toLocaleDateString()} — {new Date(plan.endDate).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {pages}
          </span>
          <button
            onClick={() => setPage(Math.min(pages, page + 1))}
            disabled={page === pages}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
