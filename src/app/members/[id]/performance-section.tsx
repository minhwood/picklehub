"use client";

interface RatingPoint {
  date: Date | string;
  rating: number;
  result: "win" | "loss";
}

interface MatchEntry {
  id: string;
  matchType: "SINGLES" | "DOUBLES";
  playedAt: Date | string;
  scoreWinner: number;
  scoreLoser: number;
  result: "win" | "loss";
  delta: number;
  teammates: string[];
  opponents: string[];
}

interface Stats {
  rating: number;
  eloWins: number;
  eloLosses: number;
  totalMatches: number;
  singlesMatches: number;
  doublesMatches: number;
}

interface PerformanceSectionProps {
  stats: Stats;
  matches: MatchEntry[];
  ratingPoints: RatingPoint[];
}

export function PerformanceSection({ stats, matches, ratingPoints }: PerformanceSectionProps) {
  const winRate =
    stats.totalMatches > 0 ? Math.round((stats.eloWins / stats.totalMatches) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <StatCard label="ELO" value={Math.round(stats.rating * 10) / 10} highlight />
        <StatCard label="Thắng" value={stats.eloWins} color="emerald" />
        <StatCard label="Thua" value={stats.eloLosses} color="rose" />
        <StatCard label="Tỉ lệ" value={`${winRate}%`} />
        <StatCard label="Singles" value={stats.singlesMatches} />
        <StatCard label="Doubles" value={stats.doublesMatches} />
      </div>

      {/* Form guide */}
      {matches.length > 0 && (
        <FormGuide matches={matches} overallWinRate={winRate} />
      )}

      {/* Rating chart */}
      {ratingPoints.length > 0 && <RatingChart points={ratingPoints} />}

      {/* Match log */}
      {matches.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Chưa có trận nào.</p>
      ) : (
        <MatchLog matches={matches} />
      )}
    </div>
  );
}

// ─── Form guide ───────────────────────────────────────────────────────────────
// Inspired by football form strips (Sofascore / FotMob) + Chess.com rating trend

const FORM_N = 5;

