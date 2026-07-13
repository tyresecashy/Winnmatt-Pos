'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check, Receipt, ShoppingBag, Mail, Timer } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { formatKSh } from '@/lib/currency'

interface PaymentSuccessAnimationProps {
  show: boolean
  method: string
  receiptNumber: string
  totalAmount?: number
  taxAmount?: number
  customerEmail?: string
  employeeName?: string
  confirmed: boolean
  onComplete?: () => void
  onViewReceipt?: () => void
  onNewPayment?: () => void
}

function ConfettiParticle({ index, color }: { index: number; color: string }) {
  const [rnd] = useState(() => ({
    angleOffset: Math.random() * 20,
    distance: 80 + Math.random() * 120,
    rotate: Math.random() * 360,
    delay: 0.1 * Math.random(),
  }))
  const angle = (index * 45 + rnd.angleOffset) * (Math.PI / 180)
  const distance = rnd.distance
  const x = Math.cos(angle) * distance
  const y = Math.sin(angle) * distance

  return (
    <motion.div
      className="absolute h-2 w-2 rounded-full"
      style={{ backgroundColor: color, left: '50%', top: '50%' }}
      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
      animate={{
        x,
        y,
        opacity: [1, 0.8, 0],
        scale: [1, 0.5, 0],
        rotate: rnd.rotate,
      }}
      transition={{ duration: 1.2, delay: rnd.delay, ease: 'easeOut' }}
    />
  )
}

const colors = [
  'var(--winnmatt-red)',
  'var(--winnmatt-yellow)',
  'var(--winnmatt-gold)',
  'var(--success)',
  'var(--primary)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
]

/** Small loading dots — … animates as a pulsing trio */
function LoadingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-foreground/60"
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

