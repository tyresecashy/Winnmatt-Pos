'use server'

import { createClient } from '@supabase/supabase-js'
import { authenticateServerAction } from './auth-helpers'
import type { ExecutionResult, ChatMessage, ToolResult } from '@/lib/ai/types'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// Free models available (ordered by preference)
const MODELS = {
  fast: 'meta-llama/llama-3.3-70b-instruct:free',
  smart: 'nvidia/nemotron-3-super-120b-a12b:free',
  coder: 'qwen/qwen3-coder:free',
}

// Fallback chain: try these models in order when one fails
const FALLBACK_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3-coder:free',
  'openrouter/free',
]

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIInsight {
  id: string
  type: 'sales' | 'inventory' | 'finance' | 'customer' | 'workforce' | 'dashboard' | 'customer_detail'
  title: string
  summary: string
  details: string
  recommendation: string
  confidence: number
  priority: 'high' | 'medium' | 'low'
  data?: Record<string, unknown>
  generated_at: string
}

export interface AISalesAnalysis {
  insights: AIInsight[]
  summary: string
  top_opportunities: string[]
  risk_alerts: string[]
}

export interface AIInventoryAnalysis {
  insights: AIInsight[]
  summary: string
  reorder_suggestions: { product: string; current_stock: number; suggested_qty: number; reason: string }[]
  markdown_suggestions: { product: string; current_stock: number; days_stale: number; suggested_action: string }[]
}

// ─── Core AI Call ─────────────────────────────────────────────────────────────

async function callOpenRouter(
  prompt: string,
  systemPrompt: string,
  model: string = MODELS.smart
): Promise<string> {
  // Try primary model first, then fallbacks
  const modelsToTry = [model, ...FALLBACK_MODELS.filter(m => m !== model)]

  for (const tryModel of modelsToTry) {
    // Retry each model up to 2 times with backoff
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        // Wait before retry (exponential backoff: 3s, 6s)
        await new Promise(resolve => setTimeout(resolve, 3000 * attempt))
      }

      try {
        const response = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://winnmatt-pos.com',
            'X-Title': 'WINNMATT POS AI',
          },
          body: JSON.stringify({
            model: tryModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 2000,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          return data.choices?.[0]?.message?.content || ''
        }

        // 429 = rate limited, try next model
        if (response.status === 429) {
          console.warn(`[AI] Model ${tryModel} rate-limited, trying next...`)
          break // Break inner retry loop, try next model
        }

        // 5xx = server error, retry
        if (response.status >= 500) {
          console.warn(`[AI] Model ${tryModel} server error ${response.status}, retrying...`)
          continue
        }

        // Other errors (400, 401, etc.) — don't retry this model
        const errBody = await response.text()
        console.error(`[AI] Model ${tryModel} error ${response.status}: ${errBody}`)
        break
      } catch (fetchError) {
        // Network error, retry
        console.warn(`[AI] Network error with ${tryModel}:`, fetchError)
        continue
      }
    }
  }

  // All models failed — return a helpful offline message
  return 'AI analysis is temporarily unavailable due to high demand. Please try again in a moment. In the meantime, you can review your data directly in the reports section.'
}

// ─── Gather Sales Data ────────────────────────────────────────────────────────

