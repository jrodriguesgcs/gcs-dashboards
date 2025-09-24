import { DateTime } from 'luxon'

// Parse to a UTC ISO string, trying several common formats.
// We avoid passing the 3rd "options" argument to satisfy TS types across Luxon versions.
export function parseToUTCISO(s?: string | null): string | null {
  if (!s) return null
  const t = s.trim()

  const candidates = [
    // ISO first (accepts offsets like Z or +00:00)
    () => DateTime.fromISO(t),
    // "YYYY-MM-DD HH:mm:ss"
    () => DateTime.fromFormat(t, "yyyy-MM-dd HH:mm:ss"),
    // "MM/DD/YYYY HH:mm"
    () => DateTime.fromFormat(t, "MM/dd/yyyy HH:mm"),
    // plain date
    () => DateTime.fromFormat(t, "yyyy-MM-dd")
  ]

  for (const make of candidates) {
    const dt = make()
    if (dt.isValid) return dt.toUTC().toISO()
  }
  return null
}

const LISBON = 'Europe/Lisbon'

export function diffMinutes(start?: string|null, end?: string|null): number|null {
  const a = parseToUTCISO(start), b = parseToUTCISO(end)
  if (!a || !b) return null
  const da = DateTime.fromISO(a), db = DateTime.fromISO(b)
  const delta = db.diff(da, 'minutes').minutes
  return delta >= 0 ? Math.round(delta) : null
}

export function diffDays(start?: string|null, end?: string|null): number|null {
  const a = parseToUTCISO(start), b = parseToUTCISO(end)
  if (!a || !b) return null
  const da = DateTime.fromISO(a), db = DateTime.fromISO(b)
  const delta = db.diff(da, 'days').days
  return delta >= 0 ? Number(delta.toFixed(2)) : null
}

export function createdDOW(s?: string|null): string|null {
  const iso = parseToUTCISO(s); if (!iso) return null
  return DateTime.fromISO(iso).setZone(LISBON).toFormat('cccc') // Monday, Tuesday…
}

export function createdHour(s?: string|null): number|null {
  const iso = parseToUTCISO(s); if (!iso) return null
  return DateTime.fromISO(iso).setZone(LISBON).hour
}

// Month key YYYY-MM computed in Lisbon zone
export function monthKey(s?: string|null): string|null {
  const iso = parseToUTCISO(s); if (!iso) return null
  return DateTime.fromISO(iso).setZone(LISBON).toFormat('yyyy-LL')
}
