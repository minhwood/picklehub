import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"

// ─── GET /api/players/[id] — Profile player ──────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const member = await prisma.member.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      status: true,
      rating: true,
      totalMatches: true,
      singlesMatches: true,
      doublesMatches: true,
      eloWins: true,
      eloLosses: true,
    },
  })

  if (!member) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 })
  }

  // Lịch sử trận (tham gia với tư cách winner hoặc loser)
  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { winnerIds: { has: id } },
        { loserIds: { has: id } },
      ],
    },
    orderBy: { playedAt: "desc" },
    take: 20,
  })

  // Enrich với tên players
  const allPlayerIds = [
    ...new Set(matches.flatMap((m) => [...m.winnerIds, ...m.loserIds])),
  ]
  const members = await prisma.member.findMany({
    where: { id: { in: allPlayerIds } },
    select: { id: true, name: true },
  })
  const memberMap = new Map(members.map((m) => [m.id, m]))

  const matchHistory = matches.map((m) => {
    const isWinner = m.winnerIds.includes(id)
    const changes = m.ratingChanges as Record<string, number>
    return {
      id: m.id,
      matchType: m.matchType,
      playedAt: m.playedAt,
      scoreWinner: m.scoreWinner,
      scoreLoser: m.scoreLoser,
      result: isWinner ? "win" : "loss",
      ratingDelta: changes[id] ?? 0,
      winners: m.winnerIds.map((pid) => memberMap.get(pid)),
      losers: m.loserIds.map((pid) => memberMap.get(pid)),
    }
  })

  const winRate =
    member.totalMatches > 0
      ? Math.round((member.eloWins / member.totalMatches) * 1000) / 1000
      : 0

  return NextResponse.json({
    ...member,
    rating: Math.round(member.rating * 10) / 10,
    winRate,
    matchHistory,
  })
}