async function gatherSalesData() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [salesData, itemsData, productsData, customersData, inventoryData] = await Promise.all([
    supabaseAdmin.from('sales')
      .select('id, total_amount, payment_method, payment_status, created_at, customer_id')
      .gte('created_at', thirtyDaysAgo)
      .eq('payment_status', 'completed')
      .order('created_at', { ascending: false }),

    supabaseAdmin.from('sale_items')
      .select('product_id, quantity, unit_price, products(name, sku, category_id, purchase_price)')
      .gte('created_at', thirtyDaysAgo),

    supabaseAdmin.from('products')
      .select('id, name, sku, reorder_level, category_id, purchase_price, selling_price, last_sold_at')
      .order('name'),

    supabaseAdmin.from('customers')
      .select('id, name, credit_balance, total_visits, last_purchase_date')
      .gt('credit_balance', 0),

    supabaseAdmin.from('inventory')
      .select('product_id, quantity'),
  ])

  const sales = salesData.data || []
  const items = (itemsData.data || []) as unknown as Array<{ product_id: string; quantity: number; unit_price: number; products?: { name: string; sku: string; category_id?: string } }>
  const products = productsData.data || []
  const customersWithCredit = customersData.data || []
  const inventoryRows = inventoryData.data || []

  // Build inventory map: product_id → quantity
  const inventoryMap = new Map<string, number>()
  inventoryRows.forEach(inv => {
    inventoryMap.set(inv.product_id, inv.quantity || 0)
  })

  // Last 7 days sales for trend
  const recentSales = sales.filter(s => new Date(s.created_at) >= new Date(sevenDaysAgo))
  const previousSales = sales.filter(s => {
    const d = new Date(s.created_at)
    return d >= new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) && d < new Date(sevenDaysAgo)
  })

  const totalRevenue30d = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0)
  const totalRevenue7d = recentSales.reduce((sum, s) => sum + (s.total_amount || 0), 0)
  const totalRevenuePrev7d = previousSales.reduce((sum, s) => sum + (s.total_amount || 0), 0)

  // Top products
  const productSales = new Map<string, { name: string; sku: string; category: string; qty: number; revenue: number }>()
  for (const item of items) {
    const prod = item.products
    if (!prod) continue
    const existing = productSales.get(item.product_id) || { name: prod.name, sku: prod.sku, category: prod.category_id || 'N/A', qty: 0, revenue: 0 }
    existing.qty += item.quantity
    existing.revenue += item.quantity * item.unit_price
    productSales.set(item.product_id, existing)
  }
  const topProducts = Array.from(productSales.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  // Payment method breakdown
  const paymentMethods = new Map<string, number>()
  for (const sale of sales) {
    const method = sale.payment_method || 'unknown'
    paymentMethods.set(method, (paymentMethods.get(method) || 0) + sale.total_amount)
  }

  // Category breakdown
  const categoryRevenue = new Map<string, number>()
  for (const item of items) {
    const cat = item.products?.category_id || 'Uncategorized'
    categoryRevenue.set(cat, (categoryRevenue.get(cat) || 0) + item.quantity * item.unit_price)
  }

  // Low stock products
  const lowStock = products.filter(p => {
    const qty = inventoryMap.get(p.id) || 0
    return qty > 0 && qty <= (p.reorder_level || 10)
  })
  const outOfStock = products.filter(p => (inventoryMap.get(p.id) || 0) <= 0)

  // Dead stock
  const now = Date.now()
  const deadStock = products.filter(p => {
    const qty = inventoryMap.get(p.id) || 0
    if (qty <= 0) return false
    if (!p.last_sold_at) return true
    const days = Math.floor((now - new Date(p.last_sold_at).getTime()) / (1000 * 60 * 60 * 24))
    return days >= 60
  })

  return {
    totalRevenue30d,
    totalRevenue7d,
    totalRevenuePrev7d,
    revenueTrend: totalRevenuePrev7d > 0 ? ((totalRevenue7d - totalRevenuePrev7d) / totalRevenuePrev7d * 100) : 0,
    totalTransactions: sales.length,
    avgBasketSize: sales.length > 0 ? totalRevenue30d / sales.length : 0,
    topProducts,
    paymentMethods: Object.fromEntries(paymentMethods),
    categoryRevenue: Object.fromEntries(categoryRevenue),
    lowStockProducts: lowStock.map(p => ({ name: p.name, sku: p.sku, stock: inventoryMap.get(p.id) || 0, reorder: p.reorder_level })),
    outOfStockProducts: outOfStock.map(p => ({ name: p.name, sku: p.sku })),
    deadStockProducts: deadStock.map(p => ({
      name: p.name, sku: p.sku, stock: inventoryMap.get(p.id) || 0,
      daysSinceSale: p.last_sold_at ? Math.floor((now - new Date(p.last_sold_at).getTime()) / (1000 * 60 * 60 * 24)) : 999,
    })),
    customersWithCredit: customersWithCredit.length,
    totalCreditOutstanding: customersWithCredit.reduce((sum, c) => sum + (c.credit_balance || 0), 0),
  }
}

// ─── Sales Intelligence ───────────────────────────────────────────────────────

