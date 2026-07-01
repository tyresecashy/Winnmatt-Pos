import { describe, it, expect } from 'vitest'

/**
 * Basic check that CSV escapes are handled when string values contain
 * commas, quotes, or newlines.
 */
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

describe('CSV field escaping', () => {
  it('returns plain string unchanged', () => {
    expect(escapeCsvField('hello')).toBe('hello')
  })

  it('wraps values containing commas', () => {
    expect(escapeCsvField('hello, world')).toBe('"hello, world"')
  })

  it('doubles embedded quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""')
  })

  it('wraps values with newlines', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
  })

  it('returns empty string for null', () => {
    expect(escapeCsvField(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(escapeCsvField(undefined)).toBe('')
  })

  it('converts numbers to strings', () => {
    expect(escapeCsvField(42)).toBe('42')
  })
})
