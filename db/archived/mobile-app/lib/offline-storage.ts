import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  TASKS: '@winnmatt_tasks',
  TIME_LOGS: '@winnmatt_time_logs',
  PENDING_SYNC: '@winnmatt_pending_sync',
  USER_DATA: '@winnmatt_user_data',
  SETTINGS: '@winnmatt_settings',
};

export interface OfflineTask {
  id: string;
  title: string;
  status: string;
  checklist: { id: string; completed: boolean }[];
  lastUpdated: string;
  synced: boolean;
}

export interface OfflineTimeLog {
  id: string;
  task_id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  synced: boolean;
}

export interface PendingSyncItem {
  id: string;
  type: 'task_update' | 'time_log' | 'photo_upload';
  data: any;
  timestamp: string;
  retryCount: number;
}

class OfflineStorage {
  // Tasks
  async saveTasks(tasks: OfflineTask[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch (error) {
      console.error('Error saving tasks:', error);
    }
  }

  async getTasks(): Promise<OfflineTask[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TASKS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting tasks:', error);
      return [];
    }
  }

  async updateTask(taskId: string, updates: Partial<OfflineTask>): Promise<void> {
    try {
      const tasks = await this.getTasks();
      const index = tasks.findIndex((t) => t.id === taskId);
      if (index !== -1) {
        tasks[index] = { ...tasks[index], ...updates, synced: false };
        await this.saveTasks(tasks);
        await this.addToPendingSync({
          id: Date.now().toString(),
          type: 'task_update',
          data: { taskId, updates },
          timestamp: new Date().toISOString(),
          retryCount: 0,
        });
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  }

  // Time Logs
  async saveTimeLogs(logs: OfflineTimeLog[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TIME_LOGS, JSON.stringify(logs));
    } catch (error) {
      console.error('Error saving time logs:', error);
    }
  }

  async getTimeLogs(): Promise<OfflineTimeLog[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TIME_LOGS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting time logs:', error);
      return [];
    }
  }

  async addTimeLog(log: OfflineTimeLog): Promise<void> {
    try {
      const logs = await this.getTimeLogs();
      logs.push(log);
      await this.saveTimeLogs(logs);
      await this.addToPendingSync({
        id: Date.now().toString(),
        type: 'time_log',
        data: log,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
    } catch (error) {
      console.error('Error adding time log:', error);
    }
  }

  // Pending Sync Queue
  async addToPendingSync(item: PendingSyncItem): Promise<void> {
    try {
      const items = await this.getPendingSyncItems();
      items.push(item);
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(items));
    } catch (error) {
      console.error('Error adding to pending sync:', error);
    }
  }

  async getPendingSyncItems(): Promise<PendingSyncItem[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SYNC);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting pending sync items:', error);
      return [];
    }
  }

  async removePendingSyncItem(itemId: string): Promise<void> {
    try {
      const items = await this.getPendingSyncItems();
      const filtered = items.filter((i) => i.id !== itemId);
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing pending sync item:', error);
    }
  }

  async updatePendingSyncItem(itemId: string, updates: Partial<PendingSyncItem>): Promise<void> {
    try {
      const items = await this.getPendingSyncItems();
      const index = items.findIndex((i) => i.id === itemId);
      if (index !== -1) {
        items[index] = { ...items[index], ...updates };
        await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(items));
      }
    } catch (error) {
      console.error('Error updating pending sync item:', error);
    }
  }

  // User Data
  async saveUserData(data: any): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  }

  async getUserData(): Promise<any> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  // Settings
  async saveSettings(settings: any): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  async getSettings(): Promise<any> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error getting settings:', error);
      return {};
    }
  }

  // Clear all data
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  }
}

export const offlineStorage = new OfflineStorage();
