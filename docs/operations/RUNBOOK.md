# Operations Runbook — Winnmatt POS

## Health & Status

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `GET /api/health` | Database connectivity + event bus mode | `{ status: "healthy", database: { ok: true }, eventBus: { mode: "redis" \| "in-memory" } }` |
| Health check frequency | 30s (external monitoring) | 200 = healthy, 503 = degraded |

## Logging

- **Library:** Structured JSON logger at `lib/logger.ts`
- **Log levels:** `debug` (dev only), `info`, `warn`, `error`
- **Format:** `{ level, message, timestamp, ...context }`
- **PII redaction:** Phone numbers, UUIDs, transaction refs, and sensitive keys auto-redacted
- **Viewing:** In production, logs go to `stdout` (Vercel dashboard / PaaS log stream)

## Error Monitoring

- **Sentry** (`@sentry/nextjs`) enabled when `NODE_ENV=production` and `SENTRY_DSN` is set
- Traces sample rate: 20% in production
- Sentry tunnel: `/monitoring` (bypasses ad blockers)

## Deployment

### Prerequisites (env vars)
See `.env.example` for full list. Required:

| Variable | Source |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project |
| `MPESA_CONSUMER_KEY` | Safaricom Daraja |
| `MPESA_CONSUMER_SECRET` | Safaricom Daraja |
| `MPESA_PAYBILL` | Safaricom |
| `MPESA_PASSKEY` | Safaricom |
| `MPESA_CALLBACK_URL` | Public HTTPS URL |
| `STRIPE_SECRET_KEY` | Stripe dashboard |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe dashboard |

### Rollback Plan

1. **Vercel:** Trigger redeploy of last known-good deployment
   ```
   vercel rollback
   ```
2. **Migrations:** To revert the last migration:
   ```sql
   -- Find the last migration applied
   SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1;
   -- Manually reverse its changes (specific to each migration)
   ```
3. **Database backup restore:**
   ```bash
   psql "$SUPABASE_DB_URL" < backups/backup_YYYY-MM-DD.sql
   ```

### Database Backups

- **Scripts:** `scripts/backup-db.sh` (Linux/macOS), `scripts/backup-db.bat` (Windows)
- **Output:** `./backups/backup_YYYY-MM-DD.sql`
- **Requires:** `SUPABASE_DB_URL` env var
- **Recommendation:** Run as daily cron job in production

## Incident Response

### 1. Payment Processing Down (M-Pesa / Stripe)
1. Check `/api/health` — if degraded, check Supabase status
2. Check M-Pesa callback logs for `callback_received_at` timestamps
3. Check Sentry for recent errors
4. If M-Pesa: verify `MPESA_CONSUMER_KEY`/`SECRET` are valid
5. If Stripe: check Stripe dashboard for API status

### 2. Application Not Loading
1. Check Vercel deployment logs
2. Check Sentry for client-side errors
3. Verify env vars are set in Vercel dashboard
4. Run `npm run verify-db` to check DB schema

### 3. Authentication Issues
1. Check Supabase auth logs
2. Verify JWT secret hasn't changed
3. Check `NEXT_PUBLIC_SUPABASE_ANON_KEY` matches Supabase project

## Monitoring Checklist (Post-Deployment)

- [ ] `/api/health` returns 200
- [ ] Sentry reports no new errors after 5 minutes
- [ ] M-Pesa STK Push test transaction succeeds
- [ ] Login flow works
- [ ] POS page loads and can scan products
- [ ] Shift open/close flow works
- [ ] Analytics pages render without errors
