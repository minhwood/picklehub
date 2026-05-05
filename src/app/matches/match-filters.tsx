"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";

interface Member {
  id: string;
  name: string;
}

interface MatchFiltersProps {
  members: Member[];
}

export function MatchFilters({ members }: MatchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedIds = searchParams.get("players")?.split(",").filter(Boolean) ?? [];
  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";

  const updateParams = useCallback(
    (updates: { players?: string[]; from?: string; to?: string }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.players !== undefined) {
        if (updates.players.length > 0) params.set("players", updates.players.join(","));
        else params.delete("players");
      }
      if (updates.from !== undefined) {
        if (updates.from) params.set("from", updates.from);
        else params.delete("from");
      }
      if (updates.to !== undefined) {
        if (updates.to) params.set("to", updates.to);
        else params.delete("to");
      }

      router.replace(`/matches?${params.toString()}`);
    },
    [router, searchParams],
  );

  function togglePlayer(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    updateParams({ players: next });
  }

  function clearAll() {
    router.replace("/matches");
    setDropdownOpen(false);
  }

  const hasFilter = selectedIds.length > 0 || dateFrom || dateTo;

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Player multi-select */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
            selectedIds.length > 0
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Người chơi
          {selectedIds.length > 0 && (
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-bold">
              {selectedIds.length}
            </span>
          )}
        </button>

        {dropdownOpen && (
          <div className="absolute left-0 top-full z-20 mt-1.5 w-52 rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="max-h-56 overflow-y-auto p-1">
              {members.map((m) => {
                const checked = selectedIds.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePlayer(m.id)}
                      className="h-4 w-4 rounded accent-slate-950"
                    />
                    <span className={checked ? "font-semibold text-slate-950" : "text-slate-700"}>
                      {m.name}
                    </span>
                  </label>
                );
              })}
            </div>
            {selectedIds.length > 0 && (
              <div className="border-t border-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => updateParams({ players: [] })}
                  className="w-full rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
                >
                  Bỏ chọn tất cả
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Date from */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Từ ngày</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => updateParams({ from: e.target.value })}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
        />
      </div>

      {/* Date to */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Đến ngày</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => updateParams({ to: e.target.value })}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
        />
      </div>

      {/* Clear all */}
      {hasFilter && (
        <button
          type="button"
          onClick={clearAll}
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-100"
        >
          Xóa filter
        </button>
      )}

      {/* Close dropdown when clicking outside */}
      {dropdownOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setDropdownOpen(false)}
        />
      )}
    </div>
  );
}
