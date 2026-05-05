import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { applyFloor } from "@/lib/elo"

// ─── DELETE /api/matches/[id] — Rollback trận (admin only) ──────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const match = await prisma.match.findUnique({ where: { id } })
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 })
  }

  const ratingChanges = match.ratingChanges as Record<string, number>
  const allIds = [...match.winnerIds, ...match.loserIds]

  // Lấy players hiện tại để reverse delta
  const players = await prisma.member.findMany({
    where: { id: { in: allIds } },
    select: {
      id: true,
      rating: true,
      totalMatches: true,
      singlesMatches: true,
      doublesMatches: true,
      eloWins: true,
      eloLosses: true,
    },
  })
  const playerMap = new Map(players.map((p) => [p.id, p]))

  await prisma.$transaction(async (tx) => {
    for (const playerId of allIds) {
      const player = playerMap.get(playerId)
      if (!player) continue

      const delta = ratingChanges[playerId] ?? 0
      const isWinner = match.winnerIds.includes(playerId)

      const isSingles = match.matchType === "SINGLES"

      await tx.member.update({
        where: { id: playerId },
        data: {
          // Reverse chính xác delta đã apply
          rating: applyFloor(player.rating - delta),
          totalMatches: Math.max(0, player.totalMatches - 1),
          ...(isSingles
            ? { singlesMatches: Math.max(0, player.singlesMatches - 1) }
            : { doublesMatches: Math.max(0, player.doublesMatches - 1) }),
          ...(isWinner
            ? { eloWins: Math.max(0, player.eloWins - 1) }
            : { eloLosses: Math.max(0, player.eloLosses - 1) }),
        },
      })
    }

    await tx.match.delete({ where: { id } })
  })

  return NextResponse.json({ success: true, deletedId: id })
}

// ─── GET /api/matches/[id] ───────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const match = await prisma.match.findUnique({ where: { id } })
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 })
  }

  return NextResponse.json(match)
}
