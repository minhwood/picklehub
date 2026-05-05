# ELO Rating System — Technical Specification
**Pickleball Team Manager** | v1.1 | Internal Use

---

## Overview

Hệ thống ELO xếp hạng chung cho **cả singles lẫn doubles** trên một bảng duy nhất. Mỗi người chơi có một chỉ số `rating` duy nhất, được cập nhật sau mỗi trận bất kể nội dung. Kết quả doubles ảnh hưởng trực tiếp lên rating cá nhân.

**Thông số cố định:**

| Field | Value |
|---|---|
| Base rating | 1500 |
| Match format | Single set, first to 15 |
| Game modes | Singles & Doubles (shared leaderboard) |
| Team size | ~10 players |

---

## 1. Core ELO Formula

### 1.1 Expected Score

Xác suất thắng kỳ vọng của A khi gặp B:

```
E_A = 1 / (1 + 10 ^ ((R_B - R_A) / 400))
E_B = 1 - E_A
```

### 1.2 Rating Update

```
R_A_new = R_A + K * M * (S_A - E_A)
```

| Variable | Description |
|---|---|
| `K` | K-factor động (xem mục 2) |
| `M` | Margin of Victory multiplier (xem mục 3) |
| `S_A` | Kết quả: `1` nếu thắng, `0` nếu thua |
| `E_A` | Xác suất thắng kỳ vọng |

---

## 2. Dynamic K-Factor

K-factor kiểm soát mức độ thay đổi rating sau mỗi trận. Người mới dùng K cao để hội tụ nhanh; người chơi lâu năm dùng K thấp để ổn định.

```
function getK(totalMatches):
  if totalMatches < 10  → return 40
  if totalMatches < 30  → return 32
  else                  → return 24
```

> **Implementation note:** Mỗi player có trường `total_matches` riêng. Trong trận doubles, mỗi người dùng K của chính mình.

---

## 3. Margin of Victory Multiplier (M)

Thắng 15–2 phải có giá trị hơn thắng 15–14. Công thức dựa theo mô hình FiveThirtyEight, có thêm anti-farming:

```
score_diff = winning_score - losing_score   // range: 1–15
rating_gap = |R_winner - R_loser|           // dùng rating cá nhân (singles) hoặc team avg (doubles)

M = ln(score_diff + 1) * 2.2 / (0.001 * rating_gap + 2.2)
```

**Giá trị tham khảo** (không có rating gap):

| Score | score_diff | M |
|---|---|---|
| 15–14 | 1 | ≈ 0.69 |
| 15–10 | 5 | ≈ 1.79 |
| 15–5 | 10 | ≈ 2.48 |
| 15–0 | 15 | ≈ 2.77 |

> **Anti-farming:** Mẫu số `(0.001 * rating_gap + 2.2)` làm giảm M khi người mạnh hơn đè bẹp người yếu hơn, chống việc cố tình chọn đối thủ yếu để cày điểm.

---

## 4. Singles Match Logic

### Step-by-step

1. Lấy `R_A`, `R_B` từ DB.
2. Tính `E_A` theo công thức expected score.
3. Tính `score_diff` và `M`.
4. Tính delta cho cả hai: `delta = K * M * (S - E)`, clamp về `[-50, +50]`.
5. Cập nhật rating, tăng `total_matches`, `wins`/`losses`.
6. Lưu `rating_changes` snapshot vào bảng `matches`.

### Worked Example

> An (1600) thắng Bình (1500) với tỷ số 15–11.

```
E_An   = 1 / (1 + 10^((1500-1600)/400)) = 0.640
diff   = 4,  gap = 100
M      = ln(5) * 2.2 / (0.001*100 + 2.2) = 1.540
K      = 24  (cả hai > 30 trận)

ΔR_An   = 24 * 1.540 * (1 - 0.640) = +13.3  →  1613.3
ΔR_Bình = 24 * 1.540 * (0 - 0.360) = −13.3  →  1486.7
```

