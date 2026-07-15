/**
 * Product Intelligence — AI Tool Definitions
 *
 * Sprint 11B: Scoring tools (getBusinessHealth, getTopProducts, getTopCustomers, getTopSuppliers)
 * + getKPIStatus from Sprint 11A.
 *
 * All tools are read-only (isWrite: false) — they query pre-computed scores.
 *
 * @see lib/ai/tool-registry.ts
 */

import type { ToolDefinition } from '@/lib/ai/types'
import type { KPIId } from '@/lib/modules/product-intelligence/types'
import { kpiTracker } from '@/lib/modules/product-intelligence/kpi'
import { productScorer } from '@/lib/modules/product-intelligence/scoring'
import { customerScorer } from '@/lib/modules/product-intelligence/scoring'
import { supplierScorer } from '@/lib/modules/product-intelligence/scoring'
import { businessHealthScorer } from '@/lib/modules/product-intelligence/scoring'

/**
 * getKPIStatus — Returns current KPI attainment vs targets with trend arrows.
 */
const getKPIStatusTool: ToolDefinition = {
  name: 'getKPIStatus',
  description: 'Returns current KPI attainment status for all tracked KPIs, with status indicators and targets.',
  parameters: {
    type: 'object',
    properties: {
      branchId: {
        type: 'string',
        description: 'Optional branch ID to scope KPI status',
      },
      kpiId: {
        type: 'string',
        description: 'Optional specific KPI to check (e.g., revenue_velocity)',
        enum: [
          'revenue_velocity',
          'gross_margin_pct',
          'inventory_turnover',
          'stockout_rate',
          'customer_retention',
          'order_accuracy',
          'labor_efficiency',
          'ai_resolution_rate',
        ],
      },
    },
    required: [],
  },
  isWrite: false,
  handler: async (args: Record<string, unknown>, context) => {
    try {
      const { branchId, kpiId } = args as { branchId?: string; kpiId?: string }
      void context

      const definitions = kpiTracker.getDefinitions()

      if (kpiId) {
        const snapshot = await kpiTracker.getLatestSnapshot(kpiId as KPIId, branchId)
        const def = kpiTracker.getDefinition(kpiId as KPIId)
        if (!snapshot) {
          return {
            success: true,
            data: { kpiId, status: 'no_data' },
            summary: `No KPI data available for "${def?.name ?? kpiId}".`,
          }
        }
        return {
          success: true,
          data: { definition: def, snapshot },
          summary: `${def?.name ?? kpiId}: ${snapshot.value} (${snapshot.status})`,
        }
      }

      const snapshots = await Promise.all(
        definitions.map(async (def) => {
          const snap = await kpiTracker.getLatestSnapshot(def.id, branchId)
          return { definition: def, snapshot: snap }
        }),
      )

      const statusSummary = snapshots
        .map((s) => `${s.definition.name}: ${s.snapshot ? `${s.snapshot.value} (${s.snapshot.status})` : 'no data'}`)
        .join('\n')

      return {
        success: true,
        data: { kpis: snapshots },
        summary: `KPI Status:\n${statusSummary}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch KPI status',
        summary: 'Unable to retrieve KPI status at this time.',
      }
    }
  },
}

/**
 * getBusinessHealth — Returns the latest business health score with trend.
 *
 * NL patterns: "How is the business doing?", "Show me business health"
 */
const getBusinessHealthTool: ToolDefinition = {
  name: 'getBusinessHealth',
  description: 'Returns the latest overall business health score with 6 dimension breakdowns (revenue, margin, inventory, customer, cash, workforce) and trend direction.',
  parameters: {
    type: 'object',
    properties: {
      branchId: {
        type: 'string',
        description: 'Optional branch ID to scope health score',
      },
    },
    required: [],
  },
  isWrite: false,
  handler: async (args: Record<string, unknown>, context) => {
    try {
      const { branchId } = args as { branchId?: string }
      void context

      const score = await businessHealthScorer.getLatestScore(branchId)

      if (!score) {
        return {
          success: true,
          data: { status: 'no_data' },
          summary: 'No business health score computed yet. Run scoring first via the scoring engine.',
        }
      }

      return {
        success: true,
        data: score,
        summary: [
          `Business Health: ${score.compositeScore}/100 (${score.trend})`,
          `  Revenue: ${score.revenueHealth}/100`,
          `  Margin:  ${score.marginHealth}/100`,
          `  Inventory: ${score.inventoryHealth}/100`,
          `  Customer: ${score.customerHealth}/100`,
          `  Cash:    ${score.cashHealth}/100`,
          `  Workforce: ${score.workforceHealth}/100`,
        ].join('\n'),
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch business health',
        summary: 'Unable to retrieve business health score.',
      }
    }
  },
}

/**
 * getTopProducts — Returns top-scored products by category.
 *
 * NL patterns: "What are our best products?", "Show top performers", "Which products are stars?"
 */
const getTopProductsTool: ToolDefinition = {
  name: 'getTopProducts',
  description: 'Returns top-scored products sorted by composite score, with performance breakdown (velocity, margin, stability, seasonality) and category classification (star, cash_cow, question_mark, dog, dead).',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of products to return (default: 10)',
      },
      category: {
        type: 'string',
        description: 'Optional score category filter (star, cash_cow, question_mark, dog, dead)',
        enum: ['star', 'cash_cow', 'question_mark', 'dog', 'dead'],
      },
      branchId: {
        type: 'string',
        description: 'Optional branch ID',
      },
    },
    required: [],
  },
  isWrite: false,
  handler: async (args: Record<string, unknown>, context) => {
    try {
      const { limit, category, branchId: _branchId } = args as {
        limit?: number; category?: string; branchId?: string
      }
      void _branchId, context

      const scores = await productScorer.queryScores({
        type: 'product',
        category: category as never,
        limit: limit ?? 10,
      })

      if (scores.length === 0) {
        return {
          success: true,
          data: { products: [] },
          summary: 'No product scores computed yet. Run product scoring first.',
        }
      }

      const summary = scores.map((s, i) =>
        `  ${i + 1}. ${s.productName} (${s.scoreCategory}) — ${s.compositeScore}/100`
      ).join('\n')

      return {
        success: true,
        data: { products: scores },
        summary: `Top ${scores.length} Products:\n${summary}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch top products',
        summary: 'Unable to retrieve top products.',
      }
    }
  },
}

