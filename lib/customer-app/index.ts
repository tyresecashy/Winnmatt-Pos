import { customerAppService } from './customer-service';

export { customerAppService };

export type { CustomerProfile, CustomerOrder, LoyaltyReward, DigitalReceipt, StoreLocation } from './customer-service';

export class CustomerAppManager {
  async initializeCustomerApp(): Promise<void> {
    // Initialize customer app settings
    console.log('Initializing customer app...');
  }

  async sendOrderNotification(orderId: string, status: string): Promise<void> {
    // Send push notification for order status update
    console.log(`Sending notification for order ${orderId}: ${status}`);
  }

  async processLoyaltyPoints(customerId: string, orderId: string, amount: number): Promise<void> {
    // Process loyalty points for a purchase
    const pointsToEarn = Math.floor(amount / 10000); // 1 point per KES 100
    await customerAppService.earnPoints(customerId, orderId, amount);
    console.log(`Earned ${pointsToEarn} points for customer ${customerId}`);
  }

  async generateDigitalReceipt(orderId: string): Promise<any> {
    // Generate digital receipt for an order
    const receipt = await customerAppService.getReceipt(orderId);
    return receipt;
  }

  async findNearestStore(latitude: number, longitude: number): Promise<any> {
    // Find nearest store to customer location
    const stores = await customerAppService.getStoreLocations(latitude, longitude);
    return stores[0] || null;
  }
}

export const customerAppManager = new CustomerAppManager();
