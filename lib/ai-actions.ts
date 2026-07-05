'use server'

import { createClient } from '@supabase/supabase-js'
import { authenticateServerAction } from './auth-helpers'

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
  type: 'sales' | 'inventory' | 'finance'
  title: string
  summary: string
  details: string
  recommendation: string
  confidence: number
  priority: 'high' | 'medium' | 'low'
  data?: any
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
  const items = itemsData.data || []
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
    const prod = (item as any).products
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
    const cat = (item as any).products?.category_id || 'Uncategorized'
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
  await authenticateServerAction()

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
        insights: (parsed.insights || []).map((ins: any, i: number) => ({
          id: `sale-${Date.now()}-${i}`,
          type: 'sales' as const,
          title: ins.title || 'Sales Insight',
          summary: ins.summary || '',
          details: ins.details || '',
          recommendation: ins.recommendation || '',
          confidence: ins.confidence || 0.7,
          priority: ins.priority || 'medium',
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
  await authenticateServerAction()

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
        insights: (parsed.insights || []).map((ins: any, i: number) => ({
          id: `inv-${Date.now()}-${i}`,
          type: 'inventory' as const,
          title: ins.title || 'Inventory Insight',
          summary: ins.summary || '',
          details: ins.details || '',
          recommendation: ins.recommendation || '',
          confidence: ins.confidence || 0.7,
          priority: ins.priority || 'medium',
          generated_at: new Date().toISOString(),
        })),
        summary: parsed.summary || 'Analysis complete',
        reorder_suggestions: parsed.reorder_suggestions || [],
        markdown_suggestions: parsed.markdown_suggestions || [],
      }
    }
  } catch (e) {}

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
  await authenticateServerAction()

  const systemPrompt = `You are WINNMATT POS AI Assistant for a Kenyan supermarket.
You help with sales analysis, inventory management, and business decisions.
Be concise, practical, and specific. Use KES for currency. Mention specific numbers from data when available.
${context ? `Context: ${context}` : ''}`

  return await callOpenRouter(message, systemPrompt, MODELS.fast)
}

// ─── Financial Insights ───────────────────────────────────────────────────────

export async function analyzeFinancialInsights(): Promise<AIInsight[]> {
  await authenticateServerAction()

  // Gather finance data
  const [accounts, journalEntries, balances] = await Promise.all([
    supabaseAdmin.from('accounts').select('id, account_number, name, account_type').eq('is_active', true),
    supabaseAdmin.from('journal_entries').select('id, entry_date, description, total_debit, total_credit, status').eq('status', 'posted').order('entry_date', { ascending: false }).limit(50),
    supabaseAdmin.from('journal_entry_lines').select('account_id, debit, credit, account:accounts(account_number, name, account_type)'),
  ])

  const accountList = accounts.data || []
  const entries = journalEntries.data || []
  const lines = (balances.data || []) as any[]

  // Calculate summary balances by type
  const typeBalances: Record<string, number> = {}
  for (const line of lines) {
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
      return (parsed.insights || []).map((ins: any, i: number) => ({
        id: `fin-${Date.now()}-${i}`,
        type: 'finance' as const,
        title: ins.title || 'Financial Insight',
        summary: ins.summary || '',
        details: ins.details || '',
        recommendation: ins.recommendation || '',
        confidence: ins.confidence || 0.7,
        priority: ins.priority || 'medium',
        generated_at: new Date().toISOString(),
      }))
    }
  } catch (e) {}

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
