import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { getViewMode, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMatchesFiltered } from "@/lib/queries";
import { DeleteMatchButton } from "./delete-match-button";
import { MatchFilters } from "./match-filters";

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await requireUser();
  const viewMode = await getViewMode();
  const params = await searchParams;

  const playerIds = params.players?.split(",").filter(Boolean) ?? [];
  const dateFrom = params.from ? new Date(params.from + "T00:00:00") : undefined;
  const dateTo = params.to ? new Date(params.to + "T23:59:59") : undefined;

  const [matches, allMembers] = await Promise.all([
    getMatchesFiltered({ playerIds, dateFrom, dateTo }),
    prisma.member.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const isAdmin = viewMode === "ADMIN";
  const hasFilter = playerIds.length > 0 || dateFrom || dateTo;

  // Group matches by date
  const byDate = new Map<string, typeof matches>();
  for (const match of matches) {
    const key = new Date(match.playedAt).toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(match);
  }

  return (
    <AppShell
      role={user.role}
      viewMode={viewMode}
      currentPath="/matches"
      userLabel={user.member?.name || user.email}
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-950">Lịch sử trận</h1>
            <p className="mt-1 text-sm text-slate-500">
              {matches.length} trận{hasFilter ? " (đang lọc)" : " gần nhất"}.
            </p>
          </div>
          {isAdmin && (
            <Link
              href="/matches/create"
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              + Ghi trận
            </Link>
          )}
        </div>

        <Suspense fallback={null}>
          <MatchFilters members={allMembers} />
        </Suspense>

        {matches.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-slate-400">
              {hasFilter ? "Không tìm thấy trận nào khớp với filter." : "Chưa có trận nào được ghi."}
              {isAdmin && !hasFilter && (
                <div className="mt-4">
                  <Link
                    href="/matches/create"
                    className="inline-block rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Ghi trận đầu tiên
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Array.from(byDate.entries()).map(([dateLabel, dayMatches]) => (
              <div key={dateLabel}>
                {/* Date header */}
                <div className="mb-2 flex items-center gap-3">
                  <span className="text-xs font-semibold capitalize text-slate-400">
                    {dateLabel}
                  </span>
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-xs text-slate-300">{dayMatches.length} trận</span>
                </div>

                {/* Matches for this day */}
                <div className="space-y-2">
                  {dayMatches.map((match) => {
                    const time = new Date(match.playedAt).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const isSingles = match.matchType === "SINGLES";

                    return (
                      <div
                        key={match.id}
                        className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white px-4 py-3 transition hover:border-slate-200 hover:shadow-sm"
                      >
                        {/* Left: time + type */}
                        <div className="w-20 shrink-0 text-right">
                          <p className="text-xs font-mono text-slate-400">{time}</p>
                          <span
                            className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              isSingles
                                ? "bg-slate-100 text-slate-500"
                                : "bg-amber-50 text-amber-600"
                            }`}
                          >
                            {isSingles ? "1v1" : "2v2"}
                          </span>
                        </div>

                        {/* Divider */}
                        <div className="h-10 w-px shrink-0 bg-slate-100" />

                        {/* Center: teams + score */}
                        <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                          {/* Winners */}
                          <div className="min-w-0 flex-1 text-right">
                            <p className="truncate font-semibold text-slate-950">
                              {match.winners.join(" & ")}
                            </p>
                            <div className="mt-1 flex flex-wrap justify-end gap-1">
                              {match.winnerIds.map((pid) => {
                                const delta = match.ratingChanges[pid];
                                const name = match.winners[match.winnerIds.indexOf(pid)];
                                return delta !== undefined ? (
                                  <span key={pid} className="text-[10px] font-semibold text-emerald-600">
                                    {name} +{delta.toFixed(1)}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          </div>

                          {/* Score — focal point */}
                          <div className="shrink-0 px-3 text-center">
                            <p className="font-mono text-2xl font-black leading-none tracking-tight">
                              <span className="text-emerald-600">{match.scoreWinner}</span>
                              <span className="mx-1 text-slate-200">:</span>
                              <span className="text-rose-500">{match.scoreLoser}</span>
                            </p>
                          </div>

                          {/* Losers */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-slate-500">
                              {match.losers.join(" & ")}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {match.loserIds.map((pid) => {
                                const delta = match.ratingChanges[pid];
                                const name = match.losers[match.loserIds.indexOf(pid)];
                                return delta !== undefined ? (
                                  <span key={pid} className="text-[10px] font-semibold text-rose-500">
                                    {name} {delta.toFixed(1)}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Right: delete */}
                        {isAdmin && (
                          <div className="shrink-0">
                            <DeleteMatchButton matchId={match.id} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
