import { useMemo, useState } from 'react'
import { toCsvAndDownload } from '../utils/csv'

type Node = {
  key: string
  label: string
  metrics?: Record<string, number>
  children?: Node[]
}

export default function TreeTable({
  title, root, columns
}: {
  title: string
  root: Node[]
  columns: { key:string; label:string }[]
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const allKeys = useMemo(() => {
    const acc:string[] = []
    const walk = (n:Node[]) => n.forEach(x=>{ acc.push(x.key); if (x.children) walk(x.children) })
    walk(root)
    return acc
  }, [root])
  const expandAll = () => {
    const next:Record<string,boolean> = {}
    allKeys.forEach(k => next[k] = true)
    setOpen(next)
  }
  const collapseAll = () => setOpen({})

  const flattenForCsv = () => {
    const rows:any[] = []
    const walk = (nodes:Node[], path:string[]) => {
      for (const n of nodes) {
        const row:any = {}
        path.forEach((p,i)=>row[`level_${i+1}`] = p)
        row[`level_${path.length+1}`] = n.label
        if (n.metrics) for (const [k,v] of Object.entries(n.metrics)) row[k] = v
        rows.push(row)
        if (n.children?.length) walk(n.children, [...path, n.label])
      }
    }
    walk(root, [])
    toCsvAndDownload(rows, title)
  }

  const render = (nodes:Node[], depth=0) => nodes.map(n => {
    const hasChildren = !!(n.children && n.children.length)
    const isOpen = open[n.key] ?? false
    return (
      <tbody key={n.key}>
        <tr>
          <td style={{paddingLeft: depth*16 + 12}}>
            {hasChildren && (
              <button className="btn" onClick={()=>setOpen(o=>({...o, [n.key]: !isOpen}))} style={{marginRight:8}}>
                {isOpen ? '−' : '+'}
              </button>
            )}
            <strong>{n.label}</strong>
          </td>
          {columns.map(c => <td key={c.key}>{n.metrics?.[c.key] ?? 0}</td>)}
        </tr>
        {hasChildren && isOpen ? render(n.children!, depth+1) : null}
      </tbody>
    )
  })

  return (
    <div className="table-card">
      <div className="controls" style={{justifyContent:'space-between', padding:'8px 12px'}}>
        <div className="fs-text-sm" style={{opacity:.75}}>{title}</div>
        <div className="controls">
          <button className="btn" onClick={expandAll}>Expand all</button>
          <button className="btn" onClick={collapseAll}>Collapse all</button>
          <button className="btn" onClick={flattenForCsv}>Export CSV</button>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Group</th>
            {columns.map(c => <th key={c.key}>{c.label}</th>)}
          </tr>
        </thead>
        {render(root)}
      </table>
    </div>
  )
}
