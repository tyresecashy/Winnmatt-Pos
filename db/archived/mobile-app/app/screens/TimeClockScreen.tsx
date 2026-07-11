import React, { useState, useEffect, startTransition } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Shift {
  id: string;
  start_time: string;
  end_time: string | null;
  break_start: string | null;
  break_end: string | null;
  total_hours: number;
  break_minutes: number;
}

interface TimeClockState {
  isClockedIn: boolean;
  isOnBreak: boolean;
  currentShift: Shift | null;
  elapsedSeconds: number;
}

export default function TimeClockScreen() {
  const [state, setState] = useState<TimeClockState>({
    isClockedIn: false,
    isOnBreak: false,
    currentShift: null,
    elapsedSeconds: 0,
  });
  const [loading, setLoading] = useState(true);

  const checkCurrentStatus = async () => {
    try {
      // In production, this would check the API
      // For now, starting with clocked out state
      setState({
        isClockedIn: false,
        isOnBreak: false,
        currentShift: null,
        elapsedSeconds: 0,
      });
    } catch (error) {
      console.error('Error checking status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startTransition(() => {
      // Check current status
      checkCurrentStatus();
    });

    // Update elapsed time every second if clocked in
    const interval = setInterval(() => {
      if (state.isClockedIn && !state.isOnBreak) {
        setState((prev) => ({
          ...prev,
          elapsedSeconds: prev.elapsedSeconds + 1,
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state.isClockedIn, state.isOnBreak]);

  const clockIn = async () => {
    Alert.alert(
      'Confirm Clock In',
      'Are you ready to start your shift?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clock In',
          onPress: async () => {
            try {
              // In production, this would call the API
              const newShift: Shift = {
                id: Date.now().toString(),
                start_time: new Date().toISOString(),
                end_time: null,
                break_start: null,
                break_end: null,
                total_hours: 0,
                break_minutes: 0,
              };
              setState({
                isClockedIn: true,
                isOnBreak: false,
                currentShift: newShift,
                elapsedSeconds: 0,
              });
              Alert.alert('Success', 'You have been clocked in');
            } catch (error) {
              Alert.alert('Error', 'Failed to clock in');
            }
          },
        },
      ]
    );
  };

  const clockOut = async () => {
    Alert.alert(
      'Confirm Clock Out',
      'Are you sure you want to end your shift?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clock Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // In production, this would call the API
              setState({
                isClockedIn: false,
                isOnBreak: false,
                currentShift: null,
                elapsedSeconds: 0,
              });
              Alert.alert('Success', 'You have been clocked out');
            } catch (error) {
              Alert.alert('Error', 'Failed to clock out');
            }
          },
        },
      ]
    );
  };

  const startBreak = async () => {
    Alert.alert(
      'Start Break',
      'Are you going on break?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Break',
          onPress: async () => {
            try {
              // In production, this would call the API
              setState((prev) => ({
                ...prev,
                isOnBreak: true,
                currentShift: prev.currentShift
                  ? { ...prev.currentShift, break_start: new Date().toISOString() }
                  : null,
              }));
              Alert.alert('Success', 'Break started');
            } catch (error) {
              Alert.alert('Error', 'Failed to start break');
            }
          },
        },
      ]
    );
  };

  const endBreak = async () => {
    try {
      // In production, this would call the API
      setState((prev) => ({
        ...prev,
        isOnBreak: false,
        currentShift: prev.currentShift
          ? {
              ...prev.currentShift,
              break_end: new Date().toISOString(),
              break_minutes: prev.currentShift.break_minutes + 15,
            }
          : null,
      }));
      Alert.alert('Success', 'Break ended');
    } catch (error) {
      Alert.alert('Error', 'Failed to end break');
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (isoString: string): string => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Current Status */}
      <View style={styles.statusCard}>
        <View
          style={[
            styles.statusIndicator,
            { backgroundColor: state.isClockedIn ? '#10b981' : '#6b7280' },
          ]}
        />
        <Text style={styles.statusText}>
          {state.isClockedIn
            ? state.isOnBreak
              ? 'On Break'
              : 'Clocked In'
            : 'Clocked Out'}
        </Text>
      </View>

      {/* Timer Display */}
      <View style={styles.timerContainer}>
        <Text style={styles.timerLabel}>Current Shift</Text>
        <Text style={styles.timerDisplay}>
          {formatTime(state.elapsedSeconds)}
        </Text>
        {state.currentShift && (
          <Text style={styles.shiftInfo}>
            Started at {formatDateTime(state.currentShift.start_time)}
          </Text>
        )}
      </View>

      {/* Shift Stats */}
      {state.currentShift && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatDateTime(state.currentShift.start_time)}
            </Text>
            <Text style={styles.statLabel}>Clock In</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {state.currentShift.break_minutes} min
            </Text>
            <Text style={styles.statLabel}>Break Time</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatTime(state.elapsedSeconds - state.currentShift.break_minutes * 60)}
            </Text>
            <Text style={styles.statLabel}>Work Time</Text>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {!state.isClockedIn ? (
          <TouchableOpacity style={styles.clockInButton} onPress={clockIn}>
            <Ionicons name="log-in" size={32} color="#ffffff" />
            <Text style={styles.clockInText}>Clock In</Text>
          </TouchableOpacity>
        ) : (
          <>
            {!state.isOnBreak ? (
              <TouchableOpacity style={styles.breakButton} onPress={startBreak}>
                <Ionicons name="pause" size={24} color="#ffffff" />
                <Text style={styles.breakText}>Start Break</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.endBreakButton} onPress={endBreak}>
                <Ionicons name="play" size={24} color="#ffffff" />
                <Text style={styles.endBreakText}>End Break</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.clockOutButton} onPress={clockOut}>
              <Ionicons name="log-out" size={24} color="#ffffff" />
              <Text style={styles.clockOutText}>Clock Out</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Today's History */}
      <View style={styles.historySection}>
        <Text style={styles.historyTitle}>Today&apos;s Activity</Text>
        <View style={styles.historyItem}>
          <Ionicons name="log-in-outline" size={20} color="#10b981" />
          <Text style={styles.historyText}>Clocked in at 8:00 AM</Text>
        </View>
        <View style={styles.historyItem}>
          <Ionicons name="pause-outline" size={20} color="#f59e0b" />
          <Text style={styles.historyText}>Break from 12:00 PM - 12:15 PM</Text>
        </View>
      </View>
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
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 20,
    margin: 16,
    borderRadius: 12,
    gap: 12,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  timerContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 32,
    marginHorizontal: 16,
    borderRadius: 12,
  },
  timerLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  timerDisplay: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#1f2937',
    fontVariant: ['tabular-nums'],
  },
  shiftInfo: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    padding: 20,
    margin: 16,
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  actionsContainer: {
    padding: 16,
    gap: 12,
  },
  clockInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    padding: 20,
    borderRadius: 12,
    gap: 12,
  },
  clockInText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  breakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  breakText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  endBreakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  endBreakText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  clockOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  clockOutText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  historySection: {
    backgroundColor: '#ffffff',
    padding: 20,
    margin: 16,
    borderRadius: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  historyText: {
    fontSize: 14,
    color: '#4b5563',
  },
});
