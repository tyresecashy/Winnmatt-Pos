export interface CashSaveTimingStep {
  name: string
  durationMs: number
}

interface CashSaveTimingSummaryContext {
  saleId?: string | null
  branchId?: string | null
  itemCount?: number
  customerType?: 'named_customer' | 'walk_in'
  [key: string]: unknown
}

export function isCashSaveTimingEnabled() {
  return process.env.CASH_SAVE_TIMING === '1'
}

export function createCashSaveTimingTracker(label: string, enabled: boolean = isCashSaveTimingEnabled()) {
  const startedAt = Date.now()
  const steps: CashSaveTimingStep[] = []

  async function measure<T>(name: string, work: () => Promise<T> | T): Promise<T> {
    if (!enabled) {
      return await work()
    }

    const stepStartedAt = Date.now()
    try {
      return await work()
    } finally {
      const durationMs = Date.now() - stepStartedAt
      steps.push({
        name,
        durationMs,
      })
      console.info(`[CASH_SAVE_TIMING] ${label}.${name} ${durationMs}ms`)
    }
  }

  function record(name: string, durationMs: number) {
    if (!enabled) {
      return
    }

    steps.push({
      name,
      durationMs,
    })
    console.info(`[CASH_SAVE_TIMING] ${label}.${name} ${durationMs}ms`)
  }

  function buildSummary(status: 'success' | 'failure', context: CashSaveTimingSummaryContext = {}) {
    const totalDurationMs = Date.now() - startedAt
    const orderedSteps = [
      ...steps,
      {
        name: 'total_cash_save_path',
        durationMs: totalDurationMs,
      },
    ]

    const slowestStep = steps.reduce<CashSaveTimingStep | null>((currentSlowest, step) => {
      if (!currentSlowest || step.durationMs > currentSlowest.durationMs) {
        return step
      }

      return currentSlowest
    }, null)

    return {
      label,
      status,
      totalDurationMs,
      orderedSteps,
      slowestStep,
      ...context,
    }
  }

  function log(status: 'success' | 'failure', context: CashSaveTimingSummaryContext = {}) {
    if (!enabled) {
      return
    }

    const summary = buildSummary(status, context)
    const logger = status === 'success' ? console.info : console.warn
    logger(`[CASH_SAVE_TIMING] ${label}`, summary)
  }

  return {
    enabled,
    measure,
    record,
    logSuccess: (context?: CashSaveTimingSummaryContext) => log('success', context),
    logFailure: (context?: CashSaveTimingSummaryContext) => log('failure', context),
  }
}