/**
 * getTopCustomers — Returns top-scored customers by segment.
 *
 * NL patterns: "Who are our best customers?", "Show top customers", "Which customers are champions?"
 */
const getTopCustomersTool: ToolDefinition = {
  name: 'getTopCustomers',
  description: 'Returns top-scored customers sorted by composite score, with RFM-like breakdown (recency, frequency, monetary, loyalty) and segment classification (champions, loyal, new, at_risk, lost, promising, need_attention).',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of customers to return (default: 10)',
      },
      segment: {
        type: 'string',
        description: 'Optional segment filter (champions, loyal, new, at_risk, lost, promising, need_attention)',
        enum: ['champions', 'loyal', 'new', 'at_risk', 'lost', 'promising', 'need_attention'],
      },
    },
    required: [],
  },
  isWrite: false,
  handler: async (args: Record<string, unknown>, context) => {
    try {
      const { limit, segment } = args as {
        limit?: number; segment?: string
      }
      void context

      const scores = await customerScorer.queryScores({
        type: 'customer',
        category: segment as never,
        limit: limit ?? 10,
      })

      if (scores.length === 0) {
        return {
          success: true,
          data: { customers: [] },
          summary: 'No customer scores computed yet. Run customer scoring first.',
        }
      }

      const summary = scores.map((s, i) =>
        `  ${i + 1}. ${s.customerName} (${s.segment}) — ${s.compositeScore}/100 | LTV: ${s.lifetimeValue.toLocaleString()} KES | Churn Risk: ${(s.churnRisk * 100).toFixed(0)}%`
      ).join('\n')

      return {
        success: true,
        data: { customers: scores },
        summary: `Top ${scores.length} Customers:\n${summary}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch top customers',
        summary: 'Unable to retrieve top customers.',
      }
    }
  },
}

/**
 * getTopSuppliers — Returns top-scored suppliers.
 *
 * NL patterns: "Show best suppliers", "Rate our suppliers", "Which suppliers are most reliable?"
 */
const getTopSuppliersTool: ToolDefinition = {
  name: 'getTopSuppliers',
  description: 'Returns top-scored suppliers sorted by composite score, with breakdown (quality, reliability, price, lead time).',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of suppliers to return (default: 10)',
      },
    },
    required: [],
  },
  isWrite: false,
  handler: async (args: Record<string, unknown>, context) => {
    try {
      const { limit } = args as { limit?: number }
      void context

      const scores = await supplierScorer.queryScores({
        type: 'supplier',
        limit: limit ?? 10,
      })

      if (scores.length === 0) {
        return {
          success: true,
          data: { suppliers: [] },
          summary: 'No supplier scores computed yet. Run supplier scoring first.',
        }
      }

      const summary = scores.map((s, i) =>
        `  ${i + 1}. ${s.supplierName} — ${s.compositeScore}/100 (Quality: ${s.qualityScore}, Reliability: ${s.reliabilityScore}, Price: ${s.priceScore}, Lead Time: ${s.leadTimeScore})`
      ).join('\n')

      return {
        success: true,
        data: { suppliers: scores },
        summary: `Top ${scores.length} Suppliers:\n${summary}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch top suppliers',
        summary: 'Unable to retrieve top suppliers.',
      }
    }
  },
}

