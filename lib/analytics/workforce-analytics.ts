import { supabaseAdmin } from '@/lib/supabase-server'

export interface WorkforceMetrics {
  totalWorkers: number;
  activeWorkers: number;
  averageTaskCompletionRate: number;
  averageEfficiencyScore: number;
  totalHoursWorked: number;
  laborCost: number;
}

export interface TaskEfficiency {
  workerId: string;
  workerName: string;
  role: string;
  tasksAssigned: number;
  tasksCompleted: number;
  completionRate: number;
  averageTimeMinutes: number;
  efficiencyScore: number;
}

export interface AttendancePattern {
  workerId: string;
  workerName: string;
  role: string;
  totalShifts: number;
  attendedShifts: number;
  attendanceRate: number;
  averageClockInTime: string;
  averageClockOutTime: string;
  totalHoursWorked: number;
}

export interface LaborCostAnalysis {
  period: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  totalCost: number;
  regularCost: number;
  overtimeCost: number;
  costPerHour: number;
}

export interface TaskDurationAnalysis {
  taskType: string;
  count: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  standardDeviation: number;
}

export class WorkforceAnalyticsService {
  async getWorkforceMetrics(startDate: string, endDate: string): Promise<WorkforceMetrics> {
    const { count: totalWorkers } = await supabaseAdmin
      .from('employee_profiles')
      .select('*', { count: 'exact', head: true });

    const { data: activeShifts } = await supabaseAdmin
      .from('worker_shifts')
      .select('worker_id')
      .gte('start_time', startDate)
      .lte('start_time', endDate);

    const uniqueActiveWorkers = new Set(activeShifts?.map(s => s.worker_id)).size;

    const { data: tasks } = await supabaseAdmin
      .from('tasks')
      .select('id, status, assigned_to, estimated_minutes, actual_minutes')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const completedTasks = tasks?.filter(t => t.status === 'completed') || [];
    const averageTaskCompletionRate = tasks?.length 
      ? (completedTasks.length / tasks.length) * 100 
      : 0;

    const efficiencyScores = completedTasks
      .filter(t => t.estimated_minutes && t.actual_minutes)
      .map(t => Math.min(100, (t.estimated_minutes! / t.actual_minutes!) * 100));
    
    const averageEfficiencyScore = efficiencyScores.length
      ? efficiencyScores.reduce((a, b) => a + b, 0) / efficiencyScores.length
      : 0;

    const { data: timeLogs } = await supabaseAdmin
      .from('worker_time_logs')
      .select('duration_minutes')
      .gte('start_time', startDate)
      .lte('start_time', endDate);

    const totalHoursWorked = (timeLogs?.reduce((sum, log) => sum + (log.duration_minutes || 0), 0) || 0) / 60;

    const averageHourlyRate = 200;
    const laborCost = totalHoursWorked * averageHourlyRate;

    return {
      totalWorkers: totalWorkers || 0,
      activeWorkers: uniqueActiveWorkers,
      averageTaskCompletionRate,
      averageEfficiencyScore,
      totalHoursWorked,
      laborCost,
    };
  }

  async getTaskEfficiency(startDate: string, endDate: string): Promise<TaskEfficiency[]> {
    const { data: workers } = await supabaseAdmin
      .from('employee_profiles')
      .select('id, staff_number, position, user:users!employee_profiles_user_id_fkey(full_name)');

    if (!workers) return [];

    const efficiencyData = await Promise.all(
      workers.map(async (worker: any) => {
        const { data: tasks } = await supabaseAdmin
          .from('tasks')
          .select('id, status, estimated_minutes, actual_minutes')
          .eq('assigned_to', worker.id)
          .gte('created_at', startDate)
          .lte('created_at', endDate);

        if (!tasks || tasks.length === 0) {
          return null;
        }

        const completedTasks = tasks.filter(t => t.status === 'completed');
        const completionRate = (completedTasks.length / tasks.length) * 100;

        const tasksWithTime = completedTasks.filter(t => t.actual_minutes);
        const averageTimeMinutes = tasksWithTime.length
          ? tasksWithTime.reduce((sum, t) => sum + (t.actual_minutes || 0), 0) / tasksWithTime.length
          : 0;

        const efficiencyScores = completedTasks
          .filter(t => t.estimated_minutes && t.actual_minutes)
          .map(t => Math.min(100, (t.estimated_minutes! / t.actual_minutes!) * 100));

        const efficiencyScore = efficiencyScores.length
          ? efficiencyScores.reduce((a, b) => a + b, 0) / efficiencyScores.length
          : 0;

        return {
          workerId: worker.id,
          workerName: worker.user?.full_name || worker.staff_number || 'Unknown',
          role: worker.position || 'Unknown',
          tasksAssigned: tasks.length,
          tasksCompleted: completedTasks.length,
          completionRate,
          averageTimeMinutes,
          efficiencyScore,
        };
      })
    );

    return efficiencyData
      .filter((data): data is TaskEfficiency => data !== null)
      .sort((a, b) => b.efficiencyScore - a.efficiencyScore);
  }

