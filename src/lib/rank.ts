export interface Rank {
  name: string;
  minRating: number;
  color: string;
}

export const RANKS: Rank[] = [
  { name: "Master", minRating: 2100, color: "#ff0000" },
  { name: "Expert", minRating: 1900, color: "#ff8c00" },
  { name: "Advanced", minRating: 1750, color: "#aa00aa" },
  { name: "Intermediate", minRating: 1600, color: "#0000ff" },
  { name: "Amateur", minRating: 1500, color: "#03a89e" },
  { name: "Beginner", minRating: 1300, color: "#008000" },
  { name: "Newcomer", minRating: 0, color: "#b74d4dff" },
];

export function getRank(rating: number): Rank {
  return RANKS.find((r) => rating >= r.minRating) ?? RANKS[RANKS.length - 1];
}

/** % tiến độ từ rank hiện tại đến rank tiếp theo (0–100). Trả 100 nếu đã là rank cao nhất. */
export function getRankProgress(rating: number): number {
  const currentIdx = RANKS.findIndex((r) => rating >= r.minRating);
  if (currentIdx <= 0) return 100; // Master — đỉnh rồi
  const current = RANKS[currentIdx];
  const next = RANKS[currentIdx - 1];
  return Math.min(100, ((rating - current.minRating) / (next.minRating - current.minRating)) * 100);
}