---

## 5. Doubles Match Logic

### 5.1 Team Rating

Mỗi đội được đại diện bởi rating trung bình:

```
R_TeamA = (R_A1 + R_A2) / 2
R_TeamB = (R_B1 + R_B2) / 2
```

### 5.2 Expected Score & M

Tính `E_TeamA` dùng `R_TeamA` vs `R_TeamB` (công thức giống singles). Tính `M` dùng `|R_TeamA - R_TeamB|` làm `rating_gap`.

### 5.3 Individual Rating Updates

Mỗi thành viên nhận delta riêng dựa trên K cá nhân, nhưng dùng chung `E` và `M` của đội:

```
ΔR_A1 = clamp(K_A1 * M * (1 - E_TeamA), -50, +50)
ΔR_A2 = clamp(K_A2 * M * (1 - E_TeamA), -50, +50)
ΔR_B1 = clamp(K_B1 * M * (0 - E_TeamB), -50, +50)   // E_TeamB = 1 - E_TeamA
ΔR_B2 = clamp(K_B2 * M * (0 - E_TeamB), -50, +50)
```

> **Lưu ý:** Doubles và singles dùng chung một trường `rating`. Sau trận doubles, rating mới này sẽ được dùng cho cả trận singles tiếp theo. Đây là thiết kế intentional — rating phản ánh kỹ năng tổng thể của người chơi.

### 5.4 Worked Example

> (An 1600 + Cường 1400) thắng (Bình 1500 + Dũng 1550) tỷ số 15–9.

```
R_TeamA = (1600+1400)/2 = 1500
R_TeamB = (1500+1550)/2 = 1525
E_TeamA = 1 / (1 + 10^(25/400)) = 0.464
diff    = 6,  gap = 25
M       = ln(7) * 2.2 / (0.001*25 + 2.2) = 1.925

An    (K=24): +24 * 1.925 * (1 - 0.464) = +24.8  →  1624.8
Cường (K=32): +32 * 1.925 * (1 - 0.464) = +33.0  →  1433.0
Bình  (K=24): −24 * 1.925 * (1 - 0.464) = −24.8  →  1475.2
Dũng  (K=24): −24 * 1.925 * (1 - 0.464) = −24.8  →  1525.2
```

---

## 6. Database Schema

### Table: `players`

```sql
players
  id               UUID / INT    PRIMARY KEY
  name             VARCHAR(100)  NOT NULL
  rating           FLOAT         DEFAULT 1500
  total_matches    INT           DEFAULT 0
  singles_matches  INT           DEFAULT 0
  doubles_matches  INT           DEFAULT 0
  wins             INT           DEFAULT 0
  losses           INT           DEFAULT 0
  created_at       TIMESTAMP
  updated_at       TIMESTAMP
```

> `total_matches` dùng để tính K-factor. `singles_matches` và `doubles_matches` là optional — hữu ích cho hiển thị thống kê.

### Table: `matches`

```sql
matches
  id               UUID / INT    PRIMARY KEY
  match_type       ENUM('singles', 'doubles')
  played_at        TIMESTAMP
  score_winner     INT           -- luôn là 15
  score_loser      INT           -- 0–14
  winner_ids       INT[]         -- 1 hoặc 2 player IDs
  loser_ids        INT[]         -- 1 hoặc 2 player IDs
  rating_changes   JSONB         -- { player_id: delta, ... } snapshot đầy đủ
  created_by       INT           REFERENCES players(id)
```

> `rating_changes` lưu snapshot delta tại thời điểm ghi trận — cần thiết để rollback chính xác.

---

## 7. API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/matches` | Ghi trận mới, áp dụng ELO atomically |
| `GET` | `/api/players` | Danh sách tất cả player với rating hiện tại |
| `GET` | `/api/players/:id` | Profile player: lịch sử trận, rating timeline |
| `GET` | `/api/leaderboard` | Bảng xếp hạng chung (có thể filter theo match_type) |
| `DELETE` | `/api/matches/:id` | Rollback trận (admin only) |

