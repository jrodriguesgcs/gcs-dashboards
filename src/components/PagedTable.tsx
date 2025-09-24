import { useMemo, useState } from 'react'

export default function PagedTable({
  rows, columns, pageSize = 100
}: {
  rows: any[]
  columns: { key: string; label: string }[]
  pageSize?: number
}) {
  const [page, setPage] = useState(1)
  const total = rows.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const view = useMemo(() => rows.slice((page-1)*pageSize, page*pageSize), [rows, page, pageSize])

  return (
    <div className="table-wrap">
      <div className="toolbar">
        <span className="muted fs-text-sm">Rows { (page-1)*pageSize+1 }–{ Math.min(page*pageSize,total) } of { total }</span>
        <div style={{marginLeft:'auto', display:'flex', gap:8}}>
          <button className="btn" disabled={page<=1} onClick={()=>setPage(1)}>⏮</button>
          <button className="btn" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>◀</button>
          <span className="fs-text-sm">Page {page}/{pages}</span>
          <button className="btn" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>▶</button>
          <button className="btn" disabled={page>=pages} onClick={()=>setPage(pages)}>⏭</button>
        </div>
      </div>
      <table>
        <thead>
          <tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {view.map((r,i) => (
            <tr key={i}>{columns.map(c => <td key={c.key}>{r[c.key]}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
