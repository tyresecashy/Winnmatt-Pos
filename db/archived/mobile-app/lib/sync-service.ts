/* eslint-disable no-console */
import { offlineStorage, PendingSyncItem } from './offline-storage';
import NetInfo from '@react-native-community/netinfo';

const API_BASE_URL = 'https://aunnoikvfjgrlejccywv.supabase.co/functions/v1';

class SyncService {
  private isSyncing = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private listeners: ((status: string) => void)[] = [];

  constructor() {
    this.setupNetworkListener();
  }

  private setupNetworkListener() {
    NetInfo.addEventListener((state) => {
      if (state.isConnected && !this.isSyncing) {
        this.startSync();
      }
    });
  }

  onStatusChange(listener: (status: string) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(status: string) {
    this.listeners.forEach((listener) => listener(status));
  }

  async startSync() {
    if (this.isSyncing) return;

    this.isSyncing = true;
    this.notifyListeners('syncing');

    try {
      const pendingItems = await offlineStorage.getPendingSyncItems();
      
      for (const item of pendingItems) {
        try {
          await this.syncItem(item);
          await offlineStorage.removePendingSyncItem(item.id);
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error);
          
          // Update retry count
          await offlineStorage.updatePendingSyncItem(item.id, {
            retryCount: item.retryCount + 1,
          });

          // If too many retries, remove from queue
          if (item.retryCount >= 3) {
            await offlineStorage.removePendingSyncItem(item.id);
          }
        }
      }

      this.notifyListeners('synced');
    } catch (error) {
      console.error('Sync failed:', error);
      this.notifyListeners('error');
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncItem(item: PendingSyncItem) {
    const { type, data } = item;

    switch (type) {
      case 'task_update':
        await this.syncTaskUpdate(data);
        break;
      case 'time_log':
        await this.syncTimeLog(data);
        break;
      case 'photo_upload':
        await this.syncPhotoUpload(data);
        break;
      default:
        console.warn(`Unknown sync type: ${type}`);
    }
  }

  private async syncTaskUpdate(data: { taskId: string; updates: any }) {
    const response = await fetch(`${API_BASE_URL}/tasks/${data.taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await this.getAuthToken()}`,
      },
      body: JSON.stringify(data.updates),
    });

    if (!response.ok) {
      throw new Error(`Failed to sync task update: ${response.statusText}`);
    }
  }

  private async syncTimeLog(data: any) {
    const response = await fetch(`${API_BASE_URL}/time-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await this.getAuthToken()}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to sync time log: ${response.statusText}`);
    }
  }

  private async syncPhotoUpload(data: { taskId: string; photoUri: string; type: string }) {
    // In production, this would upload the photo to storage
    // For now, just log it
    console.log('Syncing photo:', data);
  }

  private async getAuthToken(): Promise<string> {
    const userData = await offlineStorage.getUserData();
    return userData?.token || '';
  }

  async getPendingSyncCount(): Promise<number> {
    const items = await offlineStorage.getPendingSyncItems();
    return items.length;
  }

  async forceSyncAll() {
    await this.startSync();
  }

  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

export const syncService = new SyncService();
