export function toCSV(rows: any[]): string {
  if (!rows?.length) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: any) => {
    if (v == null) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s
  }
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))]
  return lines.join('\n')
}

export function downloadCSV(filename: string, rows: any[]) {
  const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
