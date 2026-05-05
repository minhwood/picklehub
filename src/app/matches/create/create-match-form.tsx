"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Member {
  id: string;
  name: string;
  rating: number;
  totalMatches: number;
}

interface CreateMatchFormProps {
  members: Member[];
}

type MatchType = "singles" | "doubles";

export function CreateMatchForm({ members }: CreateMatchFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [matchType, setMatchType] = useState<MatchType>("singles");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Đội 1 & Đội 2 (thứ tự tự nhiên — không phân biệt thắng/thua khi nhập)
  const [team1p1, setTeam1p1] = useState("");
  const [team1p2, setTeam1p2] = useState("");
  const [team2p1, setTeam2p1] = useState("");
  const [team2p2, setTeam2p2] = useState("");
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");

  function getRating(id: string) {
    return members.find((m) => m.id === id)?.rating ?? 1500;
  }

  function getName(id: string) {
    return members.find((m) => m.id === id)?.name ?? "";
  }

  const s1 = parseInt(score1, 10);
  const s2 = parseInt(score2, 10);
  const scoresValid = !isNaN(s1) && !isNaN(s2) && s1 >= 0 && s2 >= 0;
  const team1Wins = scoresValid && s1 > s2;
  const team2Wins = scoresValid && s2 > s1;
  const isTie = scoresValid && s1 === s2;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!scoresValid) {
      setError("Tỉ số không hợp lệ.");
      return;
    }
    if (isTie) {
      setError("Hai đội không thể hoà. Vui lòng nhập lại tỉ số.");
      return;
    }

    const team1 = matchType === "singles" ? [team1p1] : [team1p1, team1p2];
    const team2 = matchType === "singles" ? [team2p1] : [team2p1, team2p2];

    if (team1.some((id) => !id) || team2.some((id) => !id)) {
      setError("Vui lòng chọn đầy đủ người chơi.");
      return;
    }

    const allIds = [...team1, ...team2];
    if (new Set(allIds).size !== allIds.length) {
      setError("Không được chọn trùng người chơi giữa hai đội.");
      return;
    }

    const winnerIds = team1Wins ? team1 : team2;
    const loserIds = team1Wins ? team2 : team1;
    const scoreWinner = team1Wins ? s1 : s2;
    const scoreLoser = team1Wins ? s2 : s1;

    startTransition(async () => {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_type: matchType,
          winner_ids: winnerIds,
          loser_ids: loserIds,
          score_winner: scoreWinner,
          score_loser: scoreLoser,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Có lỗi xảy ra.");
        return;
      }

      const changes = data.ratingChanges as Record<string, number>;
      const lines = Object.entries(changes).map(([id, delta]) => {
        const isWinner = winnerIds.includes(id);
        return `${getName(id)}: ${isWinner ? "+" : ""}${delta.toFixed(1)} (${Math.round((getRating(id) + delta) * 10) / 10})`;
      });
      setSuccess(`Đã lưu!\n${lines.join("\n")}`);

      setTeam1p1(""); setTeam1p2(""); setTeam2p1(""); setTeam2p2("");
      setScore1(""); setScore2("");
      router.refresh();
    });
  }

  const score1Style = team1Wins
    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
    : team2Wins
      ? "border-rose-200 bg-rose-50/50 text-rose-900"
      : "border-slate-200 bg-white text-slate-900";

  const score2Style = team2Wins
    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
    : team1Wins
      ? "border-rose-200 bg-rose-50/50 text-rose-900"
      : "border-slate-200 bg-white text-slate-900";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Match type toggle */}
      <div>
        <Label className="mb-2 block">Loại trận</Label>
        <div className="flex gap-2">
          {(["singles", "doubles"] as MatchType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setMatchType(type);
                setTeam1p2(""); setTeam2p2("");
              }}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                matchType === type
                  ? "bg-slate-950 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {type === "singles" ? "Singles (1v1)" : "Doubles (2v2)"}
            </button>
          ))}
        </div>
      </div>

      {/* Main match input */}
      <div className={`rounded-xl border p-4 space-y-3 transition`}>
        {/* Header row: Đội 1 [score1] — [score2] Đội 2 */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <p className={`text-sm font-bold flex items-center gap-1 ${team1Wins ? "text-emerald-700" : team2Wins ? "text-rose-500" : "text-slate-600"}`}>
            {team1Wins && <span>🏆</span>}
            Đội 1
          </p>

          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              value={score1}
              onChange={(e) => setScore1(e.target.value)}
              placeholder="—"
              className={`w-14 rounded-xl border px-2 py-2 text-center font-mono text-xl font-black outline-none focus:ring-2 focus:ring-slate-300 transition ${score1Style}`}
              required
            />
            <span className="text-base font-black text-slate-300">:</span>
            <input
              type="number"
              min={0}
              value={score2}
              onChange={(e) => setScore2(e.target.value)}
              placeholder="—"
              className={`w-14 rounded-xl border px-2 py-2 text-center font-mono text-xl font-black outline-none focus:ring-2 focus:ring-slate-300 transition ${score2Style}`}
              required
            />
          </div>

          <p className={`text-sm font-bold flex items-center justify-end gap-1 ${team2Wins ? "text-emerald-700" : team1Wins ? "text-rose-500" : "text-slate-600"}`}>
            Đội 2
            {team2Wins && <span>🏆</span>}
          </p>
        </div>

        {/* Players row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <PlayerSelect
              value={team1p1}
              onChange={setTeam1p1}
              members={members}
              exclude={[team1p2, team2p1, team2p2]}
            />
            {matchType === "doubles" && (
              <PlayerSelect
                value={team1p2}
                onChange={setTeam1p2}
                members={members}
                exclude={[team1p1, team2p1, team2p2]}
              />
            )}
          </div>
          <div className="space-y-2">
            <PlayerSelect
              value={team2p1}
              onChange={setTeam2p1}
              members={members}
              exclude={[team1p1, team1p2, team2p2]}
            />
            {matchType === "doubles" && (
              <PlayerSelect
                value={team2p2}
                onChange={setTeam2p2}
                members={members}
                exclude={[team1p1, team1p2, team2p1]}
              />
            )}
          </div>
        </div>
      </div>

      {isTie && (
        <p className="text-center text-sm font-semibold text-amber-600">
          Hai đội không thể hoà — vui lòng nhập lại tỉ số.
        </p>
      )}

      {/* Error / Success */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 whitespace-pre-line">
          {success}
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Đang lưu…" : "Lưu trận & cập nhật ELO"}
      </Button>
    </form>
  );
}

function PlayerSelect({
  value,
  onChange,
  members,
  exclude,
}: {
  value: string;
  onChange: (v: string) => void;
  members: Member[];
  exclude: string[];
}) {
  const available = members.filter((m) => !exclude.includes(m.id) || m.id === value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-950 outline-none focus:border-slate-400"
      required
    >
      <option value="">— Chọn —</option>
      {available.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name} ({Math.round(m.rating)})
        </option>
      ))}
    </select>
  );
}