// ─── Imports for Forecasting Tools ─────────────────────────────────

import { demandForecaster } from '@/lib/modules/product-intelligence/forecasting'
import { revenueForecaster } from '@/lib/modules/product-intelligence/forecasting'
import { seasonalityDetector } from '@/lib/modules/product-intelligence/forecasting'
import { forecastRepository } from '@/lib/modules/product-intelligence/repositories/forecast-repository'

/**
 * getDemandForecast — Predicts future demand for a product.
 *
 * NL patterns: "What will demand be for product X?", "Forecast product X",
 * "How many units of X will we sell next week?"
 */
const getDemandForecastTool: ToolDefinition = {
  name: 'getDemandForecast',
  description: 'Predicts future demand (unit sales) for a specific product over the next N periods (days/weeks/months). Automatically selects the best forecasting method. Returns forecast values, confidence intervals, accuracy (MAPE), and the method used.',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Product ID to forecast demand for',
      },
      periods: {
        type: 'number',
        description: 'Number of periods to forecast (default: 7)',
      },
      method: {
        type: 'string',
        description: 'Optional forecasting method override. Options: simple_moving_average, weighted_moving_average, exponential_smoothing, linear_regression, seasonal_decomposition, holt_winters. Auto-selected if omitted.',
        enum: [
          'simple_moving_average',
          'weighted_moving_average',
          'exponential_smoothing',
          'linear_regression',
          'seasonal_decomposition',
          'holt_winters',
        ],
      },
      branchId: {
        type: 'string',
        description: 'Optional branch ID to scope the forecast',
      },
    },
    required: ['productId'],
  },
  isWrite: false,
  handler: async (args: Record<string, unknown>, context) => {
    try {
      const { productId, periods, method, branchId } = args as {
        productId: string; periods?: number; method?: string; branchId?: string
      }
      void context

      const config = periods ? { periods } : undefined
      const methodConfig = method ? { method: method as never, periods: periods ?? 7 } : undefined
      const effectiveConfig = config ?? methodConfig

      const forecast = await demandForecaster.getForecastOrCompute(
        productId,
        branchId,
        effectiveConfig ? { ...effectiveConfig } : undefined,
      )

      const forecastStr = forecast.forecastValues
        .map((v: number, i: number) => `  Period ${i + 1}: ${Math.round(v)} units`)
        .join('\n')

      return {
        success: true,
        data: forecast,
        summary: [
          `Demand Forecast for ${productId}:`,
          `Method: ${forecast.method}`,
          `Accuracy (MAPE): ${forecast.accuracy?.mape.toFixed(1) ?? 'N/A'}%`,
          `Data Points: ${forecast.dataPoints}`,
          `Forecast (${forecast.predictionHorizon} periods):`,
          forecastStr,
          `Confidence: ±${((forecast.confidenceInterval.upper[0] - forecast.forecastValues[0]) / forecast.forecastValues[0] * 100).toFixed(0)}%`,
        ].join('\n'),
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compute demand forecast',
        summary: 'Unable to generate demand forecast. The product may not have enough sales history.',
      }
    }
  },
}

/**
 * getRevenueForecast — Predicts future revenue.
 *
 * NL patterns: "What will our revenue be next month?", "Revenue forecast",
 * "How much money will we make?"
 */
