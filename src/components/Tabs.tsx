import { ReactNode, useState } from 'react'

export function Tabs({ tabs }: { tabs: { key: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key)
  return (
    <div>
      <div className="switcher" role="tablist" aria-label="dashboard sections">
        {tabs.map(t => (
          <button
            key={t.key}
            className={'switch-btn' + (active === t.key ? ' active' : '')}
            onClick={() => setActive(t.key)}
            role="tab"
            aria-selected={active === t.key}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="card pad" role="tabpanel">
        {tabs.find(t => t.key === active)?.content}
      </div>
    </div>
  )
}