### POST /api/matches — Request Body

```json
{
  "match_type": "singles" | "doubles",
  "winner_ids": [number],        // 1 ID (singles) hoặc 2 ID (doubles)
  "loser_ids":  [number],        // 1 ID (singles) hoặc 2 ID (doubles)
  "score_winner": 15,
  "score_loser": number,         // 0–14
  "played_at": "ISO-8601"        // optional, mặc định = now
}
```

### GET /api/leaderboard — Response

```json
[
  {
    "rank": 1,
    "player_id": 3,
    "name": "An",
    "rating": 1624.8,
    "total_matches": 42,
    "wins": 27,
    "losses": 15,
    "win_rate": 0.643
  },
  ...
]
```

---

## 8. Implementation Pseudocode

### 8.1 Core ELO Helper

```js
function computeDelta(rSelf, rOpponent, result, k, scoreDiff, ratingGap) {
  const E = 1 / (1 + Math.pow(10, (rOpponent - rSelf) / 400))
  const M = Math.log(scoreDiff + 1) * 2.2 / (0.001 * ratingGap + 2.2)
  return clamp(k * M * (result - E), -50, 50)
}

function getK(totalMatches) {
  if (totalMatches < 10) return 40
  if (totalMatches < 30) return 32
  return 24
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}
```

### 8.2 Record Singles Match

```js
async function recordSingles(winnerId, loserId, winnerScore, loserScore) {
  const [winner, loser] = await db.players.getMany([winnerId, loserId])
  const diff   = winnerScore - loserScore
  const gap    = Math.abs(winner.rating - loser.rating)

  const dWinner = computeDelta(winner.rating, loser.rating, 1, getK(winner.total_matches), diff, gap)
  const dLoser  = computeDelta(loser.rating, winner.rating, 0, getK(loser.total_matches),  diff, gap)

  await db.transaction(async (tx) => {
    await tx.players.update(winnerId, {
      rating:         winner.rating + dWinner,
      total_matches:  winner.total_matches + 1,
      singles_matches: winner.singles_matches + 1,
      wins:           winner.wins + 1,
    })
    await tx.players.update(loserId, {
      rating:         loser.rating + dLoser,
      total_matches:  loser.total_matches + 1,
      singles_matches: loser.singles_matches + 1,
      losses:         loser.losses + 1,
    })
    await tx.matches.insert({
      match_type:    'singles',
      winner_ids:    [winnerId],
      loser_ids:     [loserId],
      score_winner:  winnerScore,
      score_loser:   loserScore,
      rating_changes: { [winnerId]: dWinner, [loserId]: dLoser },
      played_at:     new Date(),
    })
  })
}
```

### 8.3 Record Doubles Match

```js
async function recordDoubles(w1Id, w2Id, l1Id, l2Id, winnerScore, loserScore) {
  const [w1, w2, l1, l2] = await db.players.getMany([w1Id, w2Id, l1Id, l2Id])

  const rTeamW  = (w1.rating + w2.rating) / 2
  const rTeamL  = (l1.rating + l2.rating) / 2
  const diff    = winnerScore - loserScore
  const gap     = Math.abs(rTeamW - rTeamL)
  const eTeamW  = 1 / (1 + Math.pow(10, (rTeamL - rTeamW) / 400))
  const M       = Math.log(diff + 1) * 2.2 / (0.001 * gap + 2.2)

  const dW1 = clamp(getK(w1.total_matches) * M * (1 - eTeamW), -50, 50)
  const dW2 = clamp(getK(w2.total_matches) * M * (1 - eTeamW), -50, 50)
  const dL1 = clamp(getK(l1.total_matches) * M * (0 - eTeamW), -50, 50)
  const dL2 = clamp(getK(l2.total_matches) * M * (0 - eTeamW), -50, 50)

  await db.transaction(async (tx) => {
    for (const [player, delta, isWinner] of [[w1,dW1,true],[w2,dW2,true],[l1,dL1,false],[l2,dL2,false]]) {
      await tx.players.update(player.id, {
        rating:          player.rating + delta,
        total_matches:   player.total_matches + 1,
        doubles_matches: player.doubles_matches + 1,
        wins:            isWinner ? player.wins + 1 : player.wins,
        losses:          isWinner ? player.losses : player.losses + 1,
      })
    }
    await tx.matches.insert({
      match_type:     'doubles',
      winner_ids:     [w1Id, w2Id],
      loser_ids:      [l1Id, l2Id],
      score_winner:   winnerScore,
      score_loser:    loserScore,
      rating_changes: { [w1Id]: dW1, [w2Id]: dW2, [l1Id]: dL1, [l2Id]: dL2 },
      played_at:      new Date(),
    })
  })
}
```

