export type DeploymentEnvironment = 'development' | 'staging' | 'production';
export type DeploymentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
export type PipelineStage = 
  | 'code_review'
  | 'automated_tests'
  | 'security_scan'
  | 'performance_validation'
  | 'staging_deploy'
  | 'approval'
  | 'production_deploy'
  | 'health_verification'
  | 'rollback';

export interface DeploymentPipeline {
  id: string;
  name: string;
  version: string;
  author: string;
  status: DeploymentStatus;
  stages: PipelineStageStatus[];
  started_at: string;
  completed_at?: string;
  environment: DeploymentEnvironment;
  commit_sha?: string;
  branch?: string;
}

export interface PipelineStageStatus {
  stage: PipelineStage;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  logs: string[];
  artifacts?: string[];
}

export interface DeploymentConfig {
  auto_deploy: boolean;
  require_approval: boolean;
  require_tests: boolean;
  require_security_scan: boolean;
  require_performance_validation: boolean;
  rollback_on_failure: boolean;
  health_check_timeout_ms: number;
  max_deployment_time_ms: number;
}

export interface RollbackPlan {
  deployment_id: string;
  previous_version: string;
  rollback_steps: string[];
  estimated_downtime_minutes: number;
  data_migration_required: boolean;
  approval_required: boolean;
}

export class DeploymentCenterService {
  private pipelines: Map<string, DeploymentPipeline> = new Map();
  private config: DeploymentConfig = {
    auto_deploy: false,
    require_approval: true,
    require_tests: true,
    require_security_scan: true,
    require_performance_validation: true,
    rollback_on_failure: true,
    health_check_timeout_ms: 300000,
    max_deployment_time_ms: 1800000,
  };

  async createPipeline(pipeline: Omit<DeploymentPipeline, 'id' | 'status' | 'stages' | 'started_at'>): Promise<DeploymentPipeline> {
    const stages: PipelineStageStatus[] = [
      { stage: 'code_review', status: 'pending', logs: [] },
      { stage: 'automated_tests', status: 'pending', logs: [] },
      { stage: 'security_scan', status: 'pending', logs: [] },
      { stage: 'performance_validation', status: 'pending', logs: [] },
      { stage: 'staging_deploy', status: 'pending', logs: [] },
      { stage: 'approval', status: 'pending', logs: [] },
      { stage: 'production_deploy', status: 'pending', logs: [] },
      { stage: 'health_verification', status: 'pending', logs: [] },
    ];

    const newPipeline: DeploymentPipeline = {
      ...pipeline,
      id: `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      stages,
      started_at: new Date().toISOString(),
    };

    this.pipelines.set(newPipeline.id, newPipeline);
    return newPipeline;
  }

  async executePipeline(pipelineId: string): Promise<DeploymentPipeline> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    pipeline.status = 'running';

    for (const stage of pipeline.stages) {
      stage.status = 'running';
      stage.started_at = new Date().toISOString();

      try {
        await this.executeStage(pipeline, stage);
        stage.status = 'completed';
        stage.completed_at = new Date().toISOString();
        stage.duration_ms = new Date(stage.completed_at).getTime() - new Date(stage.started_at).getTime();
      } catch (error) {
        stage.status = 'failed';
        stage.completed_at = new Date().toISOString();
        stage.logs.push(`Error: ${(error as Error).message}`);
        
        if (this.config.rollback_on_failure) {
          pipeline.status = 'failed';
          await this.rollback(pipelineId);
          break;
        }
      }
    }

    if (pipeline.status === 'running') {
      pipeline.status = 'completed';
      pipeline.completed_at = new Date().toISOString();
    }

    return pipeline;
  }

  private async executeStage(pipeline: DeploymentPipeline, stage: PipelineStageStatus): Promise<void> {
    // Simulate stage execution
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));

    switch (stage.stage) {
      case 'code_review':
        stage.logs.push('Code review passed');
        stage.logs.push('No blocking issues found');
        break;
      case 'automated_tests':
        stage.logs.push('Running unit tests...');
        stage.logs.push('Running integration tests...');
        stage.logs.push('All tests passed (245/245)');
        break;
      case 'security_scan':
        stage.logs.push('Scanning for vulnerabilities...');
        stage.logs.push('No critical vulnerabilities found');
        break;
      case 'performance_validation':
        stage.logs.push('Running performance benchmarks...');
        stage.logs.push('Response time: 145ms (within threshold)');
        break;
      case 'staging_deploy':
        stage.logs.push('Deploying to staging environment...');
        stage.logs.push('Deployment successful');
        break;
      case 'approval':
        stage.logs.push('Waiting for approval...');
        stage.logs.push('Approved by admin@winnmatt.com');
        break;
      case 'production_deploy':
        stage.logs.push('Deploying to production...');
        stage.logs.push('Deployment successful');
        break;
      case 'health_verification':
        stage.logs.push('Running health checks...');
        stage.logs.push('All systems operational');
        break;
    }
  }

  async rollback(pipelineId: string): Promise<boolean> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return false;

    pipeline.status = 'rolled_back';
    
    // Add rollback stage
    pipeline.stages.push({
      stage: 'rollback',
      status: 'completed',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      logs: ['Rolling back to previous version...', 'Rollback completed'],
    });

    return true;
  }

  async getPipeline(pipelineId: string): Promise<DeploymentPipeline | undefined> {
    return this.pipelines.get(pipelineId);
  }

  async getPipelines(limit: number = 20): Promise<DeploymentPipeline[]> {
    return Array.from(this.pipelines.values())
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, limit);
  }

  async getActivePipelines(): Promise<DeploymentPipeline[]> {
    return Array.from(this.pipelines.values())
      .filter(p => p.status === 'running' || p.status === 'pending');
  }

  async approvePipeline(pipelineId: string, approver: string): Promise<boolean> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return false;

    const approvalStage = pipeline.stages.find(s => s.stage === 'approval');
    if (approvalStage) {
      approvalStage.logs.push(`Approved by ${approver}`);
    }

    return true;
  }

  async generateRollbackPlan(pipelineId: string): Promise<RollbackPlan | null> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return null;

    return {
      deployment_id: pipelineId,
      previous_version: '1.0.0',
      rollback_steps: [
        'Stop current deployment',
        'Restore database backup',
        'Deploy previous version',
        'Verify health checks',
        'Notify stakeholders',
      ],
      estimated_downtime_minutes: 5,
      data_migration_required: false,
      approval_required: true,
    };
  }

  async getDeploymentMetrics(): Promise<Record<string, unknown>> {
    const pipelines = Array.from(this.pipelines.values());
    
    return {
      total_deployments: pipelines.length,
      successful: pipelines.filter(p => p.status === 'completed').length,
      failed: pipelines.filter(p => p.status === 'failed').length,
      rolled_back: pipelines.filter(p => p.status === 'rolled_back').length,
      average_duration_ms: pipelines.reduce((sum, p) => {
        if (p.completed_at) {
          return sum + (new Date(p.completed_at).getTime() - new Date(p.started_at).getTime());
        }
        return sum;
      }, 0) / pipelines.length || 0,
      success_rate: pipelines.length ? 
        (pipelines.filter(p => p.status === 'completed').length / pipelines.length) * 100 : 0,
    };
  }

  getConfig(): DeploymentConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<DeploymentConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

export const deploymentCenterService = new DeploymentCenterService();
