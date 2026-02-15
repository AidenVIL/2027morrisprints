Web (Next.js) README

Run locally:

```bash
cd web
pnpm install
pnpm dev
```

Environment variables: see ../.env.example

Notes:
- This app expects Supabase bucket `models` and the SQL schema in `../schema.sql` applied to your Supabase project.
- The `HOLD_AMOUNT_PENCE` env sets the amount authorised at creation time.
- Admin actions (capture/cancel/download) are exposed at `/api/admin/quotes/:id/*` and require a Supabase JWT for an admin user.
- You must set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in env.