export async function analyzeSalesIntelligence(): Promise<AISalesAnalysis> {
  const auth = await authenticateServerAction()
  if (!auth.success) throw new Error('Unauthorized')

  const data = await gatherSalesData()

  const systemPrompt = `You are a senior retail business analyst for a Kenyan supermarket (WINNMATT POS).
Analyze the sales data below and provide actionable business insights.

Data includes: 30-day revenue, top products, payment methods, category performance, customer credit info.
All monetary values are in KES (Kenyan Shillings).
Retail context: Kenyan supermarket, mobile money (M-Pesa) is dominant, credit sales common.

Respond in JSON format:
{
  "insights": [
    {
      "type": "sales",
      "title": "Insight Title",
      "summary": "One-line summary",
      "details": "Detailed analysis",
      "recommendation": "Specific action to take",
      "confidence": 0.85,
      "priority": "high|medium|low"
    }
  ],
  "summary": "Executive summary of sales performance",
  "top_opportunities": ["opportunity 1", "opportunity 2", "opportunity 3"],
  "risk_alerts": ["risk 1", "risk 2"]
}`

  const prompt = `Sales Data Analysis:
- 30-day Revenue: KES ${data.totalRevenue30d.toLocaleString()}
- 7-day Revenue: KES ${data.totalRevenue7d.toLocaleString()}
- Revenue trend (vs prev week): ${data.revenueTrend > 0 ? '+' : ''}${data.revenueTrend.toFixed(1)}%
- Total Transactions (30d): ${data.totalTransactions}
- Average Basket Size: KES ${data.avgBasketSize.toFixed(0)}
- Customers with Credit: ${data.customersWithCredit}
- Total Credit Outstanding: KES ${data.totalCreditOutstanding.toLocaleString()}

Top Products (30d):
${data.topProducts.map((p, i) => `${i + 1}. ${p.name} (${p.sku}) - ${p.qty} units, KES ${p.revenue.toLocaleString()} [${p.category}]`).join('\n')}

Payment Methods:
${Object.entries(data.paymentMethods).map(([method, amount]) => `- ${method}: KES ${amount.toLocaleString()}`).join('\n')}

Category Revenue:
${Object.entries(data.categoryRevenue).map(([cat, rev]) => `- ${cat}: KES ${rev.toLocaleString()}`).join('\n')}

Low Stock Items: ${data.lowStockProducts.length}
Out of Stock: ${data.outOfStockProducts.length}

Provide 5-7 specific, actionable insights based on this data.`

  const response = await callOpenRouter(prompt, systemPrompt, MODELS.smart)

  try {
    // Try to parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        insights: ((parsed.insights || []) as unknown as Array<Record<string, unknown>>).map((ins, i) => ({
          id: `sale-${Date.now()}-${i}`,
          type: 'sales' as const,
          title: (ins.title as string) || 'Sales Insight',
          summary: (ins.summary as string) || '',
          details: (ins.details as string) || '',
          recommendation: (ins.recommendation as string) || '',
          confidence: (ins.confidence as number) || 0.7,
          priority: ((ins.priority as string) || 'medium') as AIInsight['priority'],
          generated_at: new Date().toISOString(),
        })),
        summary: parsed.summary || 'Analysis complete',
        top_opportunities: parsed.top_opportunities || [],
        risk_alerts: parsed.risk_alerts || [],
      }
    }
  } catch (e) {
    // JSON parse failed, use raw text
  }

  // Fallback: return raw analysis
  return {
    insights: [{
      id: `sale-${Date.now()}`,
      type: 'sales',
      title: 'Sales Analysis',
      summary: response.slice(0, 200),
      details: response,
      recommendation: 'Review the detailed analysis above',
      confidence: 0.8,
      priority: 'medium',
      generated_at: new Date().toISOString(),
    }],
    summary: response.slice(0, 500),
    top_opportunities: [],
    risk_alerts: [],
  }
}

// ─── Inventory Intelligence ───────────────────────────────────────────────────

export async function analyzeInventoryIntelligence(): Promise<AIInventoryAnalysis> {
  const auth = await authenticateServerAction()
  if (!auth.success) throw new Error('Unauthorized')

  const data = await gatherSalesData()

  const systemPrompt = `You are a retail inventory management expert for a Kenyan supermarket (WINNMATT POS).
Analyze inventory data and provide actionable recommendations.

Context: Kenyan supermarket with perishable goods, seasonal demand, M-M-Pesa dominant.
Respond in JSON format:
{
  "insights": [
    {
      "type": "inventory",
      "title": "Insight Title",
      "summary": "One-line summary",
      "details": "Detailed analysis",
      "recommendation": "Specific action",
      "confidence": 0.85,
      "priority": "high|medium|low"
    }
  ],
  "summary": "Executive summary",
  "reorder_suggestions": [
    {
      "product": "Product Name",
      "current_stock": 5,
      "suggested_qty": 50,
      "reason": "Based on sales velocity and lead time"
    }
  ],
  "markdown_suggestions": [
    {
      "product": "Product Name",
      "current_stock": 20,
      "days_stale": 90,
      "suggested_action": "Mark down 30% or bundle with fast movers"
    }
  ]
}`

  const prompt = `Inventory Data Analysis:

Products with Low Stock (below reorder level):
${data.lowStockProducts.length > 0 ? data.lowStockProducts.map(p => `- ${p.name} (${p.sku}): ${p.stock} in stock, reorder at ${p.reorder}`).join('\n') : 'None'}

Out of Stock Products:
${data.outOfStockProducts.length > 0 ? data.outOfStockProducts.map(p => `- ${p.name} (${p.sku})`).join('\n') : 'None'}

Dead Stock / Slow Movers (60+ days since last sale):
${data.deadStockProducts.length > 0 ? data.deadStockProducts.map(p => `- ${p.name} (${p.sku}): ${p.stock} units, ${p.daysSinceSale} days since last sale`).join('\n') : 'None'}

Top Selling Products (for context):
${data.topProducts.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} - ${p.qty} units, KES ${p.revenue.toLocaleString()}`).join('\n')}

