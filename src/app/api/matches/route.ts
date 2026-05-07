import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import {
  computeSinglesDeltas,
  computeDoublesDeltas,
  applyFloor,
  PlayerSnapshot,
} from "@/lib/elo"

// ─── Validation Schema ───────────────────────────────────────────────────────

const BaseMatchSchema = z.object({
  score_winner: z.number().int().min(0),
  score_loser: z.number().int().min(0),
  played_at: z.string().datetime().optional(),
}).superRefine((data, ctx) => {
  if (data.score_winner <= data.score_loser) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Điểm đội thắng phải cao hơn đội thua",
      path: ["score_winner"],
    })
  }
})

const MatchSchema = z.discriminatedUnion("match_type", [
  BaseMatchSchema.extend({
    match_type: z.literal("singles"),
    winner_ids: z.array(z.string()).length(1, "Singles: cần đúng 1 winner"),
    loser_ids: z.array(z.string()).length(1, "Singles: cần đúng 1 loser"),
  }),
  BaseMatchSchema.extend({
    match_type: z.literal("doubles"),
    winner_ids: z.array(z.string()).length(2, "Doubles: cần đúng 2 winners"),
    loser_ids: z.array(z.string()).length(2, "Doubles: cần đúng 2 losers"),
  }),
])

// ─── POST /api/matches ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Chỉ admin mới được ghi trận
  const user = await getCurrentUser()
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = MatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const data = parsed.data
  const allIds = [...data.winner_ids, ...data.loser_ids]

  // Không được trùng player ID giữa 2 đội
  const uniqueIds = new Set(allIds)
  if (uniqueIds.size !== allIds.length) {
    return NextResponse.json(
      { error: "Player IDs phải unique — không được trùng giữa 2 đội" },
      { status: 400 },
    )
  }

  // Lấy thông tin players từ DB
  const players = await prisma.member.findMany({
    where: { id: { in: allIds } },
    select: { id: true, rating: true, maxRating: true, totalMatches: true },
  })

  if (players.length !== allIds.length) {
    return NextResponse.json(
      { error: "Một hoặc nhiều player không tồn tại" },
      { status: 400 },
    )
  }

  const playerMap = new Map<string, PlayerSnapshot>(
    players.map((p) => [p.id, p]),
  )

  // Tính delta ELO
  let ratingChanges: Record<string, number>

  if (data.match_type === "singles") {
    const winner = playerMap.get(data.winner_ids[0])!
    const loser = playerMap.get(data.loser_ids[0])!
    const result = computeSinglesDeltas(
      winner,
      loser,
      data.score_winner,
      data.score_loser,
    )
    ratingChanges = {
      [result.winnerId]: result.deltaWinner,
      [result.loserId]: result.deltaLoser,
    }
  } else {
    const [w1, w2, l1, l2] = [
      playerMap.get(data.winner_ids[0])!,
      playerMap.get(data.winner_ids[1])!,
      playerMap.get(data.loser_ids[0])!,
      playerMap.get(data.loser_ids[1])!,
    ]
    const result = computeDoublesDeltas(
      w1,
      w2,
      l1,
      l2,
      data.score_winner,
      data.score_loser,
    )
    ratingChanges = result.deltas
  }

  // Atomic transaction: cập nhật players + insert match
  const match = await prisma.$transaction(async (tx) => {
    // Cập nhật từng player
    for (const playerId of allIds) {
      const player = playerMap.get(playerId)!
      const delta = ratingChanges[playerId]
      const isWinner = data.winner_ids.includes(playerId)
      const newRating = applyFloor(player.rating + delta)

      await tx.member.update({
        where: { id: playerId },
        data: {
          rating: newRating,
          maxRating: Math.max(player.maxRating, newRating),
          totalMatches: { increment: 1 },
          ...(data.match_type === "singles"
            ? { singlesMatches: { increment: 1 } }
            : { doublesMatches: { increment: 1 } }),
          ...(isWinner
            ? { eloWins: { increment: 1 } }
            : { eloLosses: { increment: 1 } }),
        },
      })
    }

    // Insert match record
    return tx.match.create({
      data: {
        matchType: data.match_type === "singles" ? "SINGLES" : "DOUBLES",
        playedAt: data.played_at ? new Date(data.played_at) : new Date(),
        scoreWinner: data.score_winner,
        scoreLoser: data.score_loser,
        winnerIds: data.winner_ids,
        loserIds: data.loser_ids,
        ratingChanges: ratingChanges as object,
        createdById: user.memberId ?? null,
      },
    })
  })

  return NextResponse.json({ match, ratingChanges }, { status: 201 })
}

// ─── GET /api/matches ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const matchType = searchParams.get("type") // "singles" | "doubles" | null
  const take = Math.min(Number(searchParams.get("limit") ?? "20"), 100)

  const matches = await prisma.match.findMany({
    where:
      matchType === "singles"
        ? { matchType: "SINGLES" }
        : matchType === "doubles"
          ? { matchType: "DOUBLES" }
          : undefined,
    orderBy: { playedAt: "desc" },
    take,
  })

  // Enrich với tên players
  const allPlayerIds = [
    ...new Set(matches.flatMap((m) => [...m.winnerIds, ...m.loserIds])),
  ]
  const members = await prisma.member.findMany({
    where: { id: { in: allPlayerIds } },
    select: { id: true, name: true, rating: true },
  })
  const memberMap = new Map(members.map((m) => [m.id, m]))

  const enriched = matches.map((m) => ({
    ...m,
    winners: m.winnerIds.map((id) => memberMap.get(id)),
    losers: m.loserIds.map((id) => memberMap.get(id)),
  }))

  return NextResponse.json(enriched)
}
