# Pickleball Hub

Single-group pickleball management app built with:

- Next.js App Router
- TypeScript
- Prisma
- PostgreSQL
- Tailwind CSS

## Local setup

1. Install dependencies

```bash
npm install
```

2. Set environment variables

```bash
cp .env.example .env
```

3. Point `DATABASE_URL` to a PostgreSQL database, then sync the schema

```bash
npm run db:push
```

4. Optionally bootstrap the first admin account

```bash
SEED_ADMIN_EMAIL="admin@example.com" \
SEED_ADMIN_PASSWORD="change-this-password" \
npm run db:seed
```

5. Start the app

```bash
npm run dev
```

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

Important:

- `npm run vercel-build` does not run `prisma db push`
- apply schema changes separately, not during every Vercel build

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

## Useful scripts

```bash
npm run dev
npm run build
npm run lint
npm run db:push
npm run db:seed
npm run vercel-build
```