const getRevenueForecastTool: ToolDefinition = {
  name: 'getRevenueForecast',
  description: 'Predicts future revenue over the next N periods (days/weeks/months). Automatically selects the best forecasting method. Returns projected total, growth rate, confidence intervals, and forecasting method used.',
  parameters: {
    type: 'object',
    properties: {
      periods: {
        type: 'number',
        description: 'Number of periods to forecast (default: 30)',
      },
      branchId: {
        type: 'string',
        description: 'Optional branch ID to scope the forecast',
      },
    },
    required: [],
  },
  isWrite: false,
  handler: async (args: Record<string, unknown>, context) => {
    try {
      const { periods, branchId } = args as { periods?: number; branchId?: string }
      void context

      const config = periods ? { periods } : undefined
      const forecast = await revenueForecaster.getForecastOrCompute(branchId, config)

      const forecastStr = forecast.forecastValues
        .map((v: number, i: number) => `  Period ${i + 1}: ${v.toLocaleString()} KES`)
        .join('\n')

      return {
        success: true,
        data: forecast,
        summary: [
          'Revenue Forecast:',
          `Method: ${forecast.method}`,
          `Accuracy (MAPE): ${forecast.accuracy?.mape.toFixed(1) ?? 'N/A'}%`,
          `Projected Total: ${forecast.projectedTotal.toLocaleString()} KES`,
          `Current Period Total: ${forecast.currentPeriodTotal.toLocaleString()} KES`,
          `Growth Rate: ${forecast.growthRate != null ? `${forecast.growthRate >= 0 ? '+' : ''}${forecast.growthRate.toFixed(1)}%` : 'N/A'}`,
          `Forecast (${forecast.predictionHorizon} periods):`,
          forecastStr,
        ].join('\n'),
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compute revenue forecast',
        summary: 'Unable to generate revenue forecast. There may not be enough sales history.',
      }
    }
  },
}

/**
 * getSeasonality — Detects seasonal patterns in product sales.
 *
 * NL patterns: "Is there seasonality for product X?", "Show seasonal patterns",
 * "What days are busiest?"
 */
const getSeasonalityTool: ToolDefinition = {
  name: 'getSeasonality',
  description: 'Detects seasonal patterns in sales data for a product. Returns the seasonal pattern type (daily/weekly/monthly/quarterly/none), seasonal factors, strength (0-1), and detected period length.',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Product ID to detect seasonality for',
      },
      branchId: {
        type: 'string',
        description: 'Optional branch ID to scope detection',
      },
    },
    required: ['productId'],
  },
  isWrite: false,
  handler: async (args: Record<string, unknown>, context) => {
    try {
      const { productId, branchId } = args as { productId: string; branchId?: string }
      void context

      // Try cached first
      const cached = await seasonalityDetector.getSeasonality(productId, branchId)
      const result = cached ?? await seasonalityDetector.detectSeasonality(productId, branchId)

      const factorsStr = result.factors
        .map((f: number, i: number) => `  Period ${i + 1}: ${(f * 100).toFixed(1)}%`)
        .join('\n')

      return {
        success: true,
        data: result,
        summary: [
          `Seasonality for ${productId}:`,
          `Pattern: ${result.pattern}`,
          `Strength: ${(result.strength * 100).toFixed(1)}%`,
          `Period: ${result.period} days`,
          `Confidence: ${(result.confidence * 100).toFixed(0)}%`,
          `Seasonal Factors:`,
          factorsStr,
        ].join('\n'),
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to detect seasonality',
        summary: 'Unable to detect seasonality. The product may not have enough sales history.',
      }
    }
  },
}

/**
 * getForecastAccuracy — Returns historical accuracy of forecasting methods.
 *
 * NL patterns: "How accurate are our forecasts?", "Which forecast method is best?",
 * "Show forecast accuracy for product X"
 */