export function PaymentSuccessAnimation({
  show,
  method,
  receiptNumber,
  totalAmount = 0,
  taxAmount,
  customerEmail,
  employeeName,
  confirmed,
  onComplete,
  onViewReceipt,
  onNewPayment,
}: PaymentSuccessAnimationProps) {
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-dismiss 2.5s after confirmed
  useEffect(() => {
    if (show && confirmed) {
      autoTimerRef.current = setTimeout(() => {
        onComplete?.()
      }, 2500)
      return () => {
        if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
      }
    } else {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
      autoTimerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, confirmed])

  const amountFormatted = formatKSh(totalAmount)
  const [whole, decimal] = amountFormatted.replace('KES ', '').split('.')

  const methodLabel =
    method === 'mpesa' ? 'M-Pesa' :
    method === 'cash' ? 'Cash' :
    'Card'

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Subtle grid background */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '42px 42px',
              maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            }}
          />

          {/* Gradient glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-success/20 blur-3xl rounded-full" />

          {/* Base confetti — fires immediately */}
          {Array.from({ length: 24 }).map((_, i) => (
            <ConfettiParticle key={`base-${i}`} index={i} color={colors[i % colors.length]} />
          ))}

          {/* Extra confetti burst on confirmed */}
          {confirmed && Array.from({ length: 16 }).map((_, i) => (
            <ConfettiParticle key={`burst-${i}`} index={i + 50} color={colors[(i + 4) % colors.length]} />
          ))}

          {/* Phase switcher — crossfade between processing and confirmed */}
          <AnimatePresence mode="wait">
            {!confirmed ? (
              /* ── Phase 1: Processing ─────────────────────────── */
              <motion.div
                key="processing"
                className="relative z-10 w-full max-w-sm mx-4"
                initial={{ scale: 0.85, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.85, opacity: 0, y: 30 }}
                transition={{ type: 'spring', stiffness: 200, damping: 22 }}
              >
                <div className="rounded-3xl border bg-card/90 backdrop-blur-xl p-8 shadow-2xl overflow-hidden">
                  <div className="flex flex-col items-center text-center">

                    {/* Pulsing spinner */}
                    <div className="relative mb-6">
                      <motion.div
                        className="h-20 w-20 rounded-full border-[3px] border-success/30 border-t-success"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: 'conic-gradient(from 0deg, transparent, rgba(52,211,153,0.15), transparent)',
                          filter: 'blur(8px)',
                        }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                      />
                    </div>

                    {/* Processing title */}
                    <motion.p
                      className="text-lg font-semibold text-foreground mb-1"
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.15, duration: 0.3 }}
                    >
                      Processing Payment
                    </motion.p>

                    <motion.div
                      className="mb-4"
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                    >
                      <LoadingDots />
                    </motion.div>

                    {/* Amount */}
                    <motion.p
                      className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-1"
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.25, duration: 0.3 }}
                    >
                      Amount
                    </motion.p>

                    <motion.div
                      className="mb-4"
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3, duration: 0.3 }}
                    >
                      <span className="text-4xl font-bold tracking-tighter text-foreground">
                        {whole}
                        {decimal && <span className="text-2xl opacity-70">.{decimal}</span>}
                      </span>
                    </motion.div>

                    {/* Method */}
                    <motion.div
                      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1"
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.35, duration: 0.3 }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {methodLabel}
                      </span>
                    </motion.div>

                  </div>
                </div>
              </motion.div>
            ) : (
              /* ── Phase 2: Confirmed / Success ────────────────── */
              <motion.div
                key="confirmed"
                className="relative z-10 w-full max-w-sm mx-4"
                initial={{ scale: 0.85, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.85, opacity: 0, y: 30 }}
                transition={{ type: 'spring', stiffness: 200, damping: 22 }}
              >
                <div className="rounded-3xl border bg-card/90 backdrop-blur-xl p-8 shadow-2xl overflow-hidden">
                  <div className="flex flex-col items-center text-center">

                    {/* Animated checkmark */}
                    <div className="relative mb-5">
                      {/* Rotating glow ring */}
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: 'conic-gradient(from 0deg, transparent, rgba(52,211,153,0.3), transparent)',
                          filter: 'blur(10px)',
                        }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                      />
                      {/* Expanding pulse rings */}
                      <motion.div
                        className="absolute -inset-1 rounded-full border-2 border-success/40"
                        initial={{ scale: 0.9, opacity: 0.8 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        transition={{ delay: 0.3, duration: 1, ease: 'easeOut' }}
                      />
                      <motion.div
                        className="absolute -inset-1 rounded-full border-2 border-success/20"
                        initial={{ scale: 0.9, opacity: 0.6 }}
                        animate={{ scale: 1.8, opacity: 0 }}
                        transition={{ delay: 0.6, duration: 1.2, ease: 'easeOut' }}
                      />
                      {/* Checkmark disc */}
                      <motion.div
                        className="relative h-20 w-20 rounded-full bg-gradient-to-br from-success/25 to-success/10 flex items-center justify-center shadow-lg shadow-success/20 border border-success/30"
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.1, type: 'spring', stiffness: 250, damping: 12 }}
                      >
                        <motion.svg
                          width="44"
                          height="44"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-success"
                        >
                          <motion.path
                            d="M20 6L9 17l-5-5"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ delay: 0.3, duration: 0.35, ease: 'easeOut' }}
                          />
                        </motion.svg>
                      </motion.div>
                    </div>

                    {/* Payment approved badge */}
                    <motion.div
                      className="inline-flex items-center gap-1.5 rounded-full bg-success/10 border border-success/20 px-3 py-1 mb-3"
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_6px] shadow-success" />
                      <span className="text-[11px] font-medium text-success-foreground/90">
                        Payment approved
                      </span>
                    </motion.div>

                    {/* Total charged */}
                    <motion.p
                      className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-1"
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.25, duration: 0.3 }}
                    >
                      Total charged
                    </motion.p>

                    <motion.div
                      className="mb-1"
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3, duration: 0.3 }}
                    >
                      <span className="text-5xl font-bold tracking-tighter text-foreground">
                        {whole}
                        {decimal && <span className="text-3xl opacity-70">.{decimal}</span>}
                      </span>
                    </motion.div>

                    {taxAmount !== undefined && (
                      <motion.p
                        className="text-xs text-muted-foreground mb-5"
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.35, duration: 0.3 }}
                      >
                        includes {formatKSh(taxAmount)} tax
                      </motion.p>
                    )}

                    {/* Key-value details */}
                    <motion.div
                      className="w-full space-y-2 text-sm mb-5"
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4, duration: 0.3 }}
                    >
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Method</span>
                        <span className="font-medium">{methodLabel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Receipt</span>
                        <span className="font-mono text-xs">{receiptNumber}</span>
                      </div>
                      {employeeName && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cashier</span>
                          <span>{employeeName}</span>
                        </div>
                      )}
                    </motion.div>

                    {/* Divider */}
                    <motion.div
                      className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent mb-5"
                      initial={{ scaleX: 0, opacity: 0 }}
                      animate={{ scaleX: 1, opacity: 1 }}
                      transition={{ delay: 0.45, duration: 0.4 }}
                    />

                    {/* Action buttons */}
                    <motion.div
                      className="flex items-center gap-3 w-full"
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5, duration: 0.3 }}
                    >
                      <Button
                        variant="outline"
                        className="flex-1 h-11 gap-2"
                        onClick={() => {
                          onViewReceipt?.()
                          onComplete?.()
                        }}
                      >
                        <Receipt className="h-4 w-4" />
                        View Receipt
                      </Button>
                      <Button
                        className="flex-1 h-11 gap-2"
                        onClick={() => {
                          onNewPayment?.()
                          onComplete?.()
                        }}
                      >
                        <ShoppingBag className="h-4 w-4" />
                        New Sale
                      </Button>
                    </motion.div>

                    {/* Email sent note */}
                    {customerEmail && (
                      <motion.div
                        className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground"
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.55, duration: 0.3 }}
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Receipt sent to {customerEmail}
                      </motion.div>
                    )}

                    {/* Timer indicator */}
                    <motion.div
                      className="mt-4 flex items-center gap-1.5 text-[10px] text-muted-foreground/50"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.5, duration: 0.5 }}
                    >
                      <Timer className="h-3 w-3" />
                      Auto-closing...
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
