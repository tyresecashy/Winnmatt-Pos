'use client';

import { logger } from '@/lib/logger';
import { useState, useEffect, startTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Server,
  Shield,
  Users,
  ShoppingCart,
  Package,
  Bell,
  RefreshCw,
  Wifi,
  WifiOff,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { healthCenterService } from '@/lib/enterprise/health/health-center';
import { securityCenterService } from '@/lib/enterprise/security/security-center';
import { incidentCenterService } from '@/lib/enterprise/incidents/incident-center';
import { performanceLabService } from '@/lib/enterprise/performance/performance-lab';
import { observabilityService } from '@/lib/enterprise/observability/observability-service';

interface SubsystemHealth {
  name: string;
  status: string;
  score: number;
  uptime_percentage?: number;
}

interface SecurityThreat {
  active_threats: number;
  overall_threat_level: string;
  blocked_ips: number;
  failed_logins_24h: number;
  suspicious_activities: number;
  vulnerability_count: number;
  last_scan: string;
}

interface ActiveIncident {
  id: string;
  title: string;
  description: string;
  severity: string;
  owner: string;
  status: string;
  created_at: string;
}

interface PerformanceMetric {
  name: string;
  status: string;
  value: number;
  unit: string;
  baseline: number;
  deviation_percent: number;
}

interface ObservabilitySummary {
  active_users: number;
  active_sessions: number;
  total_requests: number;
  error_rate: number;
  average_response_time: number;
  p95_response_time: number;
}

interface CommandCenterData {
  systemHealth: {
    overall_status: string;
    overall_score: number;
    subsystems: SubsystemHealth[];
    uptime_24h: number;
  } | null;
  securityThreat: SecurityThreat | null;
  activeIncidents: ActiveIncident[];
  performanceMetrics: PerformanceMetric[] | null;
  observabilitySummary: ObservabilitySummary | null;
}

export default function OperationalCommandCenter() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CommandCenterData>({
    systemHealth: null,
    securityThreat: null,
    activeIncidents: [],
    performanceMetrics: null,
    observabilitySummary: null,
  });
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const loadCommandCenterData = async () => {
    try {
      const [systemHealth, securityThreat, activeIncidents, performanceMetrics, observabilitySummary] = 
        await Promise.all([
          healthCenterService.getHealthSummary(),
          securityCenterService.getThreatAnalysis(),
          incidentCenterService.getOpenIncidents(),
          performanceLabService.runAllBenchmarks(),
          observabilityService.getSummary(),
        ]);

      setData({
        systemHealth: systemHealth as unknown as CommandCenterData['systemHealth'],
        securityThreat,
        activeIncidents,
        performanceMetrics,
        observabilitySummary,
      });
      setLastRefresh(new Date());
    } catch (error) {
      logger.error('Error loading command center data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startTransition(() => { loadCommandCenterData() });
    const interval = setInterval(loadCommandCenterData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string | undefined) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return 'bg-green-100 text-green-800';
      case 'degraded':
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'unhealthy':
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getThreatColor = (level: string | undefined) => {
    switch (level) {
      case 'none':
        return 'bg-green-100 text-green-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading Command Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Operational Command Center</h1>
          <p className="text-muted-foreground">
            Mission control for WINNMATT platform - Real-time system status
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </div>
          <Button variant="outline" onClick={loadCommandCenterData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Status Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className={`border-2 ${data.systemHealth?.overall_status === 'healthy' ? 'border-green-500' : data.systemHealth?.overall_status === 'degraded' ? 'border-yellow-500' : 'border-red-500'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            {getStatusIcon(data.systemHealth?.overall_status)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.systemHealth?.overall_score || 0}%</div>
            <Badge className={getStatusColor(data.systemHealth?.overall_status)}>
              {data.systemHealth?.overall_status?.toUpperCase()}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Threat</CardTitle>
            <Shield className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.securityThreat?.active_threats || 0}</div>
            <Badge className={getThreatColor(data.securityThreat?.overall_threat_level)}>
              {data.securityThreat?.overall_threat_level?.toUpperCase() || 'NONE'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.activeIncidents?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {data.activeIncidents?.filter((i) => i.severity === 'critical').length || 0} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.observabilitySummary?.active_users || 0}</div>
            <p className="text-xs text-muted-foreground">
              {data.observabilitySummary?.active_sessions || 0} sessions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* System Health Grid */}
          <Card>
            <CardHeader>
              <CardTitle>Subsystem Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {data.systemHealth?.subsystems?.map((subsystem) => (
                  <div key={subsystem.name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(subsystem.status)}
                      <div>
                        <div className="font-medium">{subsystem.name}</div>
                        <div className="text-sm text-muted-foreground">Score: {subsystem.score}%</div>
                      </div>
                    </div>
                    <Badge className={getStatusColor(subsystem.status)}>
                      {subsystem.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">API Requests</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.observabilitySummary?.total_requests?.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Last 24 hours</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.observabilitySummary?.error_rate?.toFixed(2)}%</div>
                <p className="text-xs text-muted-foreground">Target: {'<'} 1%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.observabilitySummary?.average_response_time}ms</div>
                <p className="text-xs text-muted-foreground">P95: {data.observabilitySummary?.p95_response_time}ms</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.systemHealth?.uptime_24h?.toFixed(2)}%</div>
                <p className="text-xs text-muted-foreground">Last 24 hours</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Health Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.systemHealth?.subsystems?.map((subsystem) => (
                  <div key={subsystem.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(subsystem.status)}
                      <div>
                        <div className="font-medium">{subsystem.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Uptime: {subsystem.uptime_percentage?.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(subsystem.status)}>
                        {subsystem.status}
                      </Badge>
                      <div className="text-sm text-muted-foreground mt-1">
                        Score: {subsystem.score}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Threat Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Overall Threat Level</span>
                  <Badge className={getThreatColor(data.securityThreat?.overall_threat_level)}>
                    {data.securityThreat?.overall_threat_level?.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Active Threats</span>
                  <span className="font-medium">{data.securityThreat?.active_threats}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Blocked IPs</span>
                  <span className="font-medium">{data.securityThreat?.blocked_ips}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Failed Logins (24h)</span>
                  <span className="font-medium">{data.securityThreat?.failed_logins_24h}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Suspicious Activities</span>
                  <span className="font-medium">{data.securityThreat?.suspicious_activities}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Vulnerabilities</span>
                  <span className="font-medium">{data.securityThreat?.vulnerability_count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last Security Scan</span>
                  <span className="font-medium">
                    {data.securityThreat?.last_scan ? new Date(data.securityThreat.last_scan).toLocaleString() : 'Never'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Benchmarks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {data.performanceMetrics?.map((metric) => (
                  <div key={metric.name} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{metric.name}</span>
                      <Badge className={metric.status === 'pass' ? 'bg-green-100 text-green-800' : metric.status === 'warning' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                        {metric.status}
                      </Badge>
                    </div>
                    <div className="text-2xl font-bold">{metric.value}{metric.unit}</div>
                    <div className="text-sm text-muted-foreground">
                      Baseline: {metric.baseline}{metric.unit}
                    </div>
                    <div className={`text-sm ${metric.deviation_percent > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {metric.deviation_percent > 0 ? '+' : ''}{metric.deviation_percent.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Incidents</CardTitle>
            </CardHeader>
            <CardContent>
              {data.activeIncidents?.length === 0 ? (
                <EmptyState icon={CheckCircle} title="No Active Incidents" description="All systems operating normally" />
              ) : (
                <div className="space-y-4">
                  {data.activeIncidents?.map((incident) => (
                    <div key={incident.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{incident.title}</span>
                        <Badge className={getStatusColor(incident.severity)}>
                          {incident.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{incident.description}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span>Owner: {incident.owner}</span>
                        <span>Status: {incident.status}</span>
                        <span>Created: {new Date(incident.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
