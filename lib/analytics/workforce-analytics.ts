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
    // All 4 queries are independent — run in parallel
    const [
      { count: totalWorkers },
      { data: activeShifts },
      { data: tasks },
      { data: timeLogs },
    ] = await Promise.all([
      supabaseAdmin.from('employee_profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('worker_shifts').select('employee_id').gte('start_time', startDate).lte('start_time', endDate),
      supabaseAdmin.from('tasks').select('id, status, assigned_to, estimated_minutes, actual_minutes').gte('created_at', startDate).lte('created_at', endDate),
      supabaseAdmin.from('task_time_logs').select('duration_minutes').gte('timestamp', startDate).lte('timestamp', endDate),
    ]);

    const activeShiftsRows = (activeShifts || []) as unknown as Array<Record<string, unknown>>;
    const tasksRows = (tasks || []) as unknown as Array<Record<string, unknown>>;
    const timeLogsRows = (timeLogs || []) as unknown as Array<Record<string, unknown>>;

    const uniqueActiveWorkers = new Set(activeShiftsRows.map(s => s.employee_id)).size;

    const completedTasks = tasksRows.filter(t => t.status === 'completed');
    const averageTaskCompletionRate = tasksRows.length
      ? (completedTasks.length / tasksRows.length) * 100
      : 0;

    const efficiencyScores = completedTasks
      .filter(t => t.estimated_minutes && t.actual_minutes)
      .map(t => Math.min(100, ((t.estimated_minutes as number) / (t.actual_minutes as number)) * 100));
    
    const averageEfficiencyScore = efficiencyScores.length
      ? efficiencyScores.reduce((a, b) => a + b, 0) / efficiencyScores.length
      : 0;

    const totalHoursWorked = (timeLogsRows.reduce((sum, log) => sum + ((log.duration_minutes as number) || 0), 0) || 0) / 60;

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

    const workersRows = workers as unknown as Array<Record<string, unknown>>;

    const efficiencyData = await Promise.all(
      workersRows.map(async (worker) => {
        const { data: tasks } = await supabaseAdmin
          .from('tasks')
          .select('id, status, estimated_minutes, actual_minutes')
          .eq('assigned_to', worker.id as string)
          .gte('created_at', startDate)
          .lte('created_at', endDate);

        if (!tasks || tasks.length === 0) {
          return null;
        }

        const tasksRows = tasks as unknown as Array<Record<string, unknown>>;
        const completedTasks = tasksRows.filter(t => t.status === 'completed');
        const completionRate = (completedTasks.length / tasksRows.length) * 100;

        const tasksWithTime = completedTasks.filter(t => t.actual_minutes);
        const averageTimeMinutes = tasksWithTime.length
          ? tasksWithTime.reduce((sum, t) => sum + ((t.actual_minutes as number) || 0), 0) / tasksWithTime.length
          : 0;

        const efficiencyScores = completedTasks
          .filter(t => t.estimated_minutes && t.actual_minutes)
          .map(t => Math.min(100, ((t.estimated_minutes as number) / (t.actual_minutes as number)) * 100));

        const efficiencyScore = efficiencyScores.length
          ? efficiencyScores.reduce((a, b) => a + b, 0) / efficiencyScores.length
          : 0;

        const user = worker.user as Record<string, unknown> | null;
        return {
          workerId: worker.id as string,
          workerName: (user?.full_name as string) || (worker.staff_number as string) || 'Unknown',
          role: (worker.position as string) || 'Unknown',
          tasksAssigned: tasksRows.length,
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

    const workersRows = workers as unknown as Array<Record<string, unknown>>;

    const attendanceData = await Promise.all(
      workersRows.map(async (worker) => {
        const { data: shifts } = await supabaseAdmin
          .from('worker_shifts')
          .select('id, start_time, end_time, status')
          .eq('employee_id', worker.id as string)
          .gte('shift_date', startDate)
          .lte('shift_date', endDate);

        if (!shifts || shifts.length === 0) {
          return null;
        }

        const shiftsRows = shifts as unknown as Array<Record<string, unknown>>;
        const attendedShifts = shiftsRows.filter(s => s.status === 'completed');
        const attendanceRate = (attendedShifts.length / shiftsRows.length) * 100;

        const clockInTimes = attendedShifts.map(s => {
          const d = new Date(s.start_time as string);
          return d.getHours() * 60 + d.getMinutes();
        });
        const clockOutTimes = attendedShifts
          .filter(s => s.end_time)
          .map(s => {
            const d = new Date(s.end_time as string);
            return d.getHours() * 60 + d.getMinutes();
          });

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
            const duration = (new Date(shift.end_time as string).getTime() - new Date(shift.start_time as string).getTime()) / (1000 * 60);
            return sum + duration;
          }
          return sum;
        }, 0);

        const user = worker.user as Record<string, unknown> | null;
        return {
          workerId: worker.id as string,
          workerName: (user?.full_name as string) || (worker.staff_number as string) || 'Unknown',
          role: (worker.position as string) || 'Unknown',
          totalShifts: shiftsRows.length,
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
      .from('task_time_logs')
      .select('duration_minutes, timestamp')
      .gte('timestamp', startDate)
      .lte('timestamp', endDate);

    if (!timeLogs) return [];

    const timeLogsRows = timeLogs as unknown as Array<Record<string, unknown>>;
    const weeklyData = new Map<string, { totalMinutes: number; regularMinutes: number; overtimeMinutes: number }>();

    timeLogsRows.forEach((log) => {
      const weekStart = new Date(log.timestamp as string);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];

      const existing = weeklyData.get(weekKey) || { totalMinutes: 0, regularMinutes: 0, overtimeMinutes: 0 };
      const duration = (log.duration_minutes as number) || 0;
      
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

    const tasksRows = tasks as unknown as Array<Record<string, unknown>>;
    const categoryMap = new Map<string, number[]>();

    tasksRows.forEach((task) => {
      const taskCat = task.task_categories as Record<string, unknown> | null;
      const category = (taskCat?.name as string) || 'Unknown';
      const existing = categoryMap.get(category) || [];
      existing.push((task.actual_minutes as number) || 0);
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

  async getWorkerPerformanceRanking(startDate: string, endDate: string): Promise<Record<string, unknown>[]> {
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
