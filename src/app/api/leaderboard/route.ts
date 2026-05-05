import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"

// ─── GET /api/leaderboard ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const matchType = searchParams.get("type") // "singles" | "doubles" | null

  // Lấy tất cả active members
  const members = await prisma.member.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      rating: true,
      totalMatches: true,
      singlesMatches: true,
      doublesMatches: true,
      eloWins: true,
      eloLosses: true,
    },
    orderBy: { rating: "desc" },
  })

  const leaderboard = members
    .filter((m) => {
      // Filter theo match type nếu có
      if (matchType === "singles") return m.singlesMatches > 0
      if (matchType === "doubles") return m.doublesMatches > 0
      return true
    })
    .map((m, index) => ({
      rank: index + 1,
      playerId: m.id,
      name: m.name,
      avatarUrl: m.avatarUrl,
      rating: Math.round(m.rating * 10) / 10, // 1 decimal
      totalMatches: m.totalMatches,
      singlesMatches: m.singlesMatches,
      doublesMatches: m.doublesMatches,
      wins: m.eloWins,
      losses: m.eloLosses,
      winRate:
        m.totalMatches > 0
          ? Math.round((m.eloWins / m.totalMatches) * 1000) / 1000
          : 0,
    }))

  return NextResponse.json(leaderboard)
}
