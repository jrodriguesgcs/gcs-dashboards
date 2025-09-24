// Robust parsing for 'YYYY-MM-DD HH:MM:SS', ISO, and 'MM/DD/YYYY HH:MM'
const parse = (s?: string | null): Date | null => {
  if (!s) return null
  const t = s.trim()

  // Try ISO or "YYYY-MM-DD HH:MM:SS"
  {
    const isoish = t.includes(' ') ? t.replace(' ', 'T') : t
    const d = new Date(isoish)
    if (!Number.isNaN(d.getTime())) return d
  }

  // Try MM/DD/YYYY HH:MM
  {
    const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})/)
    if (m) {
      const [, mm, dd, yyyy, HH, MM] = m.map(Number)
      const d = new Date(Date.UTC(yyyy, mm - 1, dd, HH, MM))
      if (!Number.isNaN(d.getTime())) return d
    }
  }
  return null
}

export const diffMinutes = (start?: string | null, end?: string | null): number | null => {
  const a = parse(start), b = parse(end)
  if (!a || !b) return null
  const delta = (b.getTime() - a.getTime()) / 60000
  return delta >= 0 ? Math.round(delta) : null
}

export const diffDays = (start?: string | null, end?: string | null): number | null => {
  const a = parse(start), b = parse(end)
  if (!a || !b) return null
  const delta = (b.getTime() - a.getTime()) / 86400000
  return delta >= 0 ? Number(delta.toFixed(2)) : null
}

export const createdDOW = (s?: string | null): string | null => {
  const d = parse(s); return d ? d.toLocaleDateString('en-US', { weekday: 'long' }) : null
}

export const createdHour = (s?: string | null): number | null => {
  const d = parse(s); return d ? d.getUTCHours() : null
}
