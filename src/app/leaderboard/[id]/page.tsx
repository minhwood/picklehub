import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getViewMode, requireUser } from "@/lib/auth";
import { getMemberMatchHistory } from "@/lib/queries";
import { PerformanceSection } from "@/app/members/[id]/performance-section";

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const viewMode = await getViewMode();
  const { id } = await params;

  const performance = await getMemberMatchHistory(id);
  if (!performance) notFound();

  // Need member name — getMemberMatchHistory doesn't return it, fetch separately
  const { prisma } = await import("@/lib/prisma");
  const member = await prisma.member.findUnique({
    where: { id },
    select: { name: true, status: true },
  });
  if (!member) notFound();

  return (
    <AppShell
      role={user.role}
      viewMode={viewMode}
      currentPath="/leaderboard"
      userLabel={user.member?.name || user.email}
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
            <h1 className="text-2xl font-black text-slate-950">{member.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={member.status === "ACTIVE" ? "success" : "destructive"}>
                {member.status}
              </Badge>
              <span className="text-sm text-slate-500">
                {performance.stats.totalMatches} trận · ELO {Math.round(performance.stats.rating * 10) / 10}
              </span>
            </div>
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
