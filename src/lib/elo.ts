/**
 * ELO Rating System — Core Functions
 * Theo spec elo_spec.md v1.1
 */

/** K-factor động dựa trên số trận đã chơi */
export function getK(totalMatches: number): number {
  if (totalMatches < 10) return 40
  if (totalMatches < 30) return 32
  return 24
}

/** Xác suất thắng kỳ vọng của player có rating rSelf khi gặp rOpponent */
export function computeExpected(rSelf: number, rOpponent: number): number {
  return 1 / (1 + Math.pow(10, (rOpponent - rSelf) / 400))
}

/**
 * Margin of Victory multiplier.
 * - scoreDiff: winning_score - losing_score (1–15)
 * - ratingGap: |R_winner - R_loser| (singles) hoặc |R_teamA - R_teamB| (doubles)
 */
export function computeMargin(scoreDiff: number, ratingGap: number): number {
  return (Math.log(scoreDiff + 1) * 2.2) / (0.001 * ratingGap + 2.2)
}

/** Clamp value vào [min, max] */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

/**
 * Tính delta ELO cho một player.
 * - result: 1 (thắng) hoặc 0 (thua)
 * - Kết quả đã được clamp vào [-50, +50]
 */
export function computeDelta(
  rSelf: number,
  rOpponent: number,
  result: 1 | 0,
  k: number,
  scoreDiff: number,
  ratingGap: number,
): number {
  const expected = computeExpected(rSelf, rOpponent)
  const margin = computeMargin(scoreDiff, ratingGap)
  return clamp(k * margin * (result - expected), -50, 50)
}

// ─── Singles ────────────────────────────────────────────────────────────────

export interface PlayerSnapshot {
  id: string
  rating: number
  totalMatches: number
}

export interface SinglesDeltas {
  winnerId: string
  loserId: string
  deltaWinner: number
  deltaLoser: number
}

/**
 * Tính delta ELO cho trận singles.
 * winner.rating luôn dùng score 1, loser dùng score 0.
 */
export function computeSinglesDeltas(
  winner: PlayerSnapshot,
  loser: PlayerSnapshot,
  scoreWinner: number,
  scoreLoser: number,
): SinglesDeltas {
  const scoreDiff = scoreWinner - scoreLoser
  const ratingGap = Math.abs(winner.rating - loser.rating)

  const deltaWinner = computeDelta(
    winner.rating,
    loser.rating,
    1,
    getK(winner.totalMatches),
    scoreDiff,
    ratingGap,
  )
  const deltaLoser = computeDelta(
    loser.rating,
    winner.rating,
    0,
    getK(loser.totalMatches),
    scoreDiff,
    ratingGap,
  )

  return {
    winnerId: winner.id,
    loserId: loser.id,
    deltaWinner,
    deltaLoser,
  }
}

// ─── Doubles ────────────────────────────────────────────────────────────────

export interface DoublesDeltas {
  deltas: Record<string, number>
}

/**
 * Tính delta ELO cho trận doubles.
 * Team rating = average của 2 thành viên.
 * Mỗi người dùng K cá nhân, nhưng dùng chung E và M của đội.
 */
export function computeDoublesDeltas(
  w1: PlayerSnapshot,
  w2: PlayerSnapshot,
  l1: PlayerSnapshot,
  l2: PlayerSnapshot,
  scoreWinner: number,
  scoreLoser: number,
): DoublesDeltas {
  const rTeamW = (w1.rating + w2.rating) / 2
  const rTeamL = (l1.rating + l2.rating) / 2
  const scoreDiff = scoreWinner - scoreLoser
  const ratingGap = Math.abs(rTeamW - rTeamL)

  const eTeamW = computeExpected(rTeamW, rTeamL)
  const eTeamL = 1 - eTeamW
  const margin = computeMargin(scoreDiff, ratingGap)

  const dW1 = clamp(getK(w1.totalMatches) * margin * (1 - eTeamW), -50, 50)
  const dW2 = clamp(getK(w2.totalMatches) * margin * (1 - eTeamW), -50, 50)
  const dL1 = clamp(getK(l1.totalMatches) * margin * (0 - eTeamL), -50, 50)
  const dL2 = clamp(getK(l2.totalMatches) * margin * (0 - eTeamL), -50, 50)

  return {
    deltas: {
      [w1.id]: dW1,
      [w2.id]: dW2,
      [l1.id]: dL1,
      [l2.id]: dL2,
    },
  }
}

/** Rating floor — không bao giờ xuống dưới 100 */
export const RATING_FLOOR = 100
export function applyFloor(rating: number): number {
  return Math.max(RATING_FLOOR, rating)
}
