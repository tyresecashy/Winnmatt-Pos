/**
 * AI Module — Public API
 *
 * AI-powered analysis and chat features.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/ai-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as ai from '@/lib/ai-actions'

// ─── Types ──────────────────────────────────────────────────────────────────

export type { AIInsight, AISalesAnalysis, AIInventoryAnalysis } from '@/lib/ai-actions'

// ─── Backward-Compatible Re-exports ──────────────────────────────────────────

export { analyzeSalesIntelligence } from '@/lib/ai-actions'
export { analyzeInventoryIntelligence } from '@/lib/ai-actions'
export { aiChat } from '@/lib/ai-actions'
export { analyzeFinancialInsights } from '@/lib/ai-actions'
export { analyzeSalesAI } from '@/lib/ai-actions'
export { analyzeInventoryAI } from '@/lib/ai-actions'
export { analyzeCustomerAI } from '@/lib/ai-actions'
export { analyzeWorkforceAI } from '@/lib/ai-actions'
export { analyzeFinanceAI } from '@/lib/ai-actions'
export { analyzeDashboardAI } from '@/lib/ai-actions'
export { analyzeCustomerDetailAI } from '@/lib/ai-actions'
export { analyzeInventoryAlertsAI } from '@/lib/ai-actions'
export { aiExecute } from '@/lib/ai-actions'
export { aiConfirmAction } from '@/lib/ai-actions'
