'use client'

import { logger } from '@/lib/logger'
import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { formatKSh } from '@/lib/currency'
import { createClient } from '@supabase/supabase-js'
import {
  analyzeSalesIntelligence, analyzeInventoryIntelligence, aiChat,
  type AIInsight, type AISalesAnalysis, type AIInventoryAnalysis,
} from '@/lib/modules/ai'
import { AIAssistantInterface } from '@/components/ui/ai-assistant-interface'
import {
  Brain, TrendingUp, TrendingDown, ShoppingCart, Package, Users,
  DollarSign, BarChart3, RefreshCw, AlertTriangle, Zap, Target,
  Clock, Star, Boxes, Sparkles, Lightbulb, Shield,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

// ─── Supabase Client ──────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Priority Colors ──────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const PRIORITY_ICONS: Record<string, React.ReactNode> = {
  high: <AlertTriangle className="h-4 w-4" />,
  medium: <Lightbulb className="h-4 w-4" />,
  low: <Star className="h-4 w-4" />,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AICenterPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('sales')

  // ── AI State ──
  const [salesAnalysis, setSalesAnalysis] = useState<AISalesAnalysis | null>(null)
  const [inventoryAnalysis, setInventoryAnalysis] = useState<AIInventoryAnalysis | null>(null)
  const [analyzingSales, setAnalyzingSales] = useState(false)
  const [analyzingInventory, setAnalyzingInventory] = useState(false)

  // ── Raw Data State ──
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalTransactions, setTotalTransactions] = useState(0)
  const [totalProducts, setTotalProducts] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [outOfStockCount, setOutOfStockCount] = useState(0)
  const [totalInventoryValue, setTotalInventoryValue] = useState(0)

  // ── Chat State ──
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)

  // ── Load Raw Data ──
  const loadRawData = useCallback(async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const [salesData, productsData] = await Promise.all([
        supabase.from('sales')
          .select('total_amount, created_at')
          .gte('created_at', thirtyDaysAgo)
          .eq('payment_status', 'completed'),
        supabase.from('products')
          .select('id, stock_quantity, reorder_level, purchase_price'),
      ])

      const sales = salesData.data || []
      const products = productsData.data || []

      setTotalRevenue(sales.reduce((sum, s) => sum + (s.total_amount || 0), 0))
      setTotalTransactions(sales.length)
      setTotalProducts(products.length)
      setLowStockCount(products.filter(p => (p.stock_quantity || 0) > 0 && (p.stock_quantity || 0) <= (p.reorder_level || 10)).length)
      setOutOfStockCount(products.filter(p => (p.stock_quantity || 0) <= 0).length)
      setTotalInventoryValue(products.reduce((sum, p) => sum + (p.stock_quantity || 0) * (p.purchase_price || 0), 0))
    } catch (err: unknown) {
      logger.error('Error loading raw data:', err)
    }
  }, [])

  // ── Run Sales Analysis ──
  const runSalesAnalysis = useCallback(async () => {
    setAnalyzingSales(true)
    try {
      const result = await analyzeSalesIntelligence()
      setSalesAnalysis(result)
    } catch (err: unknown) {
      toast({ title: 'AI Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setAnalyzingSales(false)
    }
  }, [toast])

  // ── Run Inventory Analysis ──
  const runInventoryAnalysis = useCallback(async () => {
    setAnalyzingInventory(true)
    try {
      const result = await analyzeInventoryIntelligence()
      setInventoryAnalysis(result)
    } catch (err: unknown) {
      toast({ title: 'AI Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setAnalyzingInventory(false)
    }
  }, [toast])

  // ── Chat ──
  const handleChat = async () => {
    if (!chatInput.trim()) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setChatLoading(true)

    try {
      const context = `Business context: ${totalTransactions} sales (30d), KES ${totalRevenue.toLocaleString()} revenue, ${totalProducts} products, ${lowStockCount} low stock items.`
      const response = await aiChat(userMsg, context)
      setChatMessages(prev => [...prev, { role: 'assistant', content: response }])
    } catch (err: unknown) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` }])
    } finally {
      setChatLoading(false)
    }
  }

  // ── Initial Load ──
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadRawData()
      setLoading(false)
    }
    init()
  }, [loadRawData])

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 mt-1" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
        </div>
        <Card><CardContent className="p-4"><Skeleton className="h-[400px] w-full" /></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" />
            AI Intelligence Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered insights for your WINNMATT supermarket
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadRawData}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh Data
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Revenue (30d)</p>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold">{formatKSh(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Transactions (30d)</p>
              <ShoppingCart className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold">{totalTransactions.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total Products</p>
              <Boxes className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold">{totalProducts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Low Stock Alerts</p>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold">{lowStockCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sales" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Sales Intelligence
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="h-4 w-4" />
            Inventory Intelligence
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-2">
            <Sparkles className="h-4 w-4" />
            AI Assistant
          </TabsTrigger>
        </TabsList>

        {/* ─── Sales Intelligence Tab ──────────────────────────────── */}
        <TabsContent value="sales" className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              AI analyzes your sales data and provides actionable insights
            </p>
            <Button onClick={runSalesAnalysis} disabled={analyzingSales}>
              {analyzingSales ? (
                <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Analyzing...</>
              ) : (
                <><Brain className="h-4 w-4 mr-1" /> Run AI Analysis</>
              )}
            </Button>
          </div>

          {salesAnalysis && (
            <>
              {/* Summary */}
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Executive Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{salesAnalysis.summary}</p>
                </CardContent>
              </Card>

              {/* Opportunities */}
              {salesAnalysis.top_opportunities.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 text-emerald-700">
                      <Target className="h-5 w-5" />
                      Top Opportunities
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {salesAnalysis.top_opportunities.map((opp, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-emerald-600 mt-0.5">+</span>
                          {opp}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Risk Alerts */}
              {salesAnalysis.risk_alerts.length > 0 && (
                <Card className="border-amber-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
                      <Shield className="h-5 w-5" />
                      Risk Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {salesAnalysis.risk_alerts.map((risk, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Detailed Insights */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Detailed Insights ({salesAnalysis.insights.length})
                </h3>
                {salesAnalysis.insights.map((insight) => (
                  <Card key={insight.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={PRIORITY_COLORS[insight.priority]}>
                              {PRIORITY_ICONS[insight.priority]}
                              <span className="ml-1 capitalize">{insight.priority}</span>
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(insight.confidence * 100)}% confidence
                            </span>
                          </div>
                          <h4 className="font-semibold">{insight.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{insight.summary}</p>
                          {insight.details && (
                            <p className="text-sm mt-2 whitespace-pre-line">{insight.details}</p>
                          )}
                          {insight.recommendation && (
                            <div className="mt-3 p-3 bg-primary/5 rounded-lg">
                              <p className="text-sm font-medium text-primary">Recommendation:</p>
                              <p className="text-sm mt-1">{insight.recommendation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {!salesAnalysis && !analyzingSales && (
            <Card className="flex items-center justify-center min-h-[200px]">
              <div className="text-center text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Click &quot;Run AI Analysis&quot; to get started</p>
                <p className="text-sm">AI will analyze your sales data and provide insights</p>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ─── Inventory Intelligence Tab ──────────────────────────── */}
        <TabsContent value="inventory" className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              AI analyzes inventory health, stock levels, and dead stock
            </p>
            <Button onClick={runInventoryAnalysis} disabled={analyzingInventory}>
              {analyzingInventory ? (
                <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Analyzing...</>
              ) : (
                <><Brain className="h-4 w-4 mr-1" /> Run AI Analysis</>
              )}
            </Button>
          </div>

          {inventoryAnalysis && (
            <>
              {/* Summary */}
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Executive Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{inventoryAnalysis.summary}</p>
                </CardContent>
              </Card>

              {/* Reorder Suggestions */}
              {inventoryAnalysis.reorder_suggestions.length > 0 && (
                <Card className="border-amber-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
                      <Package className="h-5 w-5" />
                      Reorder Suggestions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Current Stock</TableHead>
                          <TableHead className="text-right">Suggested Qty</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inventoryAnalysis.reorder_suggestions.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{item.product}</TableCell>
                            <TableCell className="text-right text-amber-600">{item.current_stock}</TableCell>
                            <TableCell className="text-right font-bold">{item.suggested_qty}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Markdown Suggestions */}
              {inventoryAnalysis.markdown_suggestions.length > 0 && (
                <Card className="border-red-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                      <Clock className="h-5 w-5" />
                      Markdown / Discontinue Suggestions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-right">Days Stale</TableHead>
                          <TableHead>Suggested Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inventoryAnalysis.markdown_suggestions.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{item.product}</TableCell>
                            <TableCell className="text-right">{item.current_stock}</TableCell>
                            <TableCell className="text-right text-red-600">{item.days_stale} days</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.suggested_action}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Detailed Insights */}
              {inventoryAnalysis.insights.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    Detailed Insights ({inventoryAnalysis.insights.length})
                  </h3>
                  {inventoryAnalysis.insights.map((insight) => (
                    <Card key={insight.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={PRIORITY_COLORS[insight.priority]}>
                            {PRIORITY_ICONS[insight.priority]}
                            <span className="ml-1 capitalize">{insight.priority}</span>
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(insight.confidence * 100)}% confidence
                          </span>
                        </div>
                        <h4 className="font-semibold">{insight.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{insight.summary}</p>
                        {insight.details && (
                          <p className="text-sm mt-2 whitespace-pre-line">{insight.details}</p>
                        )}
                        {insight.recommendation && (
                          <div className="mt-3 p-3 bg-primary/5 rounded-lg">
                            <p className="text-sm font-medium text-primary">Recommendation:</p>
                            <p className="text-sm mt-1">{insight.recommendation}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {!inventoryAnalysis && !analyzingInventory && (
            <Card className="flex items-center justify-center min-h-[200px]">
              <div className="text-center text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Click &quot;Run AI Analysis&quot; to get started</p>
                <p className="text-sm">AI will analyze your inventory and provide recommendations</p>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ─── AI Chat Tab ─────────────────────────────────────────── */}
        <TabsContent value="chat" className="space-y-4">
          {/* AI Assistant Interface — hero input with suggestions */}
          <AIAssistantInterface
            onSendMessage={(msg) => {
              setChatInput(msg)
              // Trigger the AI chat on next tick so the input is set first
              setTimeout(() => {
                const input = msg
                setChatInput('')
                setChatMessages(prev => [...prev, { role: 'user', content: input }])
                setChatLoading(true)
                const context = `Business context: ${totalTransactions} sales (30d), KES ${totalRevenue.toLocaleString()} revenue, ${totalProducts} products, ${lowStockCount} low stock items.`
                aiChat(input, context)
                  .then(response => setChatMessages(prev => [...prev, { role: 'assistant', content: response }]))
                  .catch((err: unknown) => setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` }]))
                  .finally(() => setChatLoading(false))
              }, 0)
            }}
            disabled={chatLoading}
            placeholder="Ask about your business — sales, inventory, customers, finances..."
          />

          {/* Chat history */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Conversation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[400px] overflow-y-auto">
              {chatMessages.length === 0 ? (
                <EmptyState icon={Brain} title="Your conversation will appear here" description="Try asking about sales trends, inventory status, or business recommendations" compact />
              ) : (
                chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 text-sm whitespace-pre-line ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3 text-sm">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