### 8.4 Rollback Match

```js
async function rollbackMatch(matchId) {
  const match = await db.matches.get(matchId)

  await db.transaction(async (tx) => {
    for (const [playerId, delta] of Object.entries(match.rating_changes)) {
      const player = await tx.players.get(playerId)
      const isWinner = match.winner_ids.includes(Number(playerId))
      await tx.players.update(playerId, {
        rating:        player.rating - delta,   // reverse chính xác
        total_matches: player.total_matches - 1,
        wins:          isWinner ? player.wins - 1 : player.wins,
        losses:        isWinner ? player.losses : player.losses - 1,
      })
    }
    await tx.matches.delete(matchId)
  })
}
```

---

## 9. Validation Rules

| Rule | Hành động |
|---|---|
| `score_winner` phải bằng 15 | Reject 400 |
| `score_loser` phải trong [0, 14] | Reject 400 |
| Singles: mỗi bên đúng 1 player | Reject 400 |
| Doubles: mỗi bên đúng 2 player | Reject 400 |
| Không trùng player ID giữa 2 đội | Reject 400 |
| Không tự đánh với chính mình | Reject 400 |
| Rating không được giảm dưới 100 | Soft floor: `Math.max(100, newRating)` |
| Delta tối đa mỗi trận | Clamp `[-50, +50]` |

---

## 10. Testing Checklist

- [ ] **Equal ratings, singles:** Winner gains ~K/2 điểm với score 15–8.
- [ ] **Upset bonus:** Người có rating thấp hơn thắng → delta lớn hơn trường hợp ngược lại.
- [ ] **M values:** Score 15–14 → M ≈ 0.69; score 15–0 → M ≈ 2.77.
- [ ] **K transitions:** Player ở đúng trận thứ 10 và 30 dùng đúng K.
- [ ] **Doubles zero-sum:** Tổng delta 4 người ≈ 0 (khi cùng K). Cho phép sai lệch nhỏ khi K khác nhau.
- [ ] **Shared leaderboard:** Sau trận doubles, rating mới của player xuất hiện đúng trên bảng xếp hạng chung.
- [ ] **Rollback:** `rating - delta` khôi phục rating chính xác cho cả 4 người (doubles).
- [ ] **Validation:** `score_winner=14`, player trùng ID → trả về 400.
- [ ] **Rating floor:** Rating không bao giờ xuống dưới 100 dù thua liên tiếp.

---

## 11. Optional Extensions (Future)

- **Activity decay:** Sau 60+ ngày không chơi, tạm thời tăng K về 32 trong 3 trận đầu khi quay lại.
- **Season reset:** Soft reset về 1500 mỗi mùa: `new_rating = rating * 0.75 + 1500 * 0.25`.
- **Rating timeline chart:** Biểu đồ rating theo thời gian trên profile từng player.
- **Match statistics:** Hiển thị breakdown wins/losses theo singles vs doubles trong profile.
- **Win streak display:** Ghi nhận và hiển thị chuỗi thắng hiện tại trên leaderboard.

---

*End of specification — v1.1*