Provide specific reorder quantities for low stock items and markdown recommendations for dead stock.
Consider: lead times in Kenya are typically 3-7 days for local suppliers, 14-30 days for imports.`

  const response = await callOpenRouter(prompt, systemPrompt, MODELS.smart)

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        insights: ((parsed.insights || []) as unknown as Array<Record<string, unknown>>).map((ins, i) => ({
          id: `inv-${Date.now()}-${i}`,
          type: 'inventory' as const,
          title: (ins.title as string) || 'Inventory Insight',
          summary: (ins.summary as string) || '',
          details: (ins.details as string) || '',
          recommendation: (ins.recommendation as string) || '',
          confidence: (ins.confidence as number) || 0.7,
          priority: ((ins.priority as string) || 'medium') as AIInsight['priority'],
          generated_at: new Date().toISOString(),
        })),
        summary: parsed.summary || 'Analysis complete',
        reorder_suggestions: parsed.reorder_suggestions || [],
        markdown_suggestions: parsed.markdown_suggestions || [],
      }
    }
  } catch (e) {
    /* JSON parse failed — fall through to fallback below */
  }

  return {
    insights: [{
      id: `inv-${Date.now()}`,
      type: 'inventory',
      title: 'Inventory Analysis',
      summary: response.slice(0, 200),
      details: response,
      recommendation: 'Review the detailed analysis above',
      confidence: 0.8,
      priority: 'medium',
      generated_at: new Date().toISOString(),
    }],
    summary: response.slice(0, 500),
    reorder_suggestions: [],
    markdown_suggestions: [],
  }
}

// ─── Quick AI Chat ────────────────────────────────────────────────────────────

export async function aiChat(message: string, context?: string): Promise<string> {
  const auth = await authenticateServerAction()
  if (!auth.success) throw new Error('Unauthorized')

  const systemPrompt = `You are WINNMATT POS AI Assistant for a Kenyan supermarket.
You help with sales analysis, inventory management, and business decisions.
Be concise, practical, and specific. Use KES for currency. Mention specific numbers from data when available.
${context ? `Context: ${context}` : ''}`

  return await callOpenRouter(message, systemPrompt, MODELS.fast)
}

// ─── Financial Insights ───────────────────────────────────────────────────────

export async function analyzeFinancialInsights(): Promise<AIInsight[]> {
  const auth = await authenticateServerAction()
  if (!auth.success) throw new Error('Unauthorized')

  // Gather finance data
  const [accounts, journalEntries, balancesResult] = await Promise.all([
    supabaseAdmin.from('accounts').select('id, account_number, name, account_type').eq('is_active', true),
    supabaseAdmin.from('journal_entries').select('id, entry_date, description, total_debit, total_credit, status').eq('status', 'posted').order('entry_date', { ascending: false }).limit(50),
    supabaseAdmin.from('journal_entry_lines').select('account_id, debit, credit, account:accounts(account_number, name, account_type)'),
  ])

  const accountList = accounts.data || []
  const entries = journalEntries.data || []
  const balanceLines = (balancesResult.data || []) as unknown as { account_id: string; debit: number; credit: number; account?: { account_number: string; name: string; account_type: string } }[]

  // Calculate summary balances by type
  const typeBalances: Record<string, number> = {}
  for (const line of balanceLines) {
    const acc = line.account
    if (!acc) continue
    const type = acc.account_type
    const balance = (line.debit || 0) - (line.credit || 0)
    typeBalances[type] = (typeBalances[type] || 0) + balance
  }

  const systemPrompt = `You are a financial advisor for a Kenyan supermarket (WINNMATT POS).
Analyze financial data and provide actionable insights.
Respond in JSON with an array of insights:
{
  "insights": [
    {
      "title": "Title",
      "summary": "One-line summary",
      "details": "Analysis",
      "recommendation": "Action",
      "confidence": 0.85,
      "priority": "high|medium|low"
    }
  ]
}`

  const prompt = `Financial Summary:
Account Balances:
${Object.entries(typeBalances).map(([type, bal]) => `- ${type}: KES ${Math.abs(bal).toLocaleString()}`).join('\n')}

Recent Journal Entries: ${entries.length} entries
Total debits: KES ${entries.reduce((s, e) => s + (e.total_debit || 0), 0).toLocaleString()}
Total credits: KES ${entries.reduce((s, e) => s + (e.total_credit || 0), 0).toLocaleString()}

