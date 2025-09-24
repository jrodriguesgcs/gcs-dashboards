import { useMemo, useState } from 'react'

export type Column = { key: string; label?: string; format?: (v: any, row: any) => string }

export default function DataTable({
  rows,
  columns,
  loading
}: { rows: any[]; columns?: Column[]; loading?: boolean }) {
  const cols = useMemo(() => {
    if (columns?.length) return columns
    const keys = rows[0] ? Object.keys(rows[0]) : []
    return keys.map(k => ({ key: k, label: k }))
  }, [columns, rows])

  const [sortKey, setSortKey] = useState<string | null>(null)
  const [asc, setAsc] = useState(true)
  const sorted = useMemo(() => {
    if (!sortKey) return rows
    const r = [...rows].sort((a, b) =>
      (a[sortKey!] ?? '') > (b[sortKey!] ?? '') ? 1 : (a[sortKey!] ?? '') < (b[sortKey!] ?? '') ? -1 : 0
    )
    return asc ? r : r.reverse()
  }, [rows, sortKey, asc])

  return (
    <div className="table-card">
      {loading && <div className="loading">Loading…</div>}
      <table>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key}
                  onClick={() => { setAsc(sortKey === c.key ? !asc : true); setSortKey(c.key) }}>
                {c.label ?? c.key}
                {sortKey === c.key ? (asc ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i}>
              {cols.map(c => (
                <td key={c.key}>
                  {c.format ? c.format(row[c.key], row) : row[c.key] as any}
                </td>
              ))}
            </tr>
          ))}
          {!loading && sorted.length === 0 && (
            <tr><td colSpan={cols.length} style={{textAlign:'center', padding:'16px'}}>No data</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
