# Picklehub — CLAUDE.md

Tài liệu kỹ thuật nội bộ cho dự án Picklehub. Đọc file này trước khi bắt đầu bất kỳ task lập trình nào.

---

## 1. Tổng quan dự án

**Picklehub** là ứng dụng quản lý nhóm pickleball (~10 người), bao gồm:

- **ELO Rating**: Xếp hạng kỹ năng tự động cho cả singles lẫn doubles
- **Quản lý thành viên**: Hồ sơ, tài khoản đăng nhập, trạng thái hoạt động
- **Quản lý buổi chơi & lịch cố định**: Đặt lịch, đăng ký, điểm danh
- **Tài chính nhóm**: Chi phí sân, thanh toán, cân đối công nợ

---

## 2. Tech stack

| Layer | Công nghệ |
|-------|-----------|
| Framework | Next.js 16.2.2 (App Router) |
| UI | React 19.2.4, Tailwind CSS 4, Lucide React |
| Language | TypeScript 5.x |
| Database | PostgreSQL + Prisma ORM 6.16.2 |
| Auth | bcryptjs 3.0.3, HTTP-only session cookies |
| Validation | Zod 4.3.6 |
| UI Components | class-variance-authority (CVA) |

---

## 3. Development Setup

```bash
npm run dev          # Chạy dev server (port 3000)
npx prisma studio    # GUI quản lý database
npx prisma migrate dev --name <tên>   # Tạo migration mới
npx prisma generate  # Regenerate Prisma client sau khi đổi schema
```

**Biến môi trường** (`.env`):
```
DATABASE_URL=postgresql://...
SESSION_COOKIE_NAME=pickleball_session
VIEW_MODE_COOKIE_NAME=pickleball_view_mode
```

---

## 4. Kiến trúc & patterns

- **Server Components** là mặc định; chỉ dùng `"use client"` khi cần state/interactivity
- **Server Actions** cho mutations (form submit, CRUD) — dùng `"use server"` trong `src/lib/finance.ts`
- **API Routes** tại `/api/*` cho match, leaderboard, player profile (trả JSON)
- **Session-based auth**: Cookie HTTP-only, 14 ngày; hàm `getCurrentUser()` được `cache()` trong React
- **Role-based access**: `ADMIN` (quản lý toàn bộ) vs `MEMBER` (tự phục vụ)
- **View mode**: Admin có thể toggle sang MEMBER view qua `switchViewMode()`
- **Prisma transactions**: Bắt buộc dùng cho mọi thao tác cập nhật ELO và tài chính để đảm bảo atomicity

---

## 5. Database Schema

File: [prisma/schema.prisma](prisma/schema.prisma)

### Các model chính

| Model | Mô tả |
|-------|-------|
| `User` | Tài khoản đăng nhập (email + passwordHash + role) |
| `Member` | Hồ sơ người chơi (tách khỏi User để hỗ trợ thành viên chưa có tài khoản) |
| `AuthSession` | Session đăng nhập, token lưu trong cookie |
| `Match` | Lịch sử trận đấu ELO |
| `Session` | Buổi chơi cụ thể (PLANNED / COMPLETED / CANCELLED) |
| `Schedule` | Lịch chơi cố định hàng tuần |
| `ScheduleDefaultMember` | Thành viên mặc định của lịch |
| `ScheduleDefaultExpense` | Chi phí mặc định của lịch |
| `Attendance` | Điểm danh thành viên trong buổi |
| `SessionRegistration` | Đăng ký tham gia buổi |
| `Expense` | Chi phí nhóm (gắn session hoặc độc lập) |
| `ExpensePayer` | Ai chịu bao nhiêu tiền cho chi phí |
| `Payment` | Thanh toán trực tiếp giữa hai thành viên |
| `LedgerEntry` | Sổ cái bất biến — nguồn sự thật cho số dư |

### Quan hệ quan trọng
- `User` ↔ `Member`: optional 1:1 (member có thể chưa có tài khoản)
- `Member.rating`: ELO rating dùng chung cho cả singles và doubles
- `Match.ratingChanges`: JSON snapshot `{memberId: delta}` — dùng để rollback chính xác

---

## 6. Tính năng: Quản lý thành viên

**Pages**: [src/app/members/](src/app/members/) (admin only)