Provide 3-5 financial health insights and recommendations.`

  const response = await callOpenRouter(prompt, systemPrompt, MODELS.smart)

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return ((parsed.insights || []) as unknown as Array<Record<string, unknown>>).map((ins, i) => ({
        id: `fin-${Date.now()}-${i}`,
        type: 'finance' as const,
        title: (ins.title as string) || 'Financial Insight',
        summary: (ins.summary as string) || '',
        details: (ins.details as string) || '',
        recommendation: (ins.recommendation as string) || '',
        confidence: (ins.confidence as number) || 0.7,
        priority: ((ins.priority as string) || 'medium') as AIInsight['priority'],
        generated_at: new Date().toISOString(),
      }))
    }
  } catch (e) {
    /* JSON parse failed — fall through to fallback below */
  }

  return [{
    id: `fin-${Date.now()}`,
    type: 'finance',
    title: 'Financial Analysis',
    summary: response.slice(0, 200),
    details: response,
    recommendation: 'Review the analysis above',
    confidence: 0.8,
    priority: 'medium',
    generated_at: new Date().toISOString(),
  }]
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function parseInsightResponse(
  response: string,
  prefix: string,
  domainType: AIInsight['type'],
): AIInsight[] {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const items = parsed.insights || parsed.results || [parsed]
      return (items as unknown as Array<Record<string, unknown>>).map((ins, i) => ({
        id: `${prefix}-${Date.now()}-${i}`,
        type: domainType,
        title: (ins.title as string) || `${domainType} insight`,
        summary: (ins.summary as string) || '',
        details: (ins.details as string) || '',
        recommendation: (ins.recommendation as string) || '',
        confidence: (ins.confidence as number) || 0.7,
        priority: ((ins.priority as string) || 'medium') as AIInsight['priority'],
        generated_at: new Date().toISOString(),
      }))
    }
  } catch (e) {
    // fall through
  }

  // Fallback — single raw-text insight
  return [{
    id: `${prefix}-${Date.now()}`,
    type: domainType,
    title: `${domainType.charAt(0).toUpperCase() + domainType.slice(1)} Analysis`,
    summary: response.slice(0, 200),
    details: response,
    recommendation: 'Review the detailed analysis above.',
    confidence: 0.8,
    priority: 'medium' as const,
    generated_at: new Date().toISOString(),
  }]
}

// ─── Domain-Specific AI Actions (used by Analytics pages) ──────────────────

/** For Sales Analytics page — pass already-computed client data */
export async function analyzeSalesAI(data: {
  metrics: { totalRevenue: number; totalTransactions: number; averageOrderValue: number; growthRate: number }
  trendSummary: { direction: string; bestDay?: string; worstDay?: string; volatility: string }
  topProducts: { name: string; revenue: number; sold: number }[]
  categoryBreakdown: { name: string; revenue: number }[]
  paymentMethods: { method: string; amount: number }[]
  peakHours: { hour: string; transactions: number }[]
}): Promise<AIInsight[]> {
  const auth = await authenticateServerAction()
  if (!auth.success) throw new Error('Unauthorized')

  const systemPrompt = `You are a senior retail analyst for WINNMATT POS (Kenyan supermarket).
Analyze the sales analytics data and return 3-5 JSON insights with title, summary, details, recommendation, confidence (0-1), priority (high/medium/low).
Return JSON: { "insights": [...] }`

  const prompt = `Sales Analytics (30d):
- Revenue: KES ${data.metrics.totalRevenue.toLocaleString()}
- Transactions: ${data.metrics.totalTransactions}
- Avg Order Value: KES ${data.metrics.averageOrderValue.toFixed(0)}
- Growth: ${data.metrics.growthRate > 0 ? '+' : ''}${data.metrics.growthRate.toFixed(1)}%
- Trend: ${data.trendSummary.direction} (volatility: ${data.trendSummary.volatility})
${data.trendSummary.bestDay ? `- Best day: ${data.trendSummary.bestDay}` : ''}
${data.trendSummary.worstDay ? `- Worst day: ${data.trendSummary.worstDay}` : ''}

Top Products: ${data.topProducts.slice(0, 5).map(p => `${p.name} (KES ${p.revenue.toLocaleString()}, ${p.sold} sold)`).join(' | ')}

Categories: ${data.categoryBreakdown.map(c => `${c.name} (KES ${c.revenue.toLocaleString()})`).join(' | ')}

Payment: ${data.paymentMethods.map(p => `${p.method} (KES ${p.amount.toLocaleString()})`).join(' | ')}

Peak Hours: ${data.peakHours.filter(h => h.transactions > 0).slice(0, 3).map(h => `${h.hour} (${h.transactions} txns)`).join(' | ')}`

  const response = await callOpenRouter(prompt, systemPrompt, MODELS.smart)
  return parseInsightResponse(response, 'sales', 'sales')
}

/** For Inventory Analytics page */
export async function analyzeInventoryAI(data: {
  metrics: { totalProducts: number; totalStockValue: number; lowStockItems: number; outOfStockItems: number; overstockItems: number }
  turnover: { productName: string; turnoverRate: number; daysOfSupply: number }[]
  deadStock: { productName: string; daysSinceLastSale: number; valueAtRisk: number }[]
  reorderPredictions: { productName: string; currentStock: number; averageDailySales: number; daysUntilReorder: number }[]
}): Promise<AIInsight[]> {
  const auth = await authenticateServerAction()
  if (!auth.success) throw new Error('Unauthorized')

  const systemPrompt = `You are an inventory management expert for a Kenyan supermarket.
