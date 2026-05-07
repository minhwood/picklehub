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
