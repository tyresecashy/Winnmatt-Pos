import { logger } from '@/lib/logger';
import { z } from 'zod'

/**
 * Preprocess: trim string values that may contain trailing CR/LF from Vercel env UI.
 */
const trimString = (s: unknown) => (typeof s === 'string' ? s.trim() : s)

const envSchema = z.object({
    // ── Supabase (required) ────────────────────────────────────────────────
    // All three must be present for database and auth to function.
    NEXT_PUBLIC_SUPABASE_URL: z.preprocess(trimString, z.string().url()),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(trimString, z.string().min(1)),
    SUPABASE_SERVICE_ROLE_KEY: z.preprocess(trimString, z.string().min(1)),

    // ── M-Pesa Daraja (optional — Mobile POS only) ────────────────────────
    // Legacy Safaricom Daraja integration used only by the Mobile POS.
    // The app starts without these; Mobile POS will show "M-Pesa unavailable"
    // if they are absent. Read via process.env.MPESA_* directly at runtime.
    // Production value for MPESA_PASSKEY must be obtained from the Safaricom
    // Daraja portal (App Settings > Security Credentials).
    MPESA_CONSUMER_KEY: z.preprocess(trimString, z.string()).optional(),
    MPESA_CONSUMER_SECRET: z.preprocess(trimString, z.string()).optional(),
    MPESA_PAYBILL: z.preprocess(trimString, z.string()).optional(),
    MPESA_PASSKEY: z.preprocess(trimString, z.string()).optional(),
    MPESA_CALLBACK_URL: z.preprocess(trimString, z.string()).optional(),
    MPESA_ENVIRONMENT: z.preprocess(trimString, z.enum(['sandbox', 'production'])).optional().default('sandbox'),
    MPESA_ACCOUNT_REFERENCE: z.preprocess(trimString, z.string()).optional().default('WINNMATT'),

    // ── Tuma Payments (required — primary M-Pesa gateway) ─────────────────
    // Primary payment provider for the main POS. The POS cannot process
    // payments without these. TUMA_API_URL defaults to https://api.tuma.co.ke.
    TUMA_API_KEY: z.preprocess(trimString, z.string().min(1)),
    TUMA_BUSINESS_EMAIL: z.preprocess(trimString, z.string().email()),
    TUMA_API_URL: z.preprocess(trimString, z.string().url().default('https://api.tuma.co.ke')),
    TUMA_CALLBACK_URL: z.preprocess(trimString, z.string().url()),

    // ── Stripe (required — card payments) ─────────────────────────────────
    // Used for card payment processing in the POS and Stripe Checkout.
    STRIPE_SECRET_KEY: z.preprocess(trimString, z.string().min(1)),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.preprocess(trimString, z.string().min(1)),

    // ── Redis (optional — falls back to in-memory event bus) ──────────────
    // Without Redis, the event bus runs in-memory: events are delivered only
    // to currently-connected SSE clients. Events are lost on server restart.
    REDIS_URL: z.preprocess(trimString, z.string()).optional(),

    // ── Notifications (optional — falls back to log-only) ─────────────────
    // Email via Resend, SMS via Africa's Talking. When absent, notification
    // calls log the message to notification_logs without sending.
    RESEND_API_KEY: z.preprocess(trimString, z.string()).optional(),
    EMAIL_FROM: z.preprocess(trimString, z.string()).optional(),
    AFRICASTALKING_API_KEY: z.preprocess(trimString, z.string()).optional(),
    AFRICASTALKING_USERNAME: z.preprocess(trimString, z.string()).optional(),
    SMS_FROM: z.preprocess(trimString, z.string()).optional(),

    // ── Webhook notifications (optional) ──────────────────────────────────
    // Outgoing webhooks for external system integration.
    WEBHOOK_NOTIFICATION_URL: z.preprocess(trimString, z.string().url()).optional(),
    WEBHOOK_NOTIFICATION_SECRET: z.preprocess(trimString, z.string()).optional(),

    // ── FCM push notifications (optional) ─────────────────────────────────
    // Firebase Cloud Messaging for mobile push notifications.
    FIREBASE_SERVER_KEY: z.preprocess(trimString, z.string()).optional(),

    // ── AI assistant (optional — gracefully degrades) ─────────────────────
    // OpenRouter key for the AI Functional Assistant. Without it the AI
    // chat UI shows a "not available" message.
    OPENROUTER_API_KEY: z.preprocess(trimString, z.string()).optional(),
  })

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  logger.error('❌ Invalid environment variables:')
  for (const issue of parsed.error.issues) {
    logger.error(`  - ${issue.path.join('.')}: ${issue.message}`)
  }
  throw new Error('Invalid environment variables — check logs above')
}

export const env = parsed.data