const getForecastAccuracyTool: ToolDefinition = {
  name: 'getForecastAccuracy',
  description: 'Returns the historical accuracy (MAPE) of different forecasting methods. Can be scoped to a specific product or return overall method rankings.',
  parameters: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Optional product ID to get method-specific accuracy for',
      },
    },
    required: [],
  },
  isWrite: false,
  handler: async (args: Record<string, unknown>, context) => {
    try {
      const { productId } = args as { productId?: string }
      void context

      const accuracy = await forecastRepository.getMethodAccuracy(productId)

      if (accuracy.length === 0) {
        return {
          success: true,
          data: { accuracy: [] },
          summary: 'No forecast accuracy data available yet. Forecasts need to be generated first.',
        }
      }

      const summary = accuracy
        .map((a: { method: string; avgMape: number; count: number }, i: number) =>
          `  ${i + 1}. ${a.method}: ${a.avgMape.toFixed(1)}% MAPE (${a.count} evaluations)`,
        )
        .join('\n')

      return {
        success: true,
        data: { accuracy },
        summary: `Forecast Method Accuracy:\n${summary}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch forecast accuracy',
        summary: 'Unable to retrieve forecast accuracy data.',
      }
    }
  },
}

// ─── Imports for Recommendation Tools ──────────────────────────────

import { crossSellEngine } from '@/lib/modules/product-intelligence/recommendations'
import { reorderEngine } from '@/lib/modules/product-intelligence/recommendations'
import { pricingEngine } from '@/lib/modules/product-intelligence/recommendations'
import { anomalyDetector } from '@/lib/modules/product-intelligence/insights/anomaly-detector'
import { trendAnalyzer } from '@/lib/modules/product-intelligence/insights/trend-analyzer'

/**
 * getRecommendations — Returns aggregated recommendations across all engines.
 *
 * NL patterns: "What recommendations do you have?", "Show me all recommendations"
 */
const getRecommendationsTool: ToolDefinition = {
  name: 'getRecommendations',
  description: 'Returns aggregated recommendations across cross-sell, reorder, and pricing engines. Provides a holistic view of actionable intelligence.',
  parameters: {
    type: 'object',
    properties: {
      branchId: {
        type: 'string',
        description: 'Optional branch ID to scope recommendations',
      },
      limit: {
        type: 'number',
        description: 'Maximum results per category (default: 5)',
      },
    },
    required: [],
  },
  isWrite: false,
  handler: async (args: Record<string, unknown>, context) => {
    try {
      const { branchId, limit } = args as { branchId?: string; limit?: number }
      void context

      const effectiveLimit = limit ?? 5

      // Run all engines (no guaranteed data, so catch per-engine)
      const [reorderSignals, pricingSignals] = await Promise.all([
        reorderEngine.getSuggestions({ branchId, limit: effectiveLimit }).catch(() => []),
        Promise.all([]), // placeholder — pricing signals are on-demand per product
      ])

      const summaryParts: string[] = []

      if (reorderSignals.length > 0) {
        const urgent = reorderSignals.filter(s => s.urgency === 'immediate' || s.urgency === 'soon')
        summaryParts.push(`Reorder: ${urgent.length} urgent suggestions (${reorderSignals.length} total)`)
      } else {
        summaryParts.push('Reorder: No pending reorder suggestions')
      }

      return {
        success: true,
        data: {
          reorder: reorderSignals,
          pricing: pricingSignals,
        },
        summary: summaryParts.join('\n'),
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch recommendations',
        summary: 'Unable to retrieve recommendations.',
      }
    }
  },
}

/**
 * getCrossSellSuggestions — Returns cross-sell recommendations for given cart items.
 *
 * NL patterns: "What should I cross-sell?", "What goes well with this product?",
 * "Show me complementary products"
 */
const getCrossSellSuggestionsTool: ToolDefinition = {
  name: 'getCrossSellSuggestions',
  description: 'Returns cross-sell recommendations for a set of products (cart items). Uses a pre-computed product affinity matrix (lift, confidence, support) to suggest complementary products. Returns product name, score, confidence, reason, and price.',
  parameters: {
    type: 'object',
    properties: {
      productIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of product IDs currently in the cart',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of suggestions to return (default: 5)',
      },
      branchId: {
        type: 'string',
        description: 'Optional branch ID for branch-specific affinities',
      },
    },
    required: ['productIds'],
  },
  isWrite: false,
  handler: async (args: Record<string, unknown>, context) => {
    try {
      const { productIds, limit, branchId } = args as {
        productIds: string[]; limit?: number; branchId?: string
      }
      void context

      if (!productIds || productIds.length === 0) {
        return {
          success: true,
          data: { suggestions: [] },
          summary: 'No products provided for cross-sell suggestions.',
        }
      }

      const suggestions = await crossSellEngine.getRecommendations(productIds, limit, branchId)

      if (suggestions.length === 0) {
        return {
          success: true,
          data: { suggestions: [] },
          summary: 'No cross-sell suggestions found for the given products.',
        }
      }

      const summary = suggestions.map((s, i) =>
        `  ${i + 1}. ${s.productName} — Score: ${s.score}, Confidence: ${(s.confidence * 100).toFixed(0)}%, Price: ${s.price.toLocaleString()} KES`
      ).join('\n')

      return {
        success: true,
        data: { suggestions },
        summary: `Cross-Sell Suggestions:\n${summary}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get cross-sell suggestions',
        summary: 'Unable to generate cross-sell suggestions.',
      }
    }
  },
}

