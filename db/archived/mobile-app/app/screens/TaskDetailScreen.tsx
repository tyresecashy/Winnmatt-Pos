// @ts-nocheck — archived mobile app, not part of active build
import React, { useState, useEffect, useCallback, startTransition } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface TaskDetail {
  id: string;
  title: string;
  description: string;
  category_name: string;
  status: string;
  priority: string;
  due_date: string;
  assigned_to: string;
  checklist: ChecklistItem[];
  time_spent_minutes: number;
  created_at: string;
}

export default function TaskDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { taskId } = route.params as { taskId: string };

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchTaskDetails = useCallback(async () => {
    try {
      // Mock task details
      const mockTask: TaskDetail = {
        id: taskId,
        title: 'Restock Aisle 1 - Beverages',
        description: 'Restock all beverage shelves with new inventory. Check for expired products and remove them. Ensure proper facing and signage.',
        category_name: 'Shelf Maintenance',
        status: 'in_progress',
        priority: 'high',
        due_date: new Date().toISOString(),
        assigned_to: 'current_user',
        checklist: [
          { id: '1', text: 'Check inventory levels on shelves', completed: true },
          { id: '2', text: 'Remove expired products', completed: true },
          { id: '3', text: 'Stock new inventory from warehouse', completed: false },
          { id: '4', text: 'Face-up all products', completed: false },
          { id: '5', text: 'Update shelf labels if needed', completed: false },
        ],
        time_spent_minutes: 25,
        created_at: new Date().toISOString(),
      };
      setTask(mockTask);
    } catch (error) {
      console.error('Error fetching task details:', error);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    startTransition(() => {
      fetchTaskDetails();
    });
  }, [taskId, fetchTaskDetails]);

  const toggleChecklistItem = (itemId: string) => {
    if (!task) return;

    setTask({
      ...task,
      checklist: task.checklist.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      ),
    });
  };

  const updateTaskStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      // In production, this would call the API
      await new Promise((resolve) => setTimeout(resolve, 500));
      setTask((prev) => (prev ? { ...prev, status: newStatus } : null));
      Alert.alert('Success', `Task marked as ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update task status');
    } finally {
      setUpdating(false);
    }
  };

  const startTimer = () => {
    // In production, this would start a timer
    Alert.alert('Timer Started', 'Time tracking has started');
  };

  if (loading || !task) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const completedCount = task.checklist.filter((item) => item.completed).length;
  const progress = (completedCount / task.checklist.length) * 100;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) }]}>
            <Text style={styles.priorityText}>{task.priority.toUpperCase()}</Text>
          </View>
          <Text style={styles.category}>{task.category_name}</Text>
        </View>
        <Text style={styles.title}>{task.title}</Text>
      </View>

      {/* Progress */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Checklist Progress</Text>
          <Text style={styles.progressCount}>
            {completedCount}/{task.checklist.length}
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressPercent}>{Math.round(progress)}% complete</Text>
      </View>

      {/* Checklist */}
      <View style={styles.checklistSection}>
        <Text style={styles.sectionTitle}>Checklist</Text>
        {task.checklist.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.checklistItem}
            onPress={() => toggleChecklistItem(item.id)}
          >
            <View
              style={[
                styles.checkbox,
                item.completed && styles.checkboxCompleted,
              ]}
            >
              {item.completed && (
                <Ionicons name="checkmark" size={16} color="#ffffff" />
              )}
            </View>
            <Text
              style={[
                styles.checklistText,
                item.completed && styles.checklistTextCompleted,
              ]}
            >
              {item.text}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Description */}
      <View style={styles.descriptionSection}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{task.description}</Text>
      </View>

      {/* Time Tracking */}
      <View style={styles.timeSection}>
        <Text style={styles.sectionTitle}>Time Tracking</Text>
        <View style={styles.timeDisplay}>
          <Ionicons name="time-outline" size={24} color="#3b82f6" />
          <Text style={styles.timeText}>
            {Math.floor(task.time_spent_minutes / 60)}h {task.time_spent_minutes % 60}m
          </Text>
        </View>
        <TouchableOpacity style={styles.timerButton} onPress={startTimer}>
          <Ionicons name="play-circle" size={20} color="#ffffff" />
          <Text style={styles.timerButtonText}>Start Timer</Text>
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        {task.status === 'pending' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.startButton]}
            onPress={() => updateTaskStatus('in_progress')}
            disabled={updating}
          >
            <Ionicons name="play" size={20} color="#ffffff" />
            <Text style={styles.actionButtonText}>Start Task</Text>
          </TouchableOpacity>
        )}

        {task.status === 'in_progress' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => updateTaskStatus('completed')}
            disabled={updating}
          >
            <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
            <Text style={styles.actionButtonText}>Complete Task</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.photoButton]}
          onPress={() => navigation.navigate('PhotoCapture', { taskId: task.id })}
        >
          <Ionicons name="camera" size={20} color="#ffffff" />
          <Text style={styles.actionButtonText}>Take Photo</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: '#6b7280',
    medium: '#f59e0b',
    high: '#ef4444',
    urgent: '#dc2626',
  };
  return colors[priority] || '#6b7280';
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
  header: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  category: {
    fontSize: 14,
    color: '#6b7280',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  progressSection: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginTop: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  progressCount: {
    fontSize: 16,
    color: '#6b7280',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  checklistSection: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxCompleted: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checklistText: {
    fontSize: 16,
    color: '#1f2937',
    flex: 1,
  },
  checklistTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  descriptionSection: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginTop: 12,
  },
  description: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
  },
  timeSection: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginTop: 12,
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  timeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  timerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  timerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  actionsSection: {
    padding: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  startButton: {
    backgroundColor: '#3b82f6',
  },
  completeButton: {
    backgroundColor: '#10b981',
  },
  photoButton: {
    backgroundColor: '#8b5cf6',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