function FormGuide({
  matches,
  overallWinRate,
}: {
  matches: MatchEntry[];
  overallWinRate: number;
}) {
  const recent = matches.slice(0, FORM_N); // matches is newest-first
  const wins = recent.filter((m) => m.result === "win").length;
  const recentWinRate = recent.length > 0 ? (wins / recent.length) * 100 : 0;
  const recentDelta = recent.reduce((s, m) => s + m.delta, 0);
  const diff = recentWinRate - overallWinRate;

  let formLabel: string;
  let formColor: string;
  let formIcon: string;
  if (recent.length < 2) {
    formLabel = "Chưa đủ dữ liệu";
    formColor = "text-slate-400";
    formIcon = "—";
  } else if (diff >= 20) {
    formLabel = "Đang bùng nổ";
    formColor = "text-emerald-600";
    formIcon = "🔥";
  } else if (diff >= 8) {
    formLabel = "Đang lên form";
    formColor = "text-emerald-500";
    formIcon = "↑";
  } else if (diff <= -20) {
    formLabel = "Đang sa sút";
    formColor = "text-rose-600";
    formIcon = "📉";
  } else if (diff <= -8) {
    formLabel = "Đang xuống form";
    formColor = "text-rose-500";
    formIcon = "↓";
  } else {
    formLabel = "Phong độ ổn định";
    formColor = "text-slate-600";
    formIcon = "→";
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Phong độ {FORM_N} trận gần nhất
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {/* W/L strip */}
        <div className="flex gap-1.5">
          {recent.map((m, i) => (
            <span
              key={m.id}
              title={`Trận ${i + 1}: ${m.result === "win" ? "Thắng" : "Thua"}`}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                m.result === "win"
                  ? "bg-emerald-500 text-white"
                  : "bg-rose-500 text-white"
              }`}
            >
              {m.result === "win" ? "W" : "L"}
            </span>
          ))}
          {/* Placeholders if fewer than FORM_N matches */}
          {Array.from({ length: Math.max(0, FORM_N - recent.length) }).map((_, i) => (
            <span
              key={`empty-${i}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-400"
            >
              ·
            </span>
          ))}
        </div>

        <div className="h-8 w-px bg-slate-200" />

        {/* Win rate last N */}
        <div className="text-center">
          <p className="text-xs text-slate-400">Thắng / {recent.length} trận</p>
          <p className="text-lg font-black text-slate-950">
            {wins}
            <span className="text-sm font-normal text-slate-400">/{recent.length}</span>
          </p>
        </div>

        {/* ELO change */}
        <div className="text-center">
          <p className="text-xs text-slate-400">ELO thay đổi</p>
          <p
            className={`text-lg font-black tabular-nums ${
              recentDelta >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {recentDelta >= 0 ? "+" : ""}
            {recentDelta.toFixed(1)}
          </p>
        </div>

        <div className="h-8 w-px bg-slate-200" />

        {/* Form assessment */}
        <div>
          <p className="text-xs text-slate-400">Đánh giá</p>
          <p className={`font-bold ${formColor}`}>
            {formIcon} {formLabel}
          </p>
          <p className="text-xs text-slate-400">
            vs trung bình {overallWinRate}%
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Match log ────────────────────────────────────────────────────────────────

function MatchLog({ matches }: { matches: MatchEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500">
            <th className="px-4 py-2.5 text-left">Ngày</th>
            <th className="px-4 py-2.5 text-left">Loại</th>
            <th className="px-4 py-2.5 text-left">KQ</th>
            <th className="px-4 py-2.5 text-left">Đối thủ</th>
            <th className="px-4 py-2.5 text-center">Tỉ số</th>
            <th className="px-4 py-2.5 text-right">ELO</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {matches.map((m) => {
            const d = new Date(m.playedAt);
            const myScore = m.result === "win" ? m.scoreWinner : m.scoreLoser;
            const oppScore = m.result === "win" ? m.scoreLoser : m.scoreWinner;
            return (
              <tr key={m.id} className="hover:bg-slate-50/60">
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                  {d.toLocaleDateString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      m.matchType === "SINGLES"
                        ? "bg-slate-100 text-slate-600"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {m.matchType === "SINGLES" ? "1v1" : "2v2"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                      m.result === "win"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {m.result === "win" ? "THẮNG" : "THUA"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-slate-800">
                    vs {m.opponents.join(" & ")}
                  </p>
                  {m.teammates.length > 0 && (
                    <p className="text-xs text-slate-400">
                      cùng {m.teammates.join(" & ")}
                    </p>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center font-mono font-semibold text-slate-700">
                  <span className={m.result === "win" ? "text-emerald-700" : "text-rose-600"}>
                    {myScore}
                  </span>
                  <span className="text-slate-300">–</span>
                  <span className="text-slate-500">{oppScore}</span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span
                    className={`font-semibold tabular-nums ${
                      m.delta >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {m.delta >= 0 ? "+" : ""}
                    {m.delta.toFixed(1)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  highlight,
  color,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  color?: "emerald" | "rose";
}) {
  const textColor = highlight
    ? "text-slate-950"
    : color === "emerald"
      ? "text-emerald-600"
      : color === "rose"
        ? "text-rose-600"
        : "text-slate-700";

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-3 text-center">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xl font-black tabular-nums ${textColor}`}>{value}</p>
    </div>
  );
}

// ─── SVG Rating Chart ─────────────────────────────────────────────────────────

function RatingChart({ points }: { points: RatingPoint[] }) {
  const W = 600;
  const H = 180;
  const PAD = { top: 20, right: 16, bottom: 28, left: 52 };

  const ratings = points.map((p) => p.rating);
  const minR = Math.min(...ratings);
  const maxR = Math.max(...ratings);
  const rangeR = maxR - minR || 50;
  // Add 10% padding so dots on extremes aren't clipped
  const paddedMin = minR - rangeR * 0.1;
  const paddedRange = rangeR * 1.2;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  function xOf(i: number) {
    if (points.length === 1) return PAD.left + innerW / 2;
    return PAD.left + (i / (points.length - 1)) * innerW;
  }
  function yOf(r: number) {
    return PAD.top + innerH - ((r - paddedMin) / paddedRange) * innerH;
  }

  const polyline = points.map((p, i) => `${xOf(i)},${yOf(p.rating)}`).join(" ");

  const ticks = [minR, (minR + maxR) / 2, maxR];

  const labelIndices =
    points.length <= 4
      ? points.map((_, i) => i)
      : [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500">Rating theo thời gian</p>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> Thắng
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" /> Thua
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 200 }}>
        {/* Y grid + labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              y1={yOf(t)}
              x2={W - PAD.right}
              y2={yOf(t)}
              stroke="#f1f5f9"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={yOf(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill="#94a3b8"
            >
              {Math.round(t)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <polygon
          points={`${PAD.left},${PAD.top + innerH} ${polyline} ${W - PAD.right},${PAD.top + innerH}`}
          fill="#0f172a"
          fillOpacity={0.04}
        />

        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="#0f172a"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots colored by result */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xOf(i)}
            cy={yOf(p.rating)}
            r={4}
            fill={p.result === "win" ? "#10b981" : "#f43f5e"}
            stroke="white"
            strokeWidth={1.5}
          >
            <title>{`${new Date(p.date).toLocaleDateString("vi-VN")}: ${Math.round(p.rating * 10) / 10} (${p.result === "win" ? "Thắng" : "Thua"})`}</title>
          </circle>
        ))}

        {/* X-axis date labels */}
        {labelIndices.map((i) => {
          const d = new Date(points[i].date);
          return (
            <text
              key={i}
              x={xOf(i)}
              y={H - 4}
              textAnchor="middle"
              fontSize={9}
              fill="#94a3b8"
            >
              {d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
