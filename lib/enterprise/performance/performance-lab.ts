export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  threshold_warning: number;
  threshold_critical: number;
  timestamp: string;
  tags: Record<string, string>;
}

export interface BenchmarkResult {
  id: string;
  name: string;
  category: string;
  value: number;
  unit: string;
  baseline: number;
  deviation_percent: number;
  status: 'pass' | 'warning' | 'fail';
  timestamp: string;
  details?: string;
}

export interface PerformanceTest {
  id: string;
  name: string;
  type: 'load' | 'stress' | 'endurance' | 'spike';
  target_metric: string;
  expected_value: number;
  actual_value?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
  results?: any;
}

export interface PerformanceReport {
  id: string;
  generated_at: string;
  period: { start: string; end: string };
  metrics: PerformanceMetric[];
  benchmarks: BenchmarkResult[];
  regressions: PerformanceRegression[];
  recommendations: string[];
  overall_score: number;
}

export interface PerformanceRegression {
  metric: string;
  baseline: number;
  current: number;
  degradation_percent: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class PerformanceLabService {
  private metrics: PerformanceMetric[] = [];
  private benchmarks: BenchmarkResult[] = [];
  private baselines: Map<string, number> = new Map();

  constructor() {
    this.initializeBaselines();
  }

  private initializeBaselines() {
    this.baselines.set('checkout_time_ms', 2000);
    this.baselines.set('search_speed_ms', 500);
    this.baselines.set('report_generation_ms', 5000);
    this.baselines.set('inventory_lookup_ms', 100);
    this.baselines.set('receipt_printing_ms', 3000);
    this.baselines.set('api_latency_ms', 200);
    this.baselines.set('db_query_ms', 50);
    this.baselines.set('memory_usage_mb', 512);
    this.baselines.set('cold_start_ms', 3000);
    this.baselines.set('lcp_ms', 2500);
    this.baselines.set('fid_ms', 100);
  }

  async recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): Promise<PerformanceMetric> {
    const record: PerformanceMetric = {
      ...metric,
      id: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    this.metrics.push(record);

    // Keep only last 50000 metrics
    if (this.metrics.length > 50000) {
      this.metrics.shift();
    }

    return record;
  }

  async runBenchmark(name: string, category: string, testFn: () => Promise<number>): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const value = await testFn();
    const duration = Date.now() - startTime;

    const baseline = this.baselines.get(name) || value;
    const deviationPercent = ((value - baseline) / baseline) * 100;

    let status: 'pass' | 'warning' | 'fail' = 'pass';
    if (deviationPercent > 50) status = 'fail';
    else if (deviationPercent > 20) status = 'warning';

    const result: BenchmarkResult = {
      id: `bench_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      category,
      value,
      unit: 'ms',
      baseline,
      deviation_percent: deviationPercent,
      status,
      timestamp: new Date().toISOString(),
    };

    this.benchmarks.push(result);
    return result;
  }

  async measureCheckoutTime(): Promise<BenchmarkResult> {
    return this.runBenchmark('checkout_time_ms', 'pos', async () => {
      // Simulate checkout measurement
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));
      return Math.floor(Math.random() * 1000) + 1500;
    });
  }

  async measureSearchSpeed(): Promise<BenchmarkResult> {
    return this.runBenchmark('search_speed_ms', 'search', async () => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 200));
      return Math.floor(Math.random() * 200) + 300;
    });
  }

  async measureReportGeneration(): Promise<BenchmarkResult> {
    return this.runBenchmark('report_generation_ms', 'reports', async () => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000));
      return Math.floor(Math.random() * 2000) + 3000;
    });
  }

  async measureInventoryLookup(): Promise<BenchmarkResult> {
    return this.runBenchmark('inventory_lookup_ms', 'inventory', async () => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 50));
      return Math.floor(Math.random() * 50) + 50;
    });
  }

  async measureReceiptPrinting(): Promise<BenchmarkResult> {
    return this.runBenchmark('receipt_printing_ms', 'hardware', async () => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 2000));
      return Math.floor(Math.random() * 1000) + 2000;
    });
  }

  async measureAPILatency(endpoint: string): Promise<BenchmarkResult> {
    return this.runBenchmark('api_latency_ms', 'api', async () => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 100));
      return Math.floor(Math.random() * 100) + 100;
    });
  }

  async measureDatabaseQuery(): Promise<BenchmarkResult> {
    return this.runBenchmark('db_query_ms', 'database', async () => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 30 + 20));
      return Math.floor(Math.random() * 30) + 20;
    });
  }

  async measureColdStart(): Promise<BenchmarkResult> {
    return this.runBenchmark('cold_start_ms', 'startup', async () => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 2000));
      return Math.floor(Math.random() * 1000) + 2000;
    });
  }

  async measureLCP(): Promise<BenchmarkResult> {
    return this.runBenchmark('lcp_ms', 'web_vitals', async () => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1500));
      return Math.floor(Math.random() * 500) + 1500;
    });
  }

  async measureFID(): Promise<BenchmarkResult> {
    return this.runBenchmark('fid_ms', 'web_vitals', async () => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 50));
      return Math.floor(Math.random() * 50) + 50;
    });
  }

  async runAllBenchmarks(): Promise<BenchmarkResult[]> {
    const results = await Promise.all([
      this.measureCheckoutTime(),
      this.measureSearchSpeed(),
      this.measureReportGeneration(),
      this.measureInventoryLookup(),
      this.measureReceiptPrinting(),
      this.measureAPILatency('/api/products'),
      this.measureDatabaseQuery(),
      this.measureColdStart(),
      this.measureLCP(),
      this.measureFID(),
    ]);

    return results;
  }

  async detectRegressions(): Promise<PerformanceRegression[]> {
    const recentBenchmarks = this.benchmarks.slice(-100);
    const regressions: PerformanceRegression[] = [];

    const metricGroups = new Map<string, BenchmarkResult[]>();
    recentBenchmarks.forEach(b => {
      const existing = metricGroups.get(b.name) || [];
      existing.push(b);
      metricGroups.set(b.name, existing);
    });

    metricGroups.forEach((results, metric) => {
      if (results.length >= 2) {
        const baseline = results[0].value;
        const current = results[results.length - 1].value;
        const degradation = ((current - baseline) / baseline) * 100;

        if (degradation > 10) {
          let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
          if (degradation > 50) severity = 'critical';
          else if (degradation > 30) severity = 'high';
          else if (degradation > 20) severity = 'medium';

          regressions.push({
            metric,
            baseline,
            current,
            degradation_percent: degradation,
            severity,
          });
        }
      }
    });

    return regressions.sort((a, b) => b.degradation_percent - a.degradation_percent);
  }

  async getMetricsTrend(metricName: string, hours: number = 24): Promise<PerformanceMetric[]> {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    return this.metrics
      .filter(m => m.name === metricName && new Date(m.timestamp) >= startDate)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async getRecentBenchmarks(limit: number = 50): Promise<BenchmarkResult[]> {
    return this.benchmarks.slice(-limit);
  }

  async generatePerformanceReport(): Promise<PerformanceReport> {
    const regressions = await this.detectRegressions();
    const recentBenchmarks = await this.getRecentBenchmarks(20);

    const overallScore = recentBenchmarks.length
      ? Math.round(recentBenchmarks.filter(b => b.status === 'pass').length / recentBenchmarks.length * 100)
      : 100;

    const recommendations: string[] = [];
    regressions.forEach(r => {
      if (r.severity === 'critical' || r.severity === 'high') {
        recommendations.push(`Investigate ${r.metric}: ${r.degradation_percent.toFixed(1)}% degradation`);
      }
    });

    return {
      id: `report_${Date.now()}`,
      generated_at: new Date().toISOString(),
      period: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      metrics: this.metrics.slice(-100),
      benchmarks: recentBenchmarks,
      regressions,
      recommendations,
      overall_score: overallScore,
    };
  }

  async setBaseline(metricName: string, value: number): Promise<void> {
    this.baselines.set(metricName, value);
  }

  async getBaselines(): Promise<Record<string, number>> {
    return Object.fromEntries(this.baselines);
  }
}

export const performanceLabService = new PerformanceLabService();
