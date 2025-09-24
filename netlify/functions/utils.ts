export const OWNER_ALLOW = [
  'Patrick de Novais','Joe Rice','Willyan Telles','Stefani da Rosa',
  'Nina Patrikyan','Jelena Sivcev','Gabriela Quevedo','Sean Spencer','Alisa Nazaryeva'
]

export const SDR_FIELD = '--- SDR AGENT --- REQUIRED FIELD ---'
export const COUNTRY_FIELD = 'Primary Country of Interest'
export const PROGRAM_FIELD = 'Primary Program of Interest'

export function containsAny(hay: string, list: string[]) {
  const s = (hay||'').toLowerCase()
  return list.some(x => s.includes(x.toLowerCase()))
}

export function pct(a: number, b: number) {
  return b > 0 ? Math.round((a/b)*1000)/10 : 0
}

export function avg(arr: number[]) {
  if (!arr.length) return null
  return Math.round((arr.reduce((a,b)=>a+b,0)/arr.length)*100)/100
}
export function median(arr: number[]) {
  if (!arr.length) return null
  const s = [...arr].sort((a,b)=>a-b)
  const mid = Math.floor(s.length/2)
  const val = s.length % 2 ? s[mid] : (s[mid-1]+s[mid])/2
  return Math.round(val*100)/100
}
export function topModes(arr: number[], top=3) {
  if (!arr.length) return ''
  const map = new Map<number, number>()
  for (const v of arr) map.set(v, (map.get(v)||0) + 1)
  return [...map.entries()]
    .sort((a,b)=> b[1]-a[1] || a[0]-b[0])
    .slice(0, top)
    .map(([v,c]) => `${Number(v.toFixed(2))} (${c})`).join(', ')
}

export function maskEmail(email?: string|null) {
  if (!email) return '(not set)'
  const m = email.split('@')
  if (m.length !== 2) return '(not set)'
  const [u, d] = m
  if (!u.length) return '(not set)'
  return `${u[0]}***@${d}`
}

// UTM normalization (NOT for CPC/PPC)
const TOP_LEVEL = new Set(['organic','social','cpc','ppc','redirect','referrer','email','(not set)'])
export function normalizeUTM(medium?: string|null, source?: string|null) {
  let med = (medium||'(not set)').toLowerCase().trim()
  let src = (source||'(not set)').toLowerCase().trim()

  const isPaid = med.includes('cpc') || med.includes('ppc') || src.includes('cpc') || src.includes('ppc')
  if (!isPaid) {
    const setSocial = (s: string) => { med = 'social'; src = s }
    if (med.includes('facebook') || src.includes('facebook') || med.includes('meta') || src.includes('meta')) setSocial('facebook')
    else if (med.includes('instagram') || src.includes('instagram')) setSocial('instagram')
    else if (med.includes('linkedin') || src.includes('linkedin')) setSocial('linkedin')
    else if (med.includes('youtube') || src.includes('youtube')) setSocial('youtube')
    else if (med.includes('newsletter')) { med = 'email'; src = 'newsletter' }
    else if (src.includes('all channels')) { med = 'social'; src = 'all channels' }
    else if (src.includes('globalcitizensolutions')) { med = 'redirect' /* src unchanged */ }
  }

  if (!TOP_LEVEL.has(med)) med = 'other'
  return { utm_medium: med, utm_source: src }
}
