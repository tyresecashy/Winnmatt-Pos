/**
 * API Index — GET /api/v1
 *
 * API documentation and endpoint discovery.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    name: 'WINNMATT POS API',
    version: '1.0.0',
    description: 'REST API for WINNMATT POS platform',
    endpoints: {
      products: {
        'GET /api/v1/products': 'List products with filtering',
        'GET /api/v1/products/[id]': 'Get product by ID',
        'PUT /api/v1/products/[id]': 'Update product (admin only)',
        'DELETE /api/v1/products/[id]': 'Deactivate product (admin only)',
      },
      sales: {
        'GET /api/v1/sales': 'List sales with filtering',
        'GET /api/v1/sales/[id]': 'Get sale details with items',
        'POST /api/v1/sales': 'Create a new sale',
        'POST /api/v1/sales/[id]/void': 'Void a sale',
        'POST /api/v1/sales/[id]/return': 'Process a return',
      },
      customers: {
        'GET /api/v1/customers': 'List customers with search',
        'GET /api/v1/customers/[id]': 'Get customer details',
        'POST /api/v1/customers': 'Create a customer',
        'PUT /api/v1/customers/[id]': 'Update customer',
        'GET /api/v1/customers/[id]/loyalty': 'Get loyalty balance',
      },
      search: {
        'GET /api/v1/search?q=query': 'Global search across all entities',
      },
    },
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <token>',
      description: 'Use Supabase JWT token obtained from /auth/v1/token',
    },
    pagination: {
      page: 'Page number (default: 1)',
      limit: 'Items per page (default: 20, max: 100)',
    },
    sorting: {
      sort: 'Column name (default: created_at)',
      order: 'Sort direction: asc or desc (default: desc)',
    },
    filtering: {
      branch_id: 'Filter by branch',
      search: 'Search by name/SKU/phone',
      status: 'Filter by status',
      start_date: 'Filter by start date (ISO format)',
      end_date: 'Filter by end date (ISO format)',
    },
    rateLimits: {
      requests: 100,
      window: '60 seconds',
    },
    contact: {
      support: 'support@winnmatt.com',
      docs: 'https://docs.winnmatt.com',
    },
  })
}
