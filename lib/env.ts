import { logger } from '@/lib/logger';
import { z } from 'zod'

const envSchema = z.object({
    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

    // M-PESA
    MPESA_CONSUMER_KEY: z.string().min(1),
    MPESA_CONSUMER_SECRET: z.string().min(1),
    MPESA_PAYBILL: z.string().min(1),
    MPESA_PASSKEY: z.string().min(1),
    MPESA_CALLBACK_URL: z.string().url(),
    MPESA_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),

    // Stripe
    STRIPE_SECRET_KEY: z.string().min(1),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),

    // Redis (optional — falls back to in-memory event bus)
    REDIS_URL: z.string().optional(),

    // Notifications (optional — falls back to log-only)
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    AFRICASTALKING_API_KEY: z.string().optional(),
    AFRICASTALKING_USERNAME: z.string().optional(),
    SMS_FROM: z.string().optional(),

    // Webhook notifications (optional)
    WEBHOOK_NOTIFICATION_URL: z.string().url().optional(),
    WEBHOOK_NOTIFICATION_SECRET: z.string().optional(),

    // FCM push notifications (optional)
    FIREBASE_SERVER_KEY: z.string().optional(),

    // AI (optional — AI features gracefully degrade without it)
    OPENROUTER_API_KEY: z.string().optional(),

    // Optional with defaults
    MPESA_ACCOUNT_REFERENCE: z.string().optional().default('WINNMATT'),
    MPESA_FAILURE_EMAIL: z.string().email().optional(),
    NEXT_PUBLIC_APP_NAME: z.string().optional().default('Winnmatt POS'),
    NEXT_PUBLIC_API_URL: z.string().optional(),
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
