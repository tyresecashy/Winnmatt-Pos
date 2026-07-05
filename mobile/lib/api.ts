import { offlineStorage } from './offline-storage';

const API_BASE_URL = 'https://aunnoikvfjgrlejccywv.supabase.co/functions/v1';

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

class ApiClient {
  private async getHeaders(): Promise<HeadersInit> {
    const userData = await offlineStorage.getUserData();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userData?.token || ''}`,
    };
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        return { data: null, error: response.statusText };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: 'Network error' };
    }
  }

  async post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return { data: null, error: response.statusText };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: 'Network error' };
    }
  }

  async patch<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return { data: null, error: response.statusText };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: 'Network error' };
    }
  }

  async delete(endpoint: string): Promise<ApiResponse<void>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        return { data: null, error: response.statusText };
      }

      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: 'Network error' };
    }
  }

  // Task-specific API methods
  async getTasks(workerId: string) {
    return this.get<any[]>(`/tasks?worker_id=${workerId}`);
  }

  async getTask(taskId: string) {
    return this.get<any>(`/tasks/${taskId}`);
  }

  async updateTask(taskId: string, updates: any) {
    return this.patch<any>(`/tasks/${taskId}`, updates);
  }

  async completeChecklistItem(taskId: string, itemId: string, completed: boolean) {
    return this.patch<any>(`/tasks/${taskId}/checklist/${itemId}`, { completed });
  }

  // Time tracking API methods
  async clockIn(workerId: string, shiftData: any) {
    return this.post<any>('/time-logs/clock-in', { worker_id: workerId, ...shiftData });
  }

  async clockOut(timeLogId: string) {
    return this.post<any>(`/time-logs/${timeLogId}/clock-out`, {});
  }

  async startBreak(timeLogId: string) {
    return this.post<any>(`/time-logs/${timeLogId}/break/start`, {});
  }

  async endBreak(timeLogId: string) {
    return this.post<any>(`/time-logs/${timeLogId}/break/end`, {});
  }

  async getTimeLogs(workerId: string, date: string) {
    return this.get<any[]>(`/time-logs?worker_id=${workerId}&date=${date}`);
  }

  // Photo upload API methods
  async uploadPhoto(taskId: string, photoData: FormData) {
    try {
      const userData = await offlineStorage.getUserData();
      const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/photos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userData?.token || ''}`,
        },
        body: photoData,
      });

      if (!response.ok) {
        return { data: null, error: response.statusText };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: 'Network error' };
    }
  }

  // Barcode/Inventory API methods
  async lookupBarcode(barcode: string) {
    return this.get<any>(`/products/barcode/${barcode}`);
  }

  async updateStock(productId: string, quantity: number, action: 'add' | 'remove' | 'set') {
    return this.post<any>(`/inventory/update`, {
      product_id: productId,
      quantity,
      action,
    });
  }

  // Worker profile API methods
  async getWorkerProfile(workerId: string) {
    return this.get<any>(`/workers/${workerId}`);
  }

  async getWorkerPerformance(workerId: string, startDate: string, endDate: string) {
    return this.get<any>(`/workers/${workerId}/performance?start=${startDate}&end=${endDate}`);
  }
}

export const apiClient = new ApiClient();
