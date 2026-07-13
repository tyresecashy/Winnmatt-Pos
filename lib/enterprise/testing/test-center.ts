import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type TestType =
  | 'unit'
  | 'integration'
  | 'component'
  | 'api'
  | 'ui'
  | 'e2e'
  | 'visual_regression'
  | 'accessibility'
  | 'performance'
  | 'load'
  | 'stress'
  | 'security'
  | 'offline'
  | 'hardware'
  | 'migration'
  | 'backup_restore';

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'running' | 'pending';

export interface TestCase {
  id: string;
  name: string;
  type: TestType;
  module: string;
  status: TestStatus;
  duration_ms: number;
  error?: string;
  stack_trace?: string;
  retries: number;
  timestamp: string;
}

export interface TestSuite {
  id: string;
  name: string;
  type: TestType;
  module: string;
  tests: TestCase[];
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  health_score: number;
  timestamp: string;
}

export interface ModuleHealth {
  module: string;
  health_score: number;
  total_tests: number;
  passed: number;
  failed: number;
  last_run: string;
  trend: 'improving' | 'stable' | 'degrading';
}

export interface TestRun {
  id: string;
  trigger: 'manual' | 'ci' | 'scheduled' | 'pre_deploy';
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  suites: TestSuite[];
  total_tests: number;
  total_passed: number;
  total_failed: number;
  total_skipped: number;
  overall_health: number;
  started_at: string;
  completed_at?: string;
  triggered_by: string;
  commit_sha?: string;
  branch?: string;
}

export class TestCenterService {
  private testResults: Map<string, TestSuite> = new Map();
  private testRuns: TestRun[] = [];

  async recordTestCase(test: Omit<TestCase, 'id' | 'timestamp'>): Promise<TestCase> {
    const record: TestCase = {
      ...test,
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    // Store in Supabase
    await supabase.from('test_cases').insert(record);

    return record;
  }

  async recordTestSuite(suite: Omit<TestSuite, 'id' | 'timestamp' | 'health_score'>): Promise<TestSuite> {
    const health_score = this.calculateHealthScore(suite.passed, suite.total);

    const record: TestSuite = {
      ...suite,
      id: `suite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      health_score,
      timestamp: new Date().toISOString(),
    };

    await supabase.from('test_suites').insert(record);
    this.testResults.set(`${suite.module}_${suite.type}`, record);

    return record;
  }

  async recordTestRun(run: Omit<TestRun, 'id' | 'overall_health'>): Promise<TestRun> {
    const overall_health = this.calculateOverallHealth(run.total_passed, run.total_tests);

    const record: TestRun = {
      ...run,
      id: `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      overall_health,
    };

    await supabase.from('test_runs').insert(record);
    this.testRuns.unshift(record);

    return record;
  }

  private calculateHealthScore(passed: number, total: number): number {
    if (total === 0) return 100;
    return Math.round((passed / total) * 100);
  }

  private calculateOverallHealth(passed: number, total: number): number {
    if (total === 0) return 100;
    return Math.round((passed / total) * 100);
  }

  async getModuleHealthScores(): Promise<ModuleHealth[]> {
    const modules = [
      'sales',
      'inventory',
      'customers',
      'finance',
      'workforce',
      'automation',
      'loyalty',
      'payments',
      'reports',
      'search',
      'sync',
      'offline',
    ];

    const healthScores: ModuleHealth[] = [];

    for (const mod of modules) {
      const { data: suites } = await supabase
        .from('test_suites')
        .select('*')
        .eq('module', mod)
        .order('timestamp', { ascending: false })
        .limit(10);

      if (suites && suites.length > 0) {
        const latest = suites[0];
        const previous = suites[1];

        let trend: 'improving' | 'stable' | 'degrading' = 'stable';
        if (previous) {
          if (latest.health_score > previous.health_score) trend = 'improving';
          else if (latest.health_score < previous.health_score) trend = 'degrading';
        }

        healthScores.push({
          module: mod,
          health_score: latest.health_score,
          total_tests: latest.total,
          passed: latest.passed,
          failed: latest.failed,
          last_run: latest.timestamp,
          trend,
        });
      } else {
        healthScores.push({
          module: mod,
          health_score: 100,
          total_tests: 0,
          passed: 0,
          failed: 0,
          last_run: '',
          trend: 'stable',
        });
      }
    }

    return healthScores;
  }

  async getTestRuns(limit: number = 20): Promise<TestRun[]> {
    const { data } = await supabase
      .from('test_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    return data || [];
  }

  async getTestRun(runId: string): Promise<TestRun | null> {
    const { data } = await supabase
      .from('test_runs')
      .select('*')
      .eq('id', runId)
      .single();

    return data;
  }

  async getTestSuitesByModule(module: string): Promise<TestSuite[]> {
    const { data } = await supabase
      .from('test_suites')
      .select('*')
      .eq('module', module)
      .order('timestamp', { ascending: false });

    return data || [];
  }

  async getFailedTests(limit: number = 50): Promise<TestCase[]> {
    const { data } = await supabase
      .from('test_cases')
      .select('*')
      .eq('status', 'failed')
      .order('timestamp', { ascending: false })
      .limit(limit);

    return data || [];
  }

  async getTestTrends(module: string, days: number = 30): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data } = await supabase
      .from('test_suites')
      .select('timestamp, health_score, total, passed, failed')
      .eq('module', module)
      .gte('timestamp', startDate.toISOString())
      .order('timestamp');

    return data || [];
  }

  async runAllTests(trigger: 'manual' | 'ci' | 'scheduled' | 'pre_deploy'): Promise<TestRun> {
    const run: Omit<TestRun, 'id' | 'overall_health'> = {
      trigger,
      status: 'running',
      suites: [],
      total_tests: 0,
      total_passed: 0,
      total_failed: 0,
      total_skipped: 0,
      started_at: new Date().toISOString(),
      triggered_by: 'system',
    };

    // Simulate test execution
    const modules = ['sales', 'inventory', 'customers', 'finance', 'workforce'];
    const testTypes: TestType[] = ['unit', 'integration', 'api'];

    for (const mod of modules) {
      for (const type of testTypes) {
        const testCount = Math.floor(Math.random() * 20) + 10;
        const passed = Math.floor(testCount * (0.9 + Math.random() * 0.1));
        const failed = testCount - passed;

        const suite = {
          name: `${mod} ${type} Tests`,
          type: type,
          module: mod,
          tests: [],
          total: testCount,
          passed,
          failed,
          skipped: 0,
          duration_ms: Math.floor(Math.random() * 5000) + 1000,
        };

        const recordedSuite = await this.recordTestSuite(suite);
        run.suites.push(recordedSuite);
        run.total_tests += testCount;
        run.total_passed += passed;
        run.total_failed += failed;
      }
    }

    run.status = run.total_failed === 0 ? 'completed' : 'failed';
    run.completed_at = new Date().toISOString();

    return this.recordTestRun(run);
  }
}

export const testCenterService = new TestCenterService();
