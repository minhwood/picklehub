import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser, getViewMode } from "@/lib/auth";
import { getMemberMatchHistory } from "@/lib/queries";
import { getRank } from "@/lib/rank";
import { PerformanceSection } from "@/app/members/[id]/performance-section";

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  const viewMode = user ? await getViewMode() : "MEMBER";
  const { id } = await params;

  const performance = await getMemberMatchHistory(id);
  if (!performance) notFound();

  // Need member name — getMemberMatchHistory doesn't return it, fetch separately
  const { prisma } = await import("@/lib/prisma");
  const member = await prisma.member.findUnique({
    where: { id },
    select: { name: true, status: true, rating: true, maxRating: true },
  });
  if (!member) notFound();

  return (
    <AppShell
      role={user?.role ?? null}
      viewMode={viewMode}
      currentPath="/leaderboard"
      userLabel={user?.member?.name || user?.email || null}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/leaderboard"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            ← Leaderboard
          </Link>
          <div>
            <p className="text-sm font-bold" style={{ color: getRank(member.rating).color }}>
              {getRank(member.rating).name}
            </p>
            <h1
              className="text-2xl font-black"
              style={{ color: getRank(member.rating).color }}
            >
              {member.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              ELO:{" "}
              <span className="font-semibold" style={{ color: getRank(member.rating).color }}>
                {Math.round(member.rating * 10) / 10}
              </span>
              {" "}(max.{" "}
              <span className="font-semibold" style={{ color: getRank(member.maxRating).color }}>
                {getRank(member.maxRating).name}
              </span>
              ,{" "}
              <span className="font-semibold" style={{ color: getRank(member.maxRating).color }}>
                {Math.round(member.maxRating * 10) / 10}
              </span>
              )
            </p>
            {member.status !== "ACTIVE" && (
              <Badge variant="destructive" className="mt-1">{member.status}</Badge>
            )}
          </div>
        </div>

        {/* Performance section */}
        <Card>
          <CardHeader>
            <CardTitle>Phong độ thi đấu</CardTitle>
            <CardDescription>
              Biểu đồ ELO và lịch sử {performance.stats.totalMatches} trận đấu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PerformanceSection
              stats={performance.stats}
              matches={performance.matches}
              ratingPoints={performance.ratingPoints}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