### Member model — các trường ELO
```
rating          Float   @default(1500)
totalMatches    Int     @default(0)   -- dùng để tính K-factor
singlesMatches  Int     @default(0)
doublesMatches  Int     @default(0)
eloWins         Int     @default(0)
eloLosses       Int     @default(0)
```

### Server Actions (trong [src/lib/finance.ts](src/lib/finance.ts))
- `createMember(formData)` — tạo thành viên mới
- `updateMember(formData)` — cập nhật thông tin, trạng thái
- `upsertMemberUser(formData)` — tạo/cập nhật tài khoản User gắn với Member, set role

### Trạng thái
- `ACTIVE` — có thể tham gia buổi chơi, thi đấu ELO
- `INACTIVE` — không xuất hiện trên leaderboard, không thể check-in

---

## 7. Tính năng: ELO Rating System

**File thuật toán**: [src/lib/elo.ts](src/lib/elo.ts)

**Spec đầy đủ**: [elo_spec.md](elo_spec.md)

### Thuật toán

#### K-factor (động theo kinh nghiệm)
```
totalMatches < 10  → K = 40   (người mới, hội tụ nhanh)
10 ≤ total < 30    → K = 32
total ≥ 30         → K = 24   (ổn định)
```

#### Xác suất thắng kỳ vọng
```
E_A = 1 / (1 + 10^((R_B - R_A) / 400))
```

#### Margin of Victory (M) — thưởng tỷ số chênh lệch
```
M = ln(score_diff + 1) × 2.2 / (0.001 × rating_gap + 2.2)
```
- `score_diff` = điểm thắng − điểm thua (1–15)
- `rating_gap` = |R_winner − R_loser| (singles) hoặc |R_teamW_avg − R_teamL_avg| (doubles)
- Mẫu số chống farming: đánh bại người yếu hơn nhiều → M giảm

**Giá trị M tham khảo** (không có rating gap):
| Tỷ số | M |
|-------|---|
| 15-14 | ≈ 0.69 |
| 15-10 | ≈ 1.79 |
| 15-5  | ≈ 2.48 |
| 15-0  | ≈ 2.77 |

#### Delta cuối cùng
```
ΔR = clamp(K × M × (S − E), -50, +50)
rating_new = max(rating + ΔR, 100)   -- floor 100
```

### Singles
- 1 người thắng vs 1 người thua
- `rating_gap` = |R_winner − R_loser|
- Mỗi người dùng K riêng theo `totalMatches` của mình

### Doubles
- Team rating = trung bình 2 người: `R_team = (R_A + R_B) / 2`
- E và M tính theo team rating
- Mỗi người trong team nhận delta riêng theo K của họ nhưng dùng chung E, M của team

