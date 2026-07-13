import { logger } from '@/lib/logger'
import { customerAppService } from './customer-service';

export { customerAppService };

export type { CustomerProfile, CustomerOrder, LoyaltyReward, DigitalReceipt, StoreLocation } from './customer-service';

export class CustomerAppManager {
  async initializeCustomerApp(): Promise<void> {
    // Initialize customer app settings
    logger.info('[CustomerApp] Initializing customer app...');
  }

  async sendOrderNotification(orderId: string, status: string): Promise<void> {
    // Send push notification for order status update
    logger.info(`[CustomerApp] Sending notification for order ${orderId}: ${status}`);
  }

  async processLoyaltyPoints(customerId: string, orderId: string, amount: number): Promise<void> {
    // Process loyalty points for a purchase
    const pointsToEarn = Math.floor(amount / 10000); // 1 point per KES 100
    await customerAppService.earnPoints(customerId, orderId, amount);
    logger.info(`[CustomerApp] Earned ${pointsToEarn} points for customer ${customerId}`);
  }

  async generateDigitalReceipt(orderId: string): Promise<Record<string, unknown> | null> {
    // Generate digital receipt for an order
    const receipt = await customerAppService.getReceipt(orderId);
    return receipt as unknown as Record<string, unknown> | null;
  }

  async findNearestStore(latitude: number, longitude: number): Promise<Record<string, unknown> | null> {
    // Find nearest store to customer location
    const stores = await customerAppService.getStoreLocations(latitude, longitude);
    return (stores[0] as unknown as Record<string, unknown>) || null;
  }
}

export const customerAppManager = new CustomerAppManager();