Analyze the inventory data and return 3-5 JSON insights.
Return JSON: { "insights": [...] }`

  const prompt = `Inventory Overview:
- Total products: ${data.metrics.totalProducts}
- Stock value: KES ${data.metrics.totalStockValue.toLocaleString()}
- Low stock: ${data.metrics.lowStockItems} | Out of stock: ${data.metrics.outOfStockItems} | Overstock: ${data.metrics.overstockItems}

Turnover (top 5): ${data.turnover.slice(0, 5).map(t => `${t.productName} (${t.turnoverRate.toFixed(1)}x, ${t.daysOfSupply.toFixed(0)}d supply)`).join(' | ')}

Dead Stock: ${data.deadStock.slice(0, 5).map(d => `${d.productName} (${d.daysSinceLastSale}d stale, KES ${d.valueAtRisk.toLocaleString()} at risk)`).join(' | ')}

Reorder Alerts: ${data.reorderPredictions.slice(0, 5).map(r => `${r.productName} (stock: ${r.currentStock}, daily sales: ${r.averageDailySales.toFixed(1)}, reorder in ${r.daysUntilReorder.toFixed(0)}d)`).join(' | ')}`

  const response = await callOpenRouter(prompt, systemPrompt, MODELS.smart)
  return parseInsightResponse(response, 'inv', 'inventory')
}

/** For Customer Analytics page */
export async function analyzeCustomerAI(data: {
  metrics: { totalCustomers: number; activeCustomers: number; newCustomers: number; averageOrderValue: number; customerRetentionRate: number }
  rfmSegments: { segment: string; count: number; avgValue: number }[]
  ltv: { customerName: string; lifetimeValue: number }[]
  churnRisk?: { customerName: string; risk: number }[]
}): Promise<AIInsight[]> {
  const auth = await authenticateServerAction()
  if (!auth.success) throw new Error('Unauthorized')

  const systemPrompt = `You are a customer analytics expert for a Kenyan supermarket.
Analyze customer data and return 3-5 JSON insights about segments, retention, and growth opportunities.
Return JSON: { "insights": [...] }`

  const prompt = `Customer Overview:
- Total: ${data.metrics.totalCustomers} | Active: ${data.metrics.activeCustomers} | New: ${data.metrics.newCustomers}
- Avg Order Value: KES ${data.metrics.averageOrderValue.toFixed(0)}
- Retention Rate: ${data.metrics.customerRetentionRate.toFixed(1)}%

RFM Segments: ${data.rfmSegments.map(s => `${s.segment} (${s.count} customers, avg KES ${s.avgValue.toFixed(0)})`).join(' | ')}

Top LTV: ${data.ltv.slice(0, 5).map(l => `${l.customerName} (KES ${l.lifetimeValue.toLocaleString()})`).join(' | ')}`

  const response = await callOpenRouter(prompt, systemPrompt, MODELS.smart)
  return parseInsightResponse(response, 'cust', 'customer')
}

/** For Workforce Analytics page */
export async function analyzeWorkforceAI(data: {
  metrics: { totalWorkers: number; activeWorkers: number; averageTaskCompletionRate: number; averageEfficiencyScore: number; totalHoursWorked: number; laborCost: number }
  taskEfficiency: { workerName: string; completionRate: number; efficiencyScore: number }[]
  attendance: { workerName: string; attendanceRate: number }[]
  laborCostAnalysis: { period: string; totalCost: number; costPerHour: number; overtimeHours: number }[]
}): Promise<AIInsight[]> {
  const auth = await authenticateServerAction()
  if (!auth.success) throw new Error('Unauthorized')

  const systemPrompt = `You are a workforce management analyst for a Kenyan supermarket.
Analyze workforce data and return 3-5 JSON insights about productivity, attendance, and cost efficiency.
Return JSON: { "insights": [...] }`

  const prompt = `Workforce Overview:
- Workers: ${data.metrics.totalWorkers} total, ${data.metrics.activeWorkers} active
- Task completion: ${data.metrics.averageTaskCompletionRate.toFixed(1)}%
- Efficiency: ${data.metrics.averageEfficiencyScore.toFixed(1)}
- Hours worked: ${data.metrics.totalHoursWorked} | Labor cost: KES ${data.metrics.laborCost.toLocaleString()}

Top performers: ${data.taskEfficiency.filter(t => t.completionRate > 80).slice(0, 5).map(t => `${t.workerName} (${t.completionRate.toFixed(0)}% complete, score: ${t.efficiencyScore.toFixed(1)})`).join(' | ')}

Attendance issues: ${data.attendance.filter(a => a.attendanceRate < 80).slice(0, 5).map(a => `${a.workerName} (${a.attendanceRate.toFixed(1)}%)`).join(' | ')}

