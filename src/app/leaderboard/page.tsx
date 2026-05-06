import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser, getViewMode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function LeaderboardPage() {
  const user = await getCurrentUser();
  const viewMode = user ? await getViewMode() : "MEMBER";

  const members = await prisma.member.findMany({
    where: {
      status: "ACTIVE",
      totalMatches: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      rating: true,
      totalMatches: true,
      singlesMatches: true,
      doublesMatches: true,
      eloWins: true,
      eloLosses: true,
    },
    orderBy: { rating: "desc" },
  });

  const leaderboard = members.map((m, index) => ({
    rank: index + 1,
    ...m,
    rating: Math.round(m.rating * 10) / 10,
    winRate:
      m.totalMatches > 0
        ? Math.round((m.eloWins / m.totalMatches) * 1000) / 1000
        : 0,
  }));

  const maxRating = leaderboard[0]?.rating ?? 1500;

  // Podium order: #2, #1, #3
  const podiumOrder =
    leaderboard.length === 1
      ? [leaderboard[0]]
      : leaderboard.length === 2
        ? [leaderboard[1], leaderboard[0]]
        : [leaderboard[1], leaderboard[0], leaderboard[2]].filter(Boolean);

  return (
    <AppShell
      role={user?.role ?? null}
      viewMode={viewMode}
      currentPath="/leaderboard"
      userLabel={user?.member?.name || user?.email || null}
    >
      <div className="space-y-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-950">Leaderboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              ELO rating chung cho singles và doubles.
            </p>
          </div>
          {viewMode === "ADMIN" && (
            <Link
              href="/matches/create"
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              + Ghi trận
            </Link>
          )}
        </div>

        {/* Podium */}
        {podiumOrder.length > 0 && (
          <section className="flex items-end justify-center gap-3">
            {podiumOrder.map((player) => {
              const isFirst = player.rank === 1;
              const isSecond = player.rank === 2;
              const podiumMt = isFirst ? "" : isSecond ? "mt-10" : "mt-16";
              const podiumH = isFirst ? "h-14" : isSecond ? "h-9" : "h-5";
              const podiumBg = isFirst
                ? "bg-amber-400"
                : isSecond
                  ? "bg-slate-300"
                  : "bg-orange-300";
              const medal = isFirst ? "🥇" : isSecond ? "🥈" : "🥉";

              return (
                <div
                  key={player.id}
                  className={`flex w-full max-w-[220px] flex-col ${podiumMt}`}
                >
                  {/* Card */}
                  <div
                    className={`relative rounded-t-2xl border border-slate-100 bg-white px-5 shadow-sm ${isFirst ? "py-6" : "py-4"
                      }`}
                  >
                    {/* Medal */}
                    <div className="mb-2 text-center text-2xl">{medal}</div>

                    {/* Name */}
                    <p
                      className={`text-center font-black text-slate-950 ${isFirst ? "text-xl" : "text-base"
                        }`}
                    >
                      {player.name}
                    </p>

                    {/* ELO */}
                    <p
                      className={`mt-1 text-center font-black tabular-nums text-slate-950 ${isFirst ? "text-4xl" : "text-2xl"
                        }`}
                    >
                      {player.rating}
                    </p>
                    <p className="text-center text-xs text-slate-400">ELO</p>

                    {/* W/L */}
                    <div className="mt-3 flex items-center justify-center gap-2 text-sm">
                      <span className="font-semibold text-emerald-600">{player.eloWins}W</span>
                      <span className="text-slate-300">/</span>
                      <span className="font-semibold text-rose-500">{player.eloLosses}L</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500">{(player.winRate * 100).toFixed(0)}%</span>
                    </div>

                    {/* Detail link */}
                    <Link
                      href={`/leaderboard/${player.id}`}
                      className="mt-3 flex w-full items-center justify-center rounded-lg border border-slate-100 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
                    >
                      Chi tiết →
                    </Link>
                  </div>

                  {/* Podium base */}
                  <div className={`${podiumH} ${podiumBg} rounded-b-xl`} />
                </div>
              );
            })}
          </section>
        )}

        {/* Full rankings table */}
        <Card>
          <CardHeader>
            <CardTitle>Bảng xếp hạng</CardTitle>
            <CardDescription>
              {leaderboard.length} thành viên · sắp xếp theo ELO
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-6">#</TableHead>
                  <TableHead>Tên</TableHead>
                  <TableHead>ELO</TableHead>
                  <TableHead className="text-right">W / L</TableHead>
                  <TableHead className="text-right">Win %</TableHead>
                  <TableHead className="text-right">Trận</TableHead>
                  <TableHead className="pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((player) => {
                  const barPct = Math.min(100, (player.rating / maxRating) * 100);
                  return (
                    <TableRow key={player.id} className="group">
                      <TableCell className="pl-6 font-mono text-sm text-slate-400">
                        {player.rank <= 3 ? (
                          <span>
                            {player.rank === 1 ? "🥇" : player.rank === 2 ? "🥈" : "🥉"}
                          </span>
                        ) : (
                          <span className="tabular-nums">{player.rank}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold text-slate-950">{player.name}</p>
                        <p className="text-xs text-slate-400">
                          {player.singlesMatches}S · {player.doublesMatches}D
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-black tabular-nums text-slate-950">
                          {player.rating}
                        </p>
                        {/* ELO bar */}
                        <div className="mt-1 h-1 w-24 rounded-full bg-slate-100">
                          <div
                            className="h-1 rounded-full bg-slate-800"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-emerald-600">{player.eloWins}</span>
                        <span className="text-slate-300"> / </span>
                        <span className="font-semibold text-rose-500">{player.eloLosses}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600">
                        {(player.winRate * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-400">
                        {player.totalMatches}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Link
                          href={`/leaderboard/${player.id}`}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-slate-50"
                        >
                          Chi tiết →
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {leaderboard.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-slate-400">
                      Chưa có dữ liệu. Hãy ghi trận đầu tiên!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
