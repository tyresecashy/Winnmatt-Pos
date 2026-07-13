// @ts-nocheck — archived mobile app, not part of active build
import React, { useState, useEffect, startTransition } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

interface Task {
  id: string;
  title: string;
  category_name: string;
  status: string;
  priority: string;
  due_date: string;
  assigned_to: string;
  checklist_progress?: number;
  checklist_total?: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  in_progress: '#3b82f6',
  completed: '#10b981',
  overdue: '#ef4444',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6b7280',
  medium: '#f59e0b',
  high: '#ef4444',
  urgent: '#dc2626',
};

export default function TaskDashboardScreen() {
  const navigation = useNavigation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const fetchTasks = async () => {
    try {
      // In production, this would call the API
      // For now, using mock data
      const mockTasks: Task[] = [
        {
          id: '1',
          title: 'Restock Aisle 1 - Beverages',
          category_name: 'Shelf Maintenance',
          status: 'pending',
          priority: 'high',
          due_date: new Date().toISOString(),
          assigned_to: 'current_user',
          checklist_progress: 2,
          checklist_total: 5,
        },
        {
          id: '2',
          title: 'Morning Mop - Front Section',
          category_name: 'Floor Cleaning',
          status: 'in_progress',
          priority: 'medium',
          due_date: new Date().toISOString(),
          assigned_to: 'current_user',
          checklist_progress: 1,
          checklist_total: 3,
        },
        {
          id: '3',
          title: 'Daily Expiry Check - Dairy',
          category_name: 'Expired Stock Check',
          status: 'pending',
          priority: 'high',
          due_date: new Date().toISOString(),
          assigned_to: 'current_user',
        },
        {
          id: '4',
          title: 'Receive Morning Delivery',
          category_name: 'Stock Receiving',
          status: 'completed',
          priority: 'urgent',
          due_date: new Date().toISOString(),
          assigned_to: 'current_user',
          checklist_progress: 4,
          checklist_total: 4,
        },
        {
          id: '5',
          title: 'Deep Clean Restrooms',
          category_name: 'Bathroom Cleaning',
          status: 'pending',
          priority: 'medium',
          due_date: new Date().toISOString(),
          assigned_to: 'current_user',
        },
      ];
      setTasks(mockTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    startTransition(() => { fetchTasks(); });
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const renderTaskCard = ({ item }: { item: Task }) => (
    <TouchableOpacity
      style={styles.taskCard}
      onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
    >
      <View style={styles.taskHeader}>
        <View style={styles.taskTitleRow}>
          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: PRIORITY_COLORS[item.priority] },
            ]}
          >
            <Text style={styles.priorityText}>{item.priority.toUpperCase()}</Text>
          </View>
          <Text style={styles.taskCategory}>{item.category_name}</Text>
        </View>
        <Text style={styles.taskTitle}>{item.title}</Text>
      </View>

      <View style={styles.taskFooter}>
        <View style={styles.taskMeta}>
          <Ionicons name="time-outline" size={14} color="#6b7280" />
          <Text style={styles.taskMetaText}>
            {new Date(item.due_date).toLocaleDateString()}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            { backgroundColor: STATUS_COLORS[item.status] },
          ]}
        >
          <Text style={styles.statusText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
        </View>
      </View>

      {item.checklist_progress !== undefined && item.checklist_total !== undefined && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${(item.checklist_progress / item.checklist_total) * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {item.checklist_progress}/{item.checklist_total} completed
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const stats = {
    pending: tasks.filter((t) => t.status === 'pending').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading tasks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Summary */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
          <Text style={styles.statNumber}>{stats.in_progress}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#d1fae5' }]}>
          <Text style={styles.statNumber}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {['all', 'pending', 'in_progress', 'completed'].map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterTab, filter === status && styles.filterTabActive]}
            onPress={() => setFilter(status)}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === status && styles.filterTabTextActive,
              ]}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Task List */}
      <FlatList
        data={filteredTasks}
        renderItem={renderTaskCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.taskList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No tasks found</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'all'
                ? 'You have no tasks assigned'
                : `No ${filter.replace('_', ' ')} tasks`}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
  },
  filterTabActive: {
    backgroundColor: '#3b82f6',
  },
  filterTabText: {
    fontSize: 14,
    color: '#4b5563',
    textTransform: 'capitalize',
  },
  filterTabTextActive: {
    color: '#ffffff',
  },
  taskList: {
    padding: 16,
  },
  taskCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  taskHeader: {
    marginBottom: 12,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  taskCategory: {
    fontSize: 12,
    color: '#6b7280',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskMetaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  progressContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
});
