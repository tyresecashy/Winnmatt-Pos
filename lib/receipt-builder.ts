import type { SaleDetailsData } from '@/components/receipt-preview'

function unwrapEmbedded<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

/**
 * Build a normalized receipt payload from raw sale data and business settings.
 * This is the single source of truth for receipt data assembly.
 * 
 * @param saleData Raw sale data from getSaleById
 * @param receiptSettings Business/branch receipt settings
 * @returns SaleDetailsData ready for ReceiptPreview, or null if data is invalid
 */
export function buildReceiptPayload(
  saleData: any,
  receiptSettings: any
): SaleDetailsData | null {
  const rawItems = Array.isArray(saleData?.items) ? saleData.items : []
  const cashier = unwrapEmbedded(saleData?.cashier)
  const customer = unwrapEmbedded(saleData?.customer)
  const branch = unwrapEmbedded(saleData?.branch)
  const items = rawItems.map((item: any) => ({
    ...item,
    product: unwrapEmbedded(item?.product),
  }))

  const hadEmbeddedArrays =
    Array.isArray(saleData?.cashier) ||
    Array.isArray(saleData?.customer) ||
    Array.isArray(saleData?.branch) ||
    rawItems.some((item: any) => Array.isArray(item?.product))

  if (hadEmbeddedArrays) {
    console.log('[receipt-builder] Normalized embedded relation arrays for receipt payload', {
      saleId: saleData?.id,
      cashierWasArray: Array.isArray(saleData?.cashier),
      customerWasArray: Array.isArray(saleData?.customer),
      branchWasArray: Array.isArray(saleData?.branch),
    })
  }

  // Strict validation: Must have all required fields
  if (!saleData) {
    console.error('[receipt-builder] No sale data provided')
    return null
  }

  if (!saleData.id || !saleData.receipt_number) {
    console.error('[receipt-builder] Sale missing id or receipt_number', { saleId: saleData?.id, receiptNumber: saleData?.receipt_number })
    return null
  }

  if (!saleData.created_at) {
    console.error('[receipt-builder] Sale missing created_at')
    return null
  }

  if (!saleData.payment_method) {
    console.error('[receipt-builder] Sale missing payment_method')
    return null
  }

  if (items.length === 0) {
    console.error('[receipt-builder] Sale missing items or items is empty', { itemsLength: saleData?.items?.length })
    return null
  }

  if (!cashier?.id || !cashier?.full_name) {
    console.error('[receipt-builder] Sale missing cashier relation', {
      cashierType: Array.isArray(saleData?.cashier) ? 'array' : typeof saleData?.cashier,
      cashier,
    })
    return null
  }

  if (!branch?.id || !branch?.name || !branch?.code) {
    console.error('[receipt-builder] Sale missing branch relation', {
      branchType: Array.isArray(saleData?.branch) ? 'array' : typeof saleData?.branch,
      branch,
    })
    return null
  }

  const hasInvalidItemProduct = items.some(
    (item: any) => !item?.id || !item?.product_id || !item?.product?.id || !item?.product?.name
  )

  if (hasInvalidItemProduct) {
    console.error('[receipt-builder] Sale has items with missing product relation', {
      saleId: saleData?.id,
      itemsPreview: items.slice(0, 2),
    })
    return null
  }

  // All validations passed - build payload
  const receiptPayload: SaleDetailsData = {
    id: saleData.id,
    receipt_number: saleData.receipt_number,
    created_at: saleData.created_at,
    subtotal: saleData.subtotal,
    discount_amount: saleData.discount_amount,
    tax_amount: saleData.tax_amount,
    total_amount: saleData.total_amount,
    payment_method: saleData.payment_method,
    payment_status: saleData.payment_status,
    notes: saleData.notes || null,
    
    // Relations
    cashier: {
      id: cashier.id,
      full_name: cashier.full_name,
    },
    customer: customer ? {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      loyalty_points: customer.loyalty_points,
    } : null,
    branch: {
      id: branch.id,
      name: branch.name,
      code: branch.code,
    },
    items: items.map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent,
      line_total: item.line_total,
      product: {
        id: item.product.id,
        sku: item.product.sku || '',
        name: item.product.name,
      },
    })),
    
    // Settings
    businessSettings: {
      business_name: receiptSettings?.business_name || 'Winnmatt',
      phone: receiptSettings?.phone || '',
      email: receiptSettings?.email || '',
      address: receiptSettings?.address || '',
      tax_pin: receiptSettings?.tax_pin || '',
      receipt_footer_text: receiptSettings?.receipt_footer_text || '',
      thank_you_message: receiptSettings?.thank_you_message || 'Thank you for your purchase!',
    },
    branchSettings: receiptSettings?.branchSettings || undefined,
  }

  console.log('[receipt-builder] Receipt payload built successfully:', {
    saleId: receiptPayload.id,
    receiptNumber: receiptPayload.receipt_number,
    itemsCount: receiptPayload.items.length,
    totalAmount: receiptPayload.total_amount,
  })

  return receiptPayload
}

/**
 * Validate that a receipt payload is ready to display.
 * @returns true if valid and safe to show, false if data is missing/invalid
 */
export function isReceiptPayloadValid(data: any): boolean {
  return !!(
    data?.id &&
    data?.receipt_number &&
    data?.created_at &&
    data?.payment_method &&
    Array.isArray(data?.items) &&
    data.items.length > 0 &&
    data?.cashier?.id &&
    data?.branch?.id
  )
}
