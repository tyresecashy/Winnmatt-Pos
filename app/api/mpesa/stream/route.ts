import { NextRequest } from 'next/server'
import { subscribeEvent } from '@/lib/mpesa-events'
import { logger } from '@/lib/logger'
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Auth guard — same pattern as /api/events/stream
  const authResult = await authenticateRequest(req)
  if (!authResult) return unauthorizedResponse()

  const checkoutRequestId = req.nextUrl.searchParams.get('checkoutRequestId')

  if (!checkoutRequestId) {
    return new Response('Missing checkoutRequestId', { status: 400 })
  }

  let cleanup: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(`event: connected\ndata: ${JSON.stringify({ checkoutRequestId })}\n\n`)

      cleanup = subscribeEvent(checkoutRequestId, (event) => {
        const data = JSON.stringify(event)
        controller.enqueue(`event: ${event.type}\ndata: ${data}\n\n`)
        cleanup?.()
        controller.close()
      })

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(`: heartbeat\n\n`)
        } catch {
          clearInterval(heartbeat)
        }
      }, 30000)

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        cleanup?.()
      })
    },
    cancel() {
      cleanup?.()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