Labor costs: ${data.laborCostAnalysis.slice(0, 3).map(l => `${l.period}: KES ${l.totalCost.toLocaleString()} (${l.costPerHour.toFixed(0)}/hr, ${l.overtimeHours.toFixed(0)} OT hrs)`).join(' | ')}`

  const response = await callOpenRouter(prompt, systemPrompt, MODELS.smart)
  return parseInsightResponse(response, 'wrk', 'workforce')
}

/** For Financial Analytics page */
export async function analyzeFinanceAI(data: {
  metrics: { totalRevenue: number; totalExpenses: number; netProfit: number; profitMargin: number; revenueGrowth: number; expenseGrowth: number }
  plTrend: { date: string; revenue: number; expenses: number; profit: number }[]
  cashFlow: { period: string; inflow: number; outflow: number }[]
  expenseBreakdown: { category: string; amount: number; percentage: number }[]
  marginAnalysis: { productName: string; margin: number }[]
}): Promise<AIInsight[]> {
  const auth = await authenticateServerAction()
  if (!auth.success) throw new Error('Unauthorized')

  const systemPrompt = `You are a financial analyst for a Kenyan supermarket.
Analyze financial data and return 3-5 JSON insights with specific recommendations.
Return JSON: { "insights": [...] }`

  const prompt = `Financial Overview:
- Revenue: KES ${data.metrics.totalRevenue.toLocaleString()} | Expenses: KES ${data.metrics.totalExpenses.toLocaleString()}
- Net Profit: KES ${data.metrics.netProfit.toLocaleString()} (${data.metrics.profitMargin.toFixed(1)}% margin)
- Revenue growth: ${data.metrics.revenueGrowth > 0 ? '+' : ''}${data.metrics.revenueGrowth.toFixed(1)}%
- Expense growth: ${data.metrics.expenseGrowth > 0 ? '+' : ''}${data.metrics.expenseGrowth.toFixed(1)}%

Top expenses: ${data.expenseBreakdown.slice(0, 5).map(e => `${e.category} (KES ${e.amount.toLocaleString()}, ${e.percentage.toFixed(1)}%)`).join(' | ')}

Trend: ${data.plTrend.length > 0 ? `${data.plTrend.length} period trend — last: Rev KES ${data.plTrend[data.plTrend.length-1]?.revenue?.toLocaleString()}, Profit KES ${data.plTrend[data.plTrend.length-1]?.profit?.toLocaleString()}` : 'No trend data'}

Cash flow: ${data.cashFlow.slice(0, 3).map(c => `${c.period}: in KES ${c.inflow.toLocaleString()}, out KES ${c.outflow.toLocaleString()}`).join(' | ')}

Margins: ${data.marginAnalysis.slice(0, 5).map(m => `${m.productName} (${m.margin.toFixed(1)}%)`).join(' | ')}`

  const response = await callOpenRouter(prompt, systemPrompt, MODELS.smart)
  return parseInsightResponse(response, 'fin', 'finance')
}

/** For main Dashboard + Analytics Dashboard — gathers its own data server-side */
export async function analyzeDashboardAI(): Promise<AIInsight[]> {
  const auth = await authenticateServerAction()
  if (!auth.success) throw new Error('Unauthorized')

  // Gather lightweight dashboard data
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [salesResult, productsResult, inventoryResult] = await Promise.all([
    supabaseAdmin.from('sales')
      .select('total_amount, payment_method, created_at')
      .gte('created_at', thirtyDaysAgo)
      .eq('payment_status', 'completed'),
    supabaseAdmin.from('products')
      .select('id, name, reorder_level'),
    supabaseAdmin.from('inventory')
      .select('product_id, quantity'),
  ])

  const sales = salesResult.data || []
  const allProducts = productsResult.data || []
  const inventoryData = inventoryResult.data || []

  const inventoryMap = new Map<string, number>()
  inventoryData.forEach(inv => inventoryMap.set(inv.product_id, inv.quantity || 0))

  const lowStockCount = allProducts.filter(p => {
    const qty = inventoryMap.get(p.id) || 0
    return qty > 0 && qty <= (p.reorder_level || 10)
  }).length
  const outOfStockCount = allProducts.filter(p => (inventoryMap.get(p.id) || 0) <= 0).length

  const totalRevenue = sales.reduce((s, sale) => s + (sale.total_amount || 0), 0)
  const todayRevenue = sales.filter(s => s.created_at >= todayStart).reduce((s, sale) => s + (sale.total_amount || 0), 0)
  const todayCount = sales.filter(s => s.created_at >= todayStart).length
  const avgBasket = sales.length > 0 ? totalRevenue / sales.length : 0
  const mpesaShare = sales.length > 0
    ? (sales.filter(s => s.payment_method === 'mpesa').length / sales.length) * 100
    : 0

  const systemPrompt = `You are an executive business analyst for WINNMATT POS (Kenyan supermarket).
Analyze the dashboard data and return 3-4 JSON insights highlighting the most important things the business owner should know right now.
Return JSON: { "insights": [...] }`

  const prompt = `Dashboard Snapshot:
