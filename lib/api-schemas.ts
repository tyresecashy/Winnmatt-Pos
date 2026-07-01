import { z } from 'zod'

// ── Price approve ──
export const priceApproveActionSchema = z.enum(['approve', 'correct', 'protect'])
export const priceApproveSchema = z.object({
  action: priceApproveActionSchema,
  productId: z.string().uuid(),
  newSellingPrice: z.number().positive().optional(),
  newPurchasePrice: z.number().positive().optional(),
  reason: z.string().max(500).optional(),
  protectionLevel: z.string().max(50).optional(),
})

// ── M-PESA STK Push ──
export const stkPushSchema = z.object({
  saleId: z.string().uuid(),
  phoneNumber: z.string().regex(/^(254|0)\d{9}$/, 'Invalid Kenyan phone number'),
  amount: z.number().int().positive().max(150000),
  accountReference: z.string().optional(),
})

// ── M-PESA Status ──
export const mpesaStatusSchema = z.object({
  checkoutRequestId: z.string().min(1),
})

// ── M-PESA Callback ──
export const mpesaCallbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string(),
      CheckoutRequestID: z.string(),
      ResultCode: z.number().int(),
      ResultDesc: z.string(),
      CallbackMetadata: z.object({
        Item: z.array(z.object({
          Name: z.string(),
          Value: z.unknown().optional(),
        })),
      }).optional(),
    }),
  }),
})
