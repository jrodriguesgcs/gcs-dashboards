import { useMemo, useState } from 'react'

export default function MultiSelect({
  label, options, value, onChange
}: {
  label: string
  options: string[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [term, setTerm] = useState('')
  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase()
    return options.filter(o => o.toLowerCase().includes(t))
  }, [term, options])

  const allSelected = value.length === options.length
  const toggle = (opt: string) => {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  }

  return (
    <div className="card pad" style={{display:'grid', gap:8}}>
      <div className="fs-text-sm fw-semibold">{label}</div>
      <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
        <button className="btn ghost" onClick={() => onChange(options)}>Select all</button>
        <button className="btn ghost" onClick={() => onChange([])}>Unselect all</button>
        <input className="btn" placeholder="Search…" value={term} onChange={e => setTerm(e.target.value)} />
        <div className="fs-text-sm" style={{marginLeft:'auto'}}>{value.length}/{options.length} selected</div>
      </div>
      <div className="table-wrap" style={{maxHeight:220, overflow:'auto'}}>
        <table>
          <tbody>
          {filtered.map(opt => (
            <tr key={opt}>
              <td style={{width:36}}><input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)} /></td>
              <td>{opt}</td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td>No options</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
