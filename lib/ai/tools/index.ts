import { productTools } from './products'
import { customerTools } from './customers'
import { salesTools } from './sales'
import { inventoryTools } from './inventory'
import { supplierTools } from './suppliers'
import { employeeTools } from './employees'
import { financeTools } from './finance'
import { adminTools } from './admin'
import type { ToolDefinition } from '../types'

/**
 * All AI assistant tools from every domain
 */
export const allTools: ToolDefinition[] = [
  ...productTools,
  ...customerTools,
  ...salesTools,
  ...inventoryTools,
  ...supplierTools,
  ...employeeTools,
  ...financeTools,
  ...adminTools,
]
