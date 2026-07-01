/* eslint-disable no-console */
type Level = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: Level
  message: string
  context?: Record<string, unknown>
  timestamp: string
}

const IS_PROD = process.env.NODE_ENV === 'production'
const IS_DEV = process.env.NODE_ENV === 'development'

/** Redact sensitive fields from log context (phone, tx refs, userId, saleId) */
function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[circular]'
  if (typeof value === 'string') {
    return value
      .replace(/\b\d{9,13}\b/g, '***PHONE***')
      .replace(/\b(WS|ws|wsr)[a-zA-Z0-9]{8,}\b/g, '***TX***')
      .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, '***UUID***')
  }
  if (typeof value !== 'object' || value === null) return value
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1))
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const sensitiveKeys = ['phone', 'phoneNumber', 'phone_number', 'rawPhoneNumber', 'normalizedPhoneNumber',
      'userId', 'user_id', 'saleId', 'sale_id', 'checkoutRequestId', 'merchantRequestId',
      'paybill', 'accountReference', 'account_reference', 'callbackUrl', 'callback_url',
      'passkey', 'consumerKey', 'consumerSecret', 'password', 'secret']
    if (sensitiveKeys.includes(key)) {
      result[key] = val ? '***REDACTED***' : val
    } else {
      result[key] = redact(val, depth + 1)
    }
  }
  return result
}

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry)
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>) {
    if (IS_PROD) return
    console.debug(formatEntry({
      level: 'debug',
      message,
      context: context ? redact(context) as Record<string, unknown> : undefined,
      timestamp: new Date().toISOString(),
    }))
  },

  info(message: string, context?: Record<string, unknown>) {
    console.info(formatEntry({
      level: 'info',
      message,
      context: context ? redact(context) as Record<string, unknown> : undefined,
      timestamp: new Date().toISOString(),
    }))
  },

  warn(message: string, context?: Record<string, unknown>) {
    console.warn(formatEntry({
      level: 'warn',
      message,
      context: context ? redact(context) as Record<string, unknown> : undefined,
      timestamp: new Date().toISOString(),
    }))
  },

  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    console.error(formatEntry({
      level: 'error',
      message,
      context: {
        ...(context ? redact(context) as Record<string, unknown> : {}),
        error: error instanceof Error
          ? { name: error.name, message: error.message, stack: IS_DEV ? error.stack : undefined }
          : error,
      },
      timestamp: new Date().toISOString(),
    }))
  },
}