  async getAttendancePattern(startDate: string, endDate: string): Promise<AttendancePattern[]> {
    const { data: workers } = await supabaseAdmin
      .from('employee_profiles')
      .select('id, staff_number, position, user:users!employee_profiles_user_id_fkey(full_name)');

    if (!workers) return [];

    const attendanceData = await Promise.all(
      workers.map(async (worker: any) => {
        const { data: shifts } = await supabaseAdmin
          .from('worker_shifts')
          .select('id, start_time, end_time, status')
          .eq('worker_id', worker.id)
          .gte('start_time', startDate)
          .lte('start_time', endDate);

        if (!shifts || shifts.length === 0) {
          return null;
        }

        const attendedShifts = shifts.filter(s => s.status === 'completed');
        const attendanceRate = (attendedShifts.length / shifts.length) * 100;

        const clockInTimes = attendedShifts.map(s => new Date(s.start_time).getHours() * 60 + new Date(s.start_time).getMinutes());
        const clockOutTimes = attendedShifts
          .filter(s => s.end_time)
          .map(s => new Date(s.end_time!).getHours() * 60 + new Date(s.end_time!).getMinutes());

        const averageClockInMinutes = clockInTimes.length
          ? clockInTimes.reduce((a, b) => a + b, 0) / clockInTimes.length
          : 0;
        const averageClockOutMinutes = clockOutTimes.length
          ? clockOutTimes.reduce((a, b) => a + b, 0) / clockOutTimes.length
          : 0;

        const formatTime = (minutes: number) => {
          const hours = Math.floor(minutes / 60);
          const mins = Math.round(minutes % 60);
          return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        };

        const totalMinutes = attendedShifts.reduce((sum, shift) => {
          if (shift.end_time) {
            const duration = (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / (1000 * 60);
            return sum + duration;
          }
          return sum;
        }, 0);

        return {
          workerId: worker.id,
          workerName: worker.user?.full_name || worker.staff_number || 'Unknown',
          role: worker.position || 'Unknown',
          totalShifts: shifts.length,
          attendedShifts: attendedShifts.length,
          attendanceRate,
          averageClockInTime: formatTime(averageClockInMinutes),
          averageClockOutTime: formatTime(averageClockOutMinutes),
          totalHoursWorked: totalMinutes / 60,
        };
      })
    );

    return attendanceData
      .filter((data): data is AttendancePattern => data !== null)
      .sort((a, b) => b.attendanceRate - a.attendanceRate);
  }

  async getLaborCostAnalysis(startDate: string, endDate: string): Promise<LaborCostAnalysis[]> {
    const { data: timeLogs } = await supabaseAdmin
      .from('worker_time_logs')
      .select('duration_minutes, start_time')
      .gte('start_time', startDate)
      .lte('start_time', endDate);

    if (!timeLogs) return [];

    const weeklyData = new Map<string, { totalMinutes: number; regularMinutes: number; overtimeMinutes: number }>();

    timeLogs.forEach((log) => {
      const weekStart = new Date(log.start_time);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];

      const existing = weeklyData.get(weekKey) || { totalMinutes: 0, regularMinutes: 0, overtimeMinutes: 0 };
      const duration = log.duration_minutes || 0;
      
      existing.totalMinutes += duration;
      
      const regularMinutes = Math.min(duration, 480);
      const overtimeMinutes = Math.max(0, duration - 480);
      
      existing.regularMinutes += regularMinutes;
      existing.overtimeMinutes += overtimeMinutes;
      
      weeklyData.set(weekKey, existing);
    });

    const hourlyRate = 200;
    const overtimeRate = hourlyRate * 1.5;

    return Array.from(weeklyData.entries()).map(([week, data]) => ({
      period: week,
      totalHours: data.totalMinutes / 60,
      regularHours: data.regularMinutes / 60,
      overtimeHours: data.overtimeMinutes / 60,
      totalCost: (data.regularMinutes / 60) * hourlyRate + (data.overtimeMinutes / 60) * overtimeRate,
      regularCost: (data.regularMinutes / 60) * hourlyRate,
      overtimeCost: (data.overtimeMinutes / 60) * overtimeRate,
      costPerHour: data.totalMinutes > 0 
        ? ((data.regularMinutes / 60) * hourlyRate + (data.overtimeMinutes / 60) * overtimeRate) / (data.totalMinutes / 60)
        : 0,
    })).sort((a, b) => a.period.localeCompare(b.period));
  }

  async getTaskDurationAnalysis(): Promise<TaskDurationAnalysis[]> {
    const { data: tasks } = await supabaseAdmin
      .from('tasks')
      .select(`
        actual_minutes,
        task_categories (
          name
        )
      `)
      .eq('status', 'completed')
      .not('actual_minutes', 'is', null);

    if (!tasks) return [];

    const categoryMap = new Map<string, number[]>();

    tasks.forEach((task) => {
      const category = (task.task_categories as any)?.name || 'Unknown';
      const existing = categoryMap.get(category) || [];
      existing.push(task.actual_minutes || 0);
      categoryMap.set(category, existing);
    });

    return Array.from(categoryMap.entries()).map(([category, durations]) => {
      const count = durations.length;
      const averageDuration = durations.reduce((a, b) => a + b, 0) / count;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);
      
      const squaredDiffs = durations.map(d => Math.pow(d - averageDuration, 2));
      const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / count;
      const standardDeviation = Math.sqrt(avgSquaredDiff);

      return {
        taskType: category,
        count,
        averageDuration,
        minDuration,
        maxDuration,
        standardDeviation,
      };
    }).sort((a, b) => b.count - a.count);
  }

  async getWorkerPerformanceRanking(startDate: string, endDate: string): Promise<any[]> {
    const efficiency = await this.getTaskEfficiency(startDate, endDate);
    
    return efficiency.map((worker, index) => ({
      rank: index + 1,
      ...worker,
      performanceGrade: this.getPerformanceGrade(worker.efficiencyScore),
    }));
  }

  private getPerformanceGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}

export const workforceAnalyticsService = new WorkforceAnalyticsService();