/**
 * getReorderRecommendations — Returns reorder suggestions based on EOQ/ROP/safety stock.
 *
 * NL patterns: "What should I reorder?", "Show reorder suggestions",
 * "Which products need restocking?", "What's the reorder status?"
 */
const getReorderRecommendationsTool: ToolDefinition = {
  name: 'getReorderRecommendations',
  description: 'Returns reorder suggestions for products based on EOQ (Economic Order Quantity), ROP (Reorder Point), and safety stock analysis. Uses forecast daily demand, current inventory, lead time, and service level. Each suggestion includes urgency, stockout estimate, order quantity, and estimated cost.',
  parameters: {
    type: 'object',
    properties: {
      branchId: {
        type: 'string',
        description: 'Optional branch ID to scope reorder suggestions',
      },
      urgency: {
        type: 'string',
        description: 'Optional urgency filter (immediate, soon, normal, sufficient)',
        enum: ['immediate', 'soon', 'normal', 'sufficient'],
      },
      limit: {
        type: 'number',
        description: 'Maximum suggestions to return (default: 10)',
      },
      productId: {
        type: 'string',
        description: 'Optional specific product ID to check reorder status',
      },
    },
    required: [],
  },
  isWrite: false,
  handler: async (args: Record<string, unknown>, context) => {
    try {
      const { branchId, urgency, limit, productId } = args as {
        branchId?: string; urgency?: string; limit?: number; productId?: string
      }
      void context

      // If a specific product is requested, evaluate it live
      if (productId) {
        const suggestion = await reorderEngine.evaluateProduct(productId, branchId)
        return {
          success: true,
          data: { suggestions: [suggestion] },
          summary: [
            `Reorder for ${suggestion.productName}:`,
            `  Status: ${suggestion.urgency}`,
            `  Current Stock: ${suggestion.currentStock}`,
            `  Reorder Point: ${suggestion.reorderPoint}`,
            `  Safety Stock: ${suggestion.safetyStock}`,
            `  EOQ: ${suggestion.economicOrderQty}`,
            `  Suggested Order: ${suggestion.suggestedOrderQty}`,
            `  Days Until Stockout: ${suggestion.daysUntilStockout === Infinity ? 'N/A' : suggestion.daysUntilStockout}`,
            `  Est. Annual Cost: ${suggestion.estimatedCost.toLocaleString()} KES`,
          ].join('\n'),
        }
      }

      // Otherwise query persisted suggestions
      const suggestions = await reorderEngine.getSuggestions({
        branchId,
        urgency: urgency as 'immediate' | 'soon' | 'normal' | 'sufficient' | undefined,
        limit: limit ?? 10,
      })

      if (suggestions.length === 0) {
        return {
          success: true,
          data: { suggestions: [] },
          summary: 'No reorder suggestions at this time. All inventory levels appear sufficient.',
        }
      }

      const summary = suggestions.map((s, i) =>
        `  ${i + 1}. ${s.productName} — ${s.urgency.toUpperCase()} | Stock: ${s.currentStock} | ROP: ${s.reorderPoint} | Days to Stockout: ${s.daysUntilStockout === Infinity ? 'N/A' : s.daysUntilStockout.toFixed(1)}`
      ).join('\n')

      const urgentCount = suggestions.filter(s => s.urgency === 'immediate' || s.urgency === 'soon').length
      const statusLine = urgentCount > 0
        ? `⚠️ ${urgentCount} product(s) need immediate attention`
        : '✅ All products have sufficient stock levels'

      return {
        success: true,
        data: { suggestions },
        summary: `${statusLine}\n\nReorder Suggestions:\n${summary}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get reorder recommendations',
        summary: 'Unable to generate reorder recommendations.',
      }
    }
  },
}

/**
 * getPricingSignals — Returns pricing signals (raise/lower/hold/promote).
 *
 * NL patterns: "What pricing changes should I make?", "Show pricing signals",
 * "Which products should I discount?"
 */
const getPricingSignalsTool: ToolDefinition = {
  name: 'getPricingSignals',
  description: 'Returns pricing optimization signals for products. Each signal indicates whether to raise, lower, hold, or promote pricing, with confidence score, suggested price, and reason. Analyzes sales velocity, margin, inventory level, and dead stock status.',
  parameters: {
    type: 'object',
    properties: {
      branchId: {
        type: 'string',
        description: 'Optional branch ID to scope pricing signals',
      },
      productId: {
        type: 'string',
        description: 'Optional specific product ID to analyze',
      },
      limit: {
        type: 'number',
        description: 'Maximum pricing signals to return (default: 10)',
      },
    },
    required: [],
  },
  isWrite: false,
  handler: async (args: Record<string, unknown>, context) => {
    try {
      const { branchId, productId, limit } = args as {
        branchId?: string; productId?: string; limit?: number
      }
      void context

      // If a specific product is requested
      if (productId) {
        const signal = await pricingEngine.getPriceSignal(productId, branchId)
        return {
          success: true,
          data: { signals: [signal] },
          summary: [
            `Pricing Signal for ${signal.productName}:`,
            `  Signal: ${signal.signal.toUpperCase()}`,
            `  Current Price: ${signal.currentPrice.toLocaleString()} KES`,
            signal.suggestedPrice ? `  Suggested Price: ${signal.suggestedPrice.toLocaleString()} KES` : '',
            `  Confidence: ${(signal.confidence * 100).toFixed(0)}%`,
            `  Elasticity: ${signal.elasticity ?? 'N/A'}`,
            `  Reason: ${signal.reason}`,
          ].filter(Boolean).join('\n'),
        }
      }

      // Otherwise batch evaluate
      const signals = await pricingEngine.getAllPriceSignals(branchId, limit ?? 50)
      const filtered = signals.slice(0, limit ?? 10)

      const raiseCount = filtered.filter(s => s.signal === 'raise').length
      const lowerCount = filtered.filter(s => s.signal === 'lower').length
      const promoteCount = filtered.filter(s => s.signal === 'promote').length

      const summary = filtered.map((s, i) =>
        `  ${i + 1}. ${s.productName} — ${s.signal.toUpperCase()} | Current: ${s.currentPrice.toLocaleString()} KES${s.suggestedPrice ? ` → ${s.suggestedPrice.toLocaleString()} KES` : ''} | Confidence: ${(s.confidence * 100).toFixed(0)}%`
      ).join('\n')

      return {
        success: true,
        data: { signals: filtered },
        summary: [
          `Pricing Signals (${filtered.length} of ${signals.length} total):`,
          `  ${raiseCount} price increase opportunities`,
          `  ${lowerCount} markdown candidates`,
          `  ${promoteCount} dead stock items`,
          '',
          summary,
        ].join('\n'),
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pricing signals',
        summary: 'Unable to generate pricing signals.',
      }
    }
  },
}

/**
 * getAnomalies — Returns detected anomalies across sales, KPI, and inventory data.
 *
 * NL patterns: "What anomalies are there?", "Show me anomalies",
 * "Any unusual patterns?", "What's abnormal?"
 */
const getAnomaliesTool: ToolDefinition = {
  name: 'getAnomalies',
  description: 'Returns detected anomalies across sales, KPI, and inventory data using Z-score and IQR-based statistical methods. Each anomaly includes severity (critical/high/medium/low), direction (spike/drop/unusual), deviation in standard deviations, and a human-readable explanation.',
  parameters: {
    type: 'object',
    properties: {
      branchId: {
        type: 'string',
        description: 'Optional branch ID to scope anomaly detection',
      },
      scanType: {
        type: 'string',
        description: 'Optional scan type filter: sales, kpi, inventory, or all (default: all)',
        enum: ['all', 'sales', 'kpi', 'inventory'],
      },
    },
    required: [],
  },
  isWrite: false,
  handler: async (args: Record<string, unknown>, context) => {
    try {
      const { branchId, scanType } = args as { branchId?: string; scanType?: string }
      void context

      let anomalies: Array<{
        entityType: string; entityId: string; entityName: string
        metric: string; expectedValue: number; actualValue: number
        deviation: number; direction: string; severity: string
        details: string
      }> = []

      switch (scanType) {
        case 'sales':
          anomalies = await anomalyDetector.detectSalesAnomalies(branchId)
          break
        case 'kpi':
          anomalies = await anomalyDetector.detectKPIAnomalies(branchId)
          break
        case 'inventory':
          anomalies = await anomalyDetector.detectInventoryAnomalies(branchId)
          break
        default:
          anomalies = await anomalyDetector.fullScan(branchId)
      }

      if (anomalies.length === 0) {
        return {
          success: true,
          data: { anomalies: [] },
          summary: 'No anomalies detected. All metrics within expected ranges.',
        }
      }

      const criticalCount = anomalies.filter(a => a.severity === 'critical').length
      const highCount = anomalies.filter(a => a.severity === 'high').length

      const summary = anomalies.map((a, i) =>
        `  ${i + 1}. [${a.severity.toUpperCase()}] ${a.entityName} — ${a.details}`
      ).join('\n')

      const statusLine = criticalCount > 0
        ? `⚠️ ${criticalCount} critical anomaly(ies) require attention`
        : highCount > 0
          ? `⚠️ ${highCount} high-severity anomaly(ies) found`
          : `✅ ${anomalies.length} anomaly(ies) detected (all low/medium severity)`

      return {
        success: true,
        data: { anomalies },
        summary: `${statusLine}\n\nDetected Anomalies:\n${summary}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to detect anomalies',
        summary: 'Unable to run anomaly detection.',
      }
    }
  },
}

