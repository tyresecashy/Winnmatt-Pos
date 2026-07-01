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

interface STKPushRequest {
  saleId: string
  phoneNumber: string
  amount: number
  accountReference: string
}

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
    console.error('[M-Pesa STK] Failed to load sale for inventory restore', {
      saleId,
      error: saleError?.message,
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
    console.error('[M-Pesa STK] Failed to load sale items for inventory restore', {
      saleId,
      error: itemsError.message,
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
      console.error('[M-Pesa STK] Inventory restore skipped for item', {
        saleId,
        productId: item.product_id,
        error: inventoryError?.message,
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
      console.error('[M-Pesa STK] Failed to restore inventory quantity', {
        saleId,
        productId: item.product_id,
        error: updateError.message,
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
      console.error('[M-Pesa STK] Failed to write inventory restore movement', {
        saleId,
        productId: item.product_id,
        error: movementError.message,
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
      console.warn('[M-Pesa STK] Auth failed:', authResult.error)
      return unauthorizedResponse(authResult.error)
    }

    const profile = authResult.profile!

    // ========================================================================
    // REQUEST VALIDATION
    // ========================================================================
    let body: STKPushRequest
    
    try {
      body = await req.json()
    } catch (error) {
      console.error('[M-Pesa STK] Invalid JSON payload')
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    // Validate required fields
    const { saleId, phoneNumber, amount, accountReference } = body
    
    if (!saleId || !phoneNumber || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: saleId, phoneNumber, amount' },
        { status: 400 }
      )
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    if (typeof phoneNumber !== 'string' || phoneNumber.length < 10) {
      return NextResponse.json(
        { error: 'Invalid phone number' },
        { status: 400 }
      )
    }

    // Validate environment variables
    const missingMpesaConfig = getMissingMpesaConfig()

    console.log('[M-Pesa STK] Configuration snapshot', {
      environment: process.env.MPESA_ENVIRONMENT || 'sandbox',
      paybill: process.env.MPESA_PAYBILL || null,
      accountReference: process.env.MPESA_ACCOUNT_REFERENCE || accountReference || null,
      callbackUrlPresent: !!process.env.MPESA_CALLBACK_URL,
      passkeyPresent: !!process.env.MPESA_PASSKEY,
      consumerKeyPresent: !!process.env.MPESA_CONSUMER_KEY,
      consumerSecretPresent: !!process.env.MPESA_CONSUMER_SECRET,
    })

    if (missingMpesaConfig.length > 0) {
      console.error('[M-Pesa STK] Missing environment variables', {
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
    const resolvedAccountReference = process.env.MPESA_ACCOUNT_REFERENCE || accountReference

    // ========================================================================
    // AUTHORIZATION: Verify sale access
    // ========================================================================
    const saleAccessResult = await verifySaleAccess(profile, saleId)
    
    if (!saleAccessResult.authorized) {
      console.warn('[M-Pesa STK] Access denied:', {
        userId: profile.id,
        saleId,
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
      console.error('[M-Pesa STK] Sale not found', { saleId })
      return NextResponse.json(
        { error: 'Sale not found' },
        { status: 404 }
      )
    }

    if (sale.payment_status !== 'pending') {
      console.error('[M-Pesa STK] Sale not in pending state', {
        saleId,
        paymentStatus: sale.payment_status,
      })
      return NextResponse.json(
        { error: 'Sale is not awaiting M-Pesa payment' },
        { status: 400 }
      )
    }

    if (Math.abs(sale.total_amount - amount) > 1) {
      console.error('[M-Pesa STK] Amount mismatch', {
        requested: amount,
        expected: sale.total_amount,
      })
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

    console.log('[M-Pesa STK] Initiating STK Push', {
      rawPhoneNumber: phoneNumber,
      normalizedPhoneNumber,
      amount,
      saleId,
      userId: profile.id,
      branch: profile.branch_id,
      environment: mpesaEnvironment,
      shortcode: paybill,
      accountReference: resolvedAccountReference,
      callbackUrl,
      passkeyPresent: !!passkey,
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
      console.error('[M-Pesa STK] STK Push failed', {
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
      console.error('[M-Pesa STK] Failed to create transaction record')
      await failPendingMpesaSaleWithRestore(
        saleId,
        'Failed to record M-Pesa transaction after sending STK Push'
      )
      return NextResponse.json(
        { error: 'Failed to record M-Pesa transaction' },
        { status: 500 }
      )
    }

    console.log('[M-Pesa STK] STK Push sent successfully', {
      checkoutRequestId: stkResponse.CheckoutRequestID,
      merchantRequestId: stkResponse.MerchantRequestID,
      userId: profile.id,
    })

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
    console.error('[M-Pesa STK] Endpoint error', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
