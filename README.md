# Pickleball Hub

Single-group pickleball management app built with:

- Next.js App Router
- TypeScript
- Prisma
- PostgreSQL
- Tailwind CSS

## Local setup (macOS)

### Yêu cầu

- **Node.js** ≥ 20 ([tải tại nodejs.org](https://nodejs.org))
- **npm** ≥ 10 (đi kèm Node.js)
- **PostgreSQL** ≥ 14 — cài bằng [Homebrew](https://brew.sh) hoặc [Postgres.app](https://postgresapp.com)

```bash
# Cài PostgreSQL qua Homebrew (nếu chưa có)
brew install postgresql@16
brew services start postgresql@16
```

### Các bước cài đặt

1. **Cài dependencies**

   ```bash
   npm install
   ```

   > ⚠️ Nếu gặp lỗi `EBADPLATFORM` liên quan đến `@next/swc-linux-x64-gnu`, hãy đảm bảo bạn đã pull code mới nhất (đã được fix).

2. **Tạo file môi trường**

   ```bash
   cp .env.example .env
   ```

3. **Tạo database và cấu hình DATABASE_URL**

   ```bash
   # Tạo database local (nếu chưa có)
   createdb picklehub

   # Chỉnh file .env — thay đổi DATABASE_URL phù hợp, ví dụ:
   # DATABASE_URL="postgresql://localhost:5432/picklehub"
   ```

4. **Sync schema vào database**

   ```bash
   npm run db:push
   ```

5. **Tạo tài khoản admin đầu tiên** (tùy chọn)

   ```bash
   SEED_ADMIN_EMAIL="admin@example.com" \
   SEED_ADMIN_PASSWORD="change-this-password" \
   npm run db:seed
   ```

6. **Chạy môi trường dev**

   ```bash
   npm run dev
   ```

   App mặc định chạy tại [http://localhost:3000](http://localhost:3000).

---

## Vercel deployment

This project is prepared for Vercel with a Vercel-provided PostgreSQL database.

1. Create a Postgres database from the Vercel dashboard and connect it to the project.
2. Set the project build command to:

   ```bash
   npm run vercel-build
   ```

3. Set required environment variables in Vercel:

   - `DATABASE_URL`
   - `SESSION_COOKIE_NAME`
   - `VIEW_MODE_COOKIE_NAME`

4. Deploy.

**Important:**

- `npm run vercel-build` does not run `prisma db push`
- Apply schema changes separately, not during every Vercel build

For example, run schema sync manually from a trusted environment with production env vars loaded:

```bash
npx prisma db push
```

After the first schema sync, create the initial admin user once by running the seed script against the production environment with:

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- optional: `SEED_ADMIN_NAME`
- optional: `SEED_ADMIN_PHONE`

The seed is safe to re-run. It upserts a single admin user and does not wipe data.

---

## Useful scripts

```bash
npm run dev           # Start dev server
npm run build         # Build production bundle
npm run lint          # Run ESLint
npm run db:push       # Sync Prisma schema → database
npm run db:seed       # Seed initial admin user
npm run vercel-build  # prisma generate + next build (Vercel CI)
```
