import { NextRequest } from 'next/server'
import { subscribeAll } from '@/lib/realtime/event-bus'
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req)
  if (!authResult.success) {
    return unauthorizedResponse(authResult.error)
  }

  const allowedKeys: (keyof typeof req.nextUrl.searchParams)[] = []
  const typesParam = req.nextUrl.searchParams.get('types')
  let filterTypes: Set<string> | null = null
  if (typesParam) {
    filterTypes = new Set(typesParam.split(',').map(t => t.trim()).filter(Boolean))
  }

  let cleanup: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      const profile = authResult.profile!
      controller.enqueue(`event: connected\ndata: ${JSON.stringify({ profileId: profile.id, role: profile.role })}\n\n`)

      cleanup = subscribeAll((event) => {
        if (filterTypes && !filterTypes.has(event.type)) return
        const data = JSON.stringify(event)
        controller.enqueue(`event: ${event.type}\ndata: ${data}\n\n`)
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
