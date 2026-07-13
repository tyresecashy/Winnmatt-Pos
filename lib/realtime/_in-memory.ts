import type { RealtimeEvent } from './types'

type EventCallback = (event: RealtimeEvent) => void

const subscribers = new Map<string, Set<EventCallback>>()
const wildcardSubscribers = new Set<EventCallback>()

const TTL_MS = 5 * 60 * 1000
const recentEvents = new Map<string, RealtimeEvent>()

export function getKey(event: RealtimeEvent): string {
  return `${event.type}:${event.entityId || event.timestamp}`
}

export function publish(event: RealtimeEvent) {
  const key = getKey(event)
  recentEvents.set(key, event)
  setTimeout(() => recentEvents.delete(key), TTL_MS)

  const subs = subscribers.get(event.type)
  if (subs) {
    subs.forEach(cb => {
      try { cb(event) } catch { /* swallow */ }
    })
  }

  wildcardSubscribers.forEach(cb => {
    try { cb(event) } catch { /* swallow */ }
  })
}

export function subscribe(
  type: string,
  callback: EventCallback
): () => void {
  const key = type

  const existing = recentEvents.get(key)
  if (existing) {
    callback(existing)
    return () => {}
  }

  if (!subscribers.has(key)) {
    subscribers.set(key, new Set())
  }
  subscribers.get(key)!.add(callback)

  return () => {
    subscribers.get(key)?.delete(callback)
    if (subscribers.get(key)?.size === 0) {
      subscribers.delete(key)
    }
  }
}

export function subscribeAll(callback: EventCallback): () => void {
  wildcardSubscribers.add(callback)
  return () => { wildcardSubscribers.delete(callback) }
}

export function matchEvents(types: string[]): RealtimeEvent[] {
  const results: RealtimeEvent[] = []
  const typeSet = new Set(types)
  for (const event of recentEvents.values()) {
    if (typeSet.has(event.type)) {
      results.push(event)
    }
  }
  return results
}
