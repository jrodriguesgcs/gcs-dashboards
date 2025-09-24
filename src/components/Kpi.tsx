export function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card pad" style={{display:'grid', gap:6}}>
      <div className="fs-text-sm muted">{label}</div>
      <div className="fs-display-sm fw-bold">{value ?? '-'}</div>
      {hint && <div className="fs-text-xs muted">{hint}</div>}
    </div>
  )
}
