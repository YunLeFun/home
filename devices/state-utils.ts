// Coercion helpers shared by plugin state machines.

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

/**
 * Clamp a finite number into a range.
 *
 * @param value - Candidate value
 * @param fallback - Value used when the candidate is not a finite number
 * @param min - Lower bound
 * @param max - Upper bound
 * @returns The clamped number or the fallback
 */
export function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value === 'number' && Number.isFinite(value))
    return Math.min(max, Math.max(min, value))
  return fallback
}

export function normalizeDate(value: unknown, fallback = new Date().toISOString()): string {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value)))
    return new Date(value).toISOString()
  return fallback
}

export function normalizeNullableDate(value: unknown): string | null {
  if (value === null)
    return null
  return normalizeDate(value, '') || null
}

/**
 * Turn an auto-off delay into an absolute timestamp.
 *
 * @param minutes - Delay in minutes, clamped to one day; `null` clears the timer
 * @param now - Reference ISO timestamp
 * @returns The auto-off ISO timestamp, or `null`
 */
export function timerDate(minutes: number | null, now: string): string | null {
  return minutes === null ? null : new Date(Date.parse(now) + Math.min(1440, Math.max(0, minutes)) * 60_000).toISOString()
}

export function isValidTimerMinutes(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1440)
}
