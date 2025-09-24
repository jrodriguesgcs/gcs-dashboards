import { useMemo, useState } from 'react'

type Node = {
  key: string
  label: string
  metrics?: Record<string, number | string | null>
  children?: Node[]
}

function toCSV(rows: any[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: any) => {
    if (v == null) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n')
}

function flatten(nodes: Node[], parents: string[] = [], rows: any[] = []): any[] {
  for (const n of nodes) {
    const row: any = { level1: parents[0] ?? '', level2: parents[1] ?? '', level3: n.label, ...n.metrics }
    rows.push(row)
    if (n.children?.length) flatten(n.children, [...parents, n.label].slice(-2), rows)
  }
  return rows
}

export default function GroupTable({
  data,
  columns
}: {
  data: Node[]
  columns: { key: string; label: string }[]
}) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set())
  const toggle = (k: string) => {
    const s = new Set(openKeys)
    s.has(k) ? s.delete(k) : s.add(k)
    setOpenKeys(s)
  }
  const expandAll = () => {
    const s = new Set<string>()
    const walk = (ns: Node[]) => ns.forEach(n => { s.add(n.key); if (n.children) walk(n.children) })
    walk(data)
    setOpenKeys(s)
  }
  const collapseAll = () => setOpenKeys(new Set())

  const exportCSV = () => {
    const rows = flatten(data).map(r => ({
      Level1: r.level1, Level2: r.level2, Level3: r.level3,
      ...columns.reduce((acc, c) => (acc[c.label] = r[c.key] ?? '', acc), {} as any)
    }))
    const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const header = (
    <tr>
      <th>Group</th>
      {columns.map(c => <th key={c.key}>{c.label}</th>)}
    </tr>
  )

  const renderRows = (nodes: Node[], depth = 0) => nodes.map(n => {
    const hasChildren = !!n.children?.length
    const open = openKeys.has(n.key)
    return (
      <tbody key={n.key}>
        <tr>
          <td>
            <div style={{paddingLeft: depth*16}}>
              {hasChildren && (
                <button className="btn ghost" onClick={() => toggle(n.key)} aria-expanded={open}>
                  {open ? '▾' : '▸'}
                </button>
              )}
              <span style={{marginLeft:8, fontWeight:600}}>{n.label}</span>
            </div>
          </td>
          {columns.map(c => <td key={c.key}>{n.metrics?.[c.key] ?? ''}</td>)}
        </tr>
        {hasChildren && open && renderRows(n.children!, depth+1)}
      </tbody>
    )
  })

  return (
    <div className="table-wrap">
      <div className="toolbar">
        <button className="btn" onClick={collapseAll}>Collapse all</button>
        <button className="btn" onClick={expandAll}>Expand all</button>
        <button className="btn primary" onClick={exportCSV}>Export CSV</button>
      </div>
      <table>
        <thead>{header}</thead>
        {renderRows(data)}
      </table>
    </div>
  )
}
