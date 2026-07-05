import { branchService } from './branch-service';

export { branchService };

export type { Branch, BranchMetrics, InterBranchTransfer, TransferItem, BranchPerformance } from './branch-service';

export class MultiBranchManager {
  async initializeBranchNetwork(): Promise<void> {
    // Initialize default branches if none exist
    const branches = await branchService.getBranches();
    
    if (branches.length === 0) {
      const defaultBranches = [
        {
          name: 'WinnMatt Main',
          code: 'MAIN',
          address: '123 Main Street',
          city: 'Nairobi',
          phone: '+254 700 000 001',
          email: 'main@winnmatt.com',
          manager_id: '',
          is_active: true,
        },
        {
          name: 'WinnMatt Westlands',
          code: 'WEST',
          address: '456 Westlands Road',
          city: 'Nairobi',
          phone: '+254 700 000 002',
          email: 'westlands@winnmatt.com',
          manager_id: '',
          is_active: true,
        },
        {
          name: 'WinnMatt Mombasa',
          code: 'MOMB',
          address: '789 Moi Avenue',
          city: 'Mombasa',
          phone: '+254 700 000 003',
          email: 'mombasa@winnmatt.com',
          manager_id: '',
          is_active: true,
        },
      ];

      for (const branch of defaultBranches) {
        await branchService.createBranch(branch);
      }
    }
  }

  async syncInventoryAcrossBranches(): Promise<void> {
    // Sync inventory levels across branches
    // This would be called periodically or on demand
    console.log('Syncing inventory across branches...');
  }

  async generateBranchReport(branchId: string, startDate: string, endDate: string): Promise<any> {
    const metrics = await branchService.getBranchMetrics(startDate, endDate);
    const branchMetrics = metrics.find(m => m.branchId === branchId);
    
    return {
      branchId,
      period: { startDate, endDate },
      metrics: branchMetrics,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const multiBranchManager = new MultiBranchManager();