### API Endpoints

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/api/matches` | Admin | Ghi trận mới, cập nhật ELO (atomic) |
| GET | `/api/matches` | User | Danh sách trận, query: `type`, `limit` (max 100) |
| GET | `/api/matches/[id]` | User | Chi tiết 1 trận |
| DELETE | `/api/matches/[id]` | Admin | Rollback trận — hoàn trả ELO |
| GET | `/api/leaderboard` | User | Bảng xếp hạng active members |
| GET | `/api/players/[id]` | User | Hồ sơ + lịch sử thi đấu |

### Request body — POST /api/matches
```json
{
  "match_type": "singles|doubles",
  "winner_ids": ["id1"],
  "loser_ids": ["id2"],
  "score_winner": 15,
  "score_loser": 11,
  "played_at": "2026-05-05T10:00:00Z"
}
```

### Validation
- `score_winner > score_loser`
- Singles: đúng 1 winner, 1 loser
- Doubles: đúng 2 winners, 2 losers
- Không trùng player ID giữa hai đội

### Rollback
`DELETE /api/matches/[id]` dùng `match.ratingChanges` snapshot để đảo ngược chính xác:
```
rating = rating - delta
totalMatches -= 1
singlesMatches hoặc doublesMatches -= 1
eloWins hoặc eloLosses -= 1
```

---

## 8. Tính năng: Session & Schedule

### Session (buổi chơi)
- **Pages**: [src/app/sessions/](src/app/sessions/) và [src/app/sessions/[id]/](src/app/sessions/)
- Trạng thái: `PLANNED` → `COMPLETED` / `CANCELLED`
- Khi `completeSession()`: tự động tạo session tiếp theo nếu từ schedule định kỳ
- Không được sửa session đã `COMPLETED`

### Schedule (lịch định kỳ)
- **Pages**: [src/app/schedules/](src/app/schedules/) (admin only)
- Lặp hàng tuần theo `weekday` (SUNDAY–SATURDAY enum)
- `defaultMembers` → auto-register khi tạo session
- `defaultExpenses` → auto-thêm chi phí khi tạo session

---

## 9. Tính năng: Tài chính

**File**: [src/lib/finance.ts](src/lib/finance.ts)

### Nguyên tắc
- `LedgerEntry` là bất biến — không xóa, chỉ thêm
- Số dư = tổng tất cả LedgerEntry của thành viên
- Loại entry: `EXPENSE` (âm), `PAYMENT` (dương cho người nhận), `ADJUSTMENT` (thủ công)

### Hàm quan trọng
- `splitAmountEvenly(totalAmount, participantIds)` — chia đều, phần dư phân bổ cho người đầu
- `formatCents(cents)` — hiển thị VND (không có decimal)
- `parseMoneyToCents(input)` — parse input người dùng sang integer (cents)
- `addMemberBalance(formData)` — điều chỉnh thủ công (số dư đầu kỳ, thanh toán nhận)

### Constraint
- Không thể thêm/xóa chi phí của session đã `COMPLETED`
- Không thể xóa thành viên khỏi session nếu đã có chi phí liên quan

---

## 10. Authentication

**File**: [src/lib/auth.ts](src/lib/auth.ts)

### Hàm chính
- `getCurrentUser()` — React `cache()`, đọc cookie session, trả về user hoặc null
- `requireUser()` — redirect `/login` nếu chưa đăng nhập
- `requireRole('ADMIN')` — redirect nếu không đủ quyền
- `signIn(email, password)` — bcrypt verify, tạo `AuthSession`, set cookie
- `signOut()` — xóa session DB + clear cookie
- `getViewMode()` — admin đang xem ở mode nào (`ADMIN` hoặc `MEMBER`)

---

## 11. Key Files

| File | Chức năng |
|------|-----------|
| [src/lib/elo.ts](src/lib/elo.ts) | Thuật toán ELO (K-factor, Expected, Margin, Delta) |
| [src/lib/auth.ts](src/lib/auth.ts) | Authentication, session, role check |
| [src/lib/finance.ts](src/lib/finance.ts) | Server actions: member, session, schedule, expense |
| [prisma/schema.prisma](prisma/schema.prisma) | Toàn bộ data model |
| [src/app/api/matches/route.ts](src/app/api/matches/route.ts) | API ghi/đọc trận đấu |
| [src/app/api/matches/[id]/route.ts](src/app/api/matches/[id]/route.ts) | API xem/xóa trận |
| [src/app/api/leaderboard/route.ts](src/app/api/leaderboard/route.ts) | API bảng xếp hạng |
| [src/app/api/players/[id]/route.ts](src/app/api/players/[id]/route.ts) | API hồ sơ người chơi |
| [src/app/matches/](src/app/matches/) | Pages lịch sử trận + tạo trận |
| [src/app/leaderboard/](src/app/leaderboard/) | Page bảng xếp hạng |
| [src/app/members/](src/app/members/) | Pages quản lý thành viên |
| [src/components/app-shell.tsx](src/components/app-shell.tsx) | Navigation shell |
| [elo_spec.md](elo_spec.md) | Spec đầy đủ của hệ thống ELO |

---

## 12. Conventions

- **Không dùng `"use client"` trừ khi cần** state, event handler, hoặc browser API
- **Mutation = Server Action** (trong `finance.ts`) hoặc API Route — không tạo client-side fetch tùy tiện
- **Tiền tệ luôn lưu dạng integer (cents/VND nguyên)** — không dùng float
- **ELO delta lưu dạng số thực** (float) trong `ratingChanges` JSON
- **Mọi cập nhật ELO và tài chính phải trong Prisma transaction**
- **Không xóa LedgerEntry** — nếu cần hoàn trả, tạo entry ngược dấu