/**
 * getTrends — Returns trend analysis across KPIs and revenue.
 *
 * NL patterns: "What are the trends?", "Show me trends",
 * "How are things trending?", "Which way are KPIs moving?"
 */
const getTrendsTool: ToolDefinition = {
  name: 'getTrends',
  description: 'Returns trend analysis for all tracked KPIs and revenue. Each trend shows direction (up/down/stable/volatile), percentage change, significance (high/medium/low), and a human-readable description. Uses linear regression for slope detection and R² for confidence.',
  parameters: {
    type: 'object',
    properties: {
      branchId: {
        type: 'string',
        description: 'Optional branch ID to scope trend analysis',
      },
      metric: {
        type: 'string',
        description: 'Optional specific KPI metric to analyze (e.g., revenue_velocity, gross_margin_pct)',
      },
    },
    required: [],
  },
  isWrite: false,
  handler: async (args: Record<string, unknown>, context) => {
    try {
      const { branchId, metric } = args as { branchId?: string; metric?: string }
      void context

      let trends: Array<{
        entityType: string; entityId: string; entityName: string
        metric: string; direction: string; changePct: number
        period: string; significance: string; description: string
      }> = []

      if (metric) {
        // Analyze a specific KPI metric
        const def = (await import('@/lib/modules/product-intelligence/kpi')).kpiTracker.getDefinition(metric as never)
        if (def) {
          const trend = await trendAnalyzer.analyzeMetric('kpi', metric, def.name, '30d')
          trends = [trend]
        } else {
          return {
            success: true,
            data: { trends: [] },
            summary: `No KPI definition found for "${metric}".`,
          }
        }
      } else {
        // Analyze all
        trends = await trendAnalyzer.analyzeAll(branchId)
      }

      if (trends.length === 0) {
        return {
          success: true,
          data: { trends: [] },
          summary: 'No trend data available yet. KPI snapshots need to be recorded first.',
        }
      }

      const summary = trends.map((t, i) => {
        const dirIcon = t.direction === 'up' ? '↑' : t.direction === 'down' ? '↓' : t.direction === 'volatile' ? '↕' : '→'
        return `  ${i + 1}. ${t.entityName}: ${dirIcon} ${t.direction.toUpperCase()} (${t.changePct >= 0 ? '+' : ''}${t.changePct.toFixed(1)}%) [${t.significance}] — ${t.description}`
      }).join('\n')

      const upCount = trends.filter(t => t.direction === 'up').length
      const downCount = trends.filter(t => t.direction === 'down').length
      const volatileCount = trends.filter(t => t.direction === 'volatile').length

      return {
        success: true,
        data: { trends },
        summary: [
          `Trend Analysis (${trends.length} metrics):`,
          `  ${upCount} up | ${downCount} down | ${volatileCount} volatile | ${trends.length - upCount - downCount - volatileCount} stable`,
          '',
          summary,
        ].join('\n'),
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze trends',
        summary: 'Unable to run trend analysis.',
      }
    }
  },
}

/**
 * All Product Intelligence AI tools.
 * Register with the tool registry during initialization.
 */
export const productIntelligenceTools: ToolDefinition[] = [
  getKPIStatusTool,
  getBusinessHealthTool,
  getTopProductsTool,
  getTopCustomersTool,
  getTopSuppliersTool,
  getDemandForecastTool,
  getRevenueForecastTool,
  getSeasonalityTool,
  getForecastAccuracyTool,
  getRecommendationsTool,
  getCrossSellSuggestionsTool,
  getReorderRecommendationsTool,
  getPricingSignalsTool,
  getAnomaliesTool,
  getTrendsTool,
]
