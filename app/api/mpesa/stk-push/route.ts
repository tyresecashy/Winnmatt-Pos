/**
 * M-Pesa STK Push Initiation Endpoint
 * POST /api/mpesa/stk-push
 *
 * Initiates STK Push prompt on customer's phone
 *
 * SECURITY:
 * - Requires a verified Supabase auth session
 * - Loads the app profile from the authenticated Supabase user id
 * - Verifies user belongs to the sale's branch
 * - Owner can access any branch, others only their own
 * - Validates sale exists and is pending payment
 */

import { NextRequest, NextResponse } from 'next/server'
import MpesaService from '@/lib/mpesa-service'
import {
  createMpesaTransaction,
  failMpesaSale,
} from '@/lib/mpesa-actions'
import { supabaseAdmin } from '@/lib/supabase-server'
import { authenticateRequest, verifySaleAccess, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { stkPushSchema } from '@/lib/api-schemas'
import { badRequest } from '@/lib/api-errors'

function getMissingMpesaConfig() {
  const requiredConfig = {
    MPESA_CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY,
    MPESA_CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET,
    MPESA_PAYBILL: process.env.MPESA_PAYBILL,
    MPESA_PASSKEY: process.env.MPESA_PASSKEY,
    MPESA_CALLBACK_URL: process.env.MPESA_CALLBACK_URL,
  }

  return Object.entries(requiredConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key)
}

async function restoreFailedMpesaSaleInventory(saleId: string) {
  const { data: sale, error: saleError } = await supabaseAdmin
    .from('sales')
    .select('id, branch_id, payment_status')
    .eq('id', saleId)
    .single()

  if (saleError || !sale) {
    logger.error('[M-Pesa STK] Failed to load sale for inventory restore', saleError, {
      saleId,
    })
    return
  }

  if (sale.payment_status !== 'pending') {
    return
  }

  const { data: saleItems, error: itemsError } = await supabaseAdmin
    .from('sale_items')
    .select('product_id, quantity')
    .eq('sale_id', saleId)

  if (itemsError) {
    logger.error('[M-Pesa STK] Failed to load sale items for inventory restore', itemsError, {
      saleId,
    })
    return
  }

  for (const item of saleItems || []) {
    const { data: inventory, error: inventoryError } = await supabaseAdmin
      .from('inventory')
      .select('id, quantity')
      .eq('branch_id', sale.branch_id)
      .eq('product_id', item.product_id)
      .single()

    if (inventoryError || !inventory) {
      logger.warn('[M-Pesa STK] Inventory restore skipped for item', {
        saleId, productId: item.product_id,
      })
      continue
    }

    const restoredQuantity = inventory.quantity + item.quantity

    const { error: updateError } = await supabaseAdmin
      .from('inventory')
      .update({
        quantity: restoredQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inventory.id)

    if (updateError) {
      logger.error('[M-Pesa STK] Failed to restore inventory quantity', updateError, {
        saleId, productId: item.product_id,
      })
      continue
    }

    const { error: movementError } = await supabaseAdmin
      .from('stock_movements')
      .insert({
        product_id: item.product_id,
        branch_id: sale.branch_id,
        type: 'adjustment',
        quantity: item.quantity,
        reference_id: saleId,
        notes: 'M-Pesa payment failed before confirmation - inventory restored',
      })

    if (movementError) {
      logger.error('[M-Pesa STK] Failed to write inventory restore movement', movementError, {
        saleId, productId: item.product_id,
      })
    }
  }
}

async function failPendingMpesaSaleWithRestore(saleId: string, errorMessage: string) {
  await restoreFailedMpesaSaleInventory(saleId)
  return failMpesaSale(saleId, errorMessage)
}

export async function POST(req: NextRequest) {
  try {
    // ========================================================================
    // AUTHENTICATION
    // ========================================================================
    const authResult = await authenticateRequest(req)
    
    if (!authResult.success) {
      logger.warn('[M-Pesa STK] Auth failed', { reason: authResult.error })
      return unauthorizedResponse(authResult.error)
    }

    const profile = authResult.profile!

    // ========================================================================
    // REQUEST VALIDATION
    // ========================================================================
    let body: unknown
    
    try {
      body = await req.json()
    } catch {
      logger.error('[M-Pesa STK] Invalid JSON payload')
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const parsed = stkPushSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message,
      })))
    }

    const { saleId, phoneNumber, amount, accountReference } = parsed.data

    // Validate environment variables
    const missingMpesaConfig = getMissingMpesaConfig()

    logger.info('[M-Pesa STK] Configuration snapshot', {
      environment: process.env.MPESA_ENVIRONMENT || 'sandbox',
      callbackUrlPresent: !!process.env.MPESA_CALLBACK_URL,
      passkeyPresent: !!process.env.MPESA_PASSKEY,
      consumerKeyPresent: !!process.env.MPESA_CONSUMER_KEY,
    })

    if (missingMpesaConfig.length > 0) {
      logger.error('[M-Pesa STK] Missing environment variables', undefined, {
        missingMpesaConfig,
      })
      return NextResponse.json(
        {
          error: 'M-Pesa configuration incomplete',
          missingConfig: missingMpesaConfig,
        },
        { status: 500 }
      )
    }

    const consumerKey = process.env.MPESA_CONSUMER_KEY!
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET!
    const paybill = process.env.MPESA_PAYBILL!
    const passkey = process.env.MPESA_PASSKEY!
    const callbackUrl = process.env.MPESA_CALLBACK_URL!
    const mpesaEnvironment = (process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox'
    const resolvedAccountReference = process.env.MPESA_ACCOUNT_REFERENCE || accountReference || 'WINNMATT'

    // ========================================================================
    // AUTHORIZATION: Verify sale access
    // ========================================================================
    const saleAccessResult = await verifySaleAccess(profile, saleId)
    
    if (!saleAccessResult.authorized) {
      logger.warn('[M-Pesa STK] Access denied', {
        reason: saleAccessResult.error,
      })
      return forbiddenResponse(saleAccessResult.error)
    }

    // ========================================================================
    // SALE VALIDATION
    // ========================================================================
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('sales')
      .select('id, payment_status, total_amount, branch_id')
      .eq('id', saleId)
      .single()

    if (saleError || !sale) {
      logger.error('[M-Pesa STK] Sale not found', saleError, { saleId })
      return NextResponse.json(
        { error: 'Sale not found' },
        { status: 404 }
      )
    }

    if (sale.payment_status !== 'pending') {
      logger.warn('[M-Pesa STK] Sale not in pending state', {
        paymentStatus: sale.payment_status,
      })
      return NextResponse.json(
        { error: 'Sale is not awaiting M-Pesa payment' },
        { status: 400 }
      )
    }

    if (Math.abs(sale.total_amount - amount) > 1) {
      logger.warn('[M-Pesa STK] Amount mismatch')
      return NextResponse.json(
        { error: 'Amount does not match sale total' },
        { status: 400 }
      )
    }

    // ========================================================================
    // INITIATE M-PESA PAYMENT
    // ========================================================================
    const mpesaService = new MpesaService({
      consumerKey,
      consumerSecret,
      paybill,
      accountReference: resolvedAccountReference,
      callbackUrl,
      environment: mpesaEnvironment,
    })

    const normalizedPhoneNumber = mpesaService.normalizePhoneNumber(phoneNumber)

    logger.info('[M-Pesa STK] Initiating STK Push', {
      environment: mpesaEnvironment,
      shortcode: paybill,
    })

    const stkResponse = await mpesaService.initiateStkPush(
      phoneNumber,
      amount,
      resolvedAccountReference,
      `POS Sale - Ref: ${resolvedAccountReference}`,
      passkey
    )

    // Check response
    if (stkResponse.ResponseCode !== '0') {
      logger.warn('[M-Pesa STK] STK Push failed', {
        ResponseCode: stkResponse.ResponseCode,
        ResponseDescription: stkResponse.ResponseDescription,
      })

      // Mark sale as failed
      await failPendingMpesaSaleWithRestore(
        saleId,
        stkResponse.ResponseDescription
      )

      return NextResponse.json(
        {
          error: stkResponse.ResponseDescription,
          message: 'Failed to send STK Push prompt',
        },
        { status: 400 }
      )
    }

    // Create M-Pesa transaction record
    const transactionResult = await createMpesaTransaction(
      saleId,
      stkResponse.MerchantRequestID,
      stkResponse.CheckoutRequestID,
      phoneNumber,
      amount
    )

    if (!transactionResult.success) {
      logger.error('[M-Pesa STK] Failed to create transaction record')
      await failPendingMpesaSaleWithRestore(
        saleId,
        'Failed to record M-Pesa transaction after sending STK Push'
      )
      return NextResponse.json(
        { error: 'Failed to record M-Pesa transaction' },
        { status: 500 }
      )
    }

    logger.info('[M-Pesa STK] STK Push sent successfully')

    return NextResponse.json(
      {
        success: true,
        message: stkResponse.CustomerMessage,
        checkoutRequestId: stkResponse.CheckoutRequestID,
        merchantRequestId: stkResponse.MerchantRequestID,
      },
      { status: 200 }
    )
  } catch (error) {
    logger.error('[M-Pesa STK] Endpoint error', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