- 30-day Revenue: KES ${totalRevenue.toLocaleString()}
- Today's Revenue: KES ${todayRevenue.toLocaleString()}
- Today's Transactions: ${todayCount}
- Average Basket: KES ${avgBasket.toFixed(0)}
- M-Pesa share: ${mpesaShare.toFixed(0)}%
- Low stock items: ${lowStockCount}
- Out of stock: ${outOfStockCount}`

  const response = await callOpenRouter(prompt, systemPrompt, MODELS.fast)
  return parseInsightResponse(response, 'dash', 'dashboard')
}

/** For Customer Detail page — customer health & next-best-action */
export async function analyzeCustomerDetailAI(data: {
  customer: { name: string; type: string; tier: string; totalVisits: number; totalSpent: number; creditBalance: number; averageOrderValue: number; lastPurchaseDate: string | null }
  recentActivity: { description: string; date: string }[]
  salesHistory: { date: string; total: number; items: number }[]
}): Promise<AIInsight[]> {
  const auth = await authenticateServerAction()
  if (!auth.success) throw new Error('Unauthorized')

  const systemPrompt = `You are a customer relationship analyst for a Kenyan supermarket.
Analyze this customer's profile and return 3-4 JSON insights about their health, churn risk, and suggested next actions.
Return JSON: { "insights": [...] }`

  const prompt = `Customer Profile:
- Name: ${data.customer.name}
- Type: ${data.customer.type} | Tier: ${data.customer.tier}
- Total visits: ${data.customer.totalVisits} | Total spent: KES ${data.customer.totalSpent.toLocaleString()}
- Avg order: KES ${data.customer.averageOrderValue.toFixed(0)}
- Credit balance: KES ${data.customer.creditBalance.toLocaleString()}
- Last purchase: ${data.customer.lastPurchaseDate || 'Never'}

Recent activity (${data.recentActivity.length} items): ${data.recentActivity.slice(0, 5).map(a => `${a.description} (${new Date(a.date).toLocaleDateString()})`).join(' | ')}

Sales history (${data.salesHistory.length} transactions):
${data.salesHistory.slice(0, 10).map(s => `- ${new Date(s.date).toLocaleDateString()}: KES ${s.total.toLocaleString()} (${s.items} items)`).join('\n')}`

  const response = await callOpenRouter(prompt, systemPrompt, MODELS.smart)
  return parseInsightResponse(response, 'custdet', 'customer_detail')
}

/** For Inventory page — proactive alerts */
export async function analyzeInventoryAlertsAI(data: {
  lowStockItems: { name: string; stock: number; reorderLevel: number }[]
  outOfStockItems: string[]
  overstockItems: { name: string; stock: number }[]
}): Promise<AIInsight[]> {
  const auth = await authenticateServerAction()
  if (!auth.success) throw new Error('Unauthorized')

  if (data.lowStockItems.length === 0 && data.outOfStockItems.length === 0 && data.overstockItems.length === 0) {
    return []
  }

  const systemPrompt = `You are an inventory alert system for WINNMATT POS (Kenyan supermarket).
Analyze these inventory issues and return 1-3 JSON alerts with title, summary, details, recommendation, priority.
Return JSON: { "insights": [...] }`

  const prompt = `Inventory Alerts:
- Low stock (${data.lowStockItems.length}): ${data.lowStockItems.slice(0, 10).map(i => `${i.name} (${i.stock} units, reorder at ${i.reorderLevel})`).join(' | ')}
- Out of stock (${data.outOfStockItems.length}): ${data.outOfStockItems.slice(0, 10).join(', ')}
- Overstock (${data.overstockItems.length}): ${data.overstockItems.slice(0, 5).map(i => `${i.name} (${i.stock} units)`).join(' | ')}

Provide specific, actionable recommendations. Kenyan context: 3-7 day lead times for local suppliers.`

  const response = await callOpenRouter(prompt, systemPrompt, MODELS.fast)
  return parseInsightResponse(response, 'inv-alert', 'inventory')
}

// ─── AI Action Executor (Functional Assistant) ──────────────────────────────

export type {
  ExecutionResult,
  ChatMessage,
  ToolResult,
  PendingAction,
  ActionResult,
} from '@/lib/ai/types'

/**
 * Send a message to the AI assistant for action execution.
 * Returns structured results — text, tool actions, or errors.
 */
export async function aiExecute(
  message: string,
  pageContext?: string,
  history?: ChatMessage[]
): Promise<ExecutionResult> {
  const { execute } = await import('@/lib/ai/executor')
  return execute(message, pageContext || '', history || [])
}

/**
 * Confirm and execute a pending write action (called from UI after user confirms).
 */
export async function aiConfirmAction(
  toolName: string,
  toolArgs: Record<string, unknown>
): Promise<ToolResult> {
  const { confirmAndExecute } = await import('@/lib/ai/executor')
  return confirmAndExecute(toolName, toolArgs)
}
