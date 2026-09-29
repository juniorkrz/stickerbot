const pad = (n: number) => String(n).padStart(2, '0')

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export const formatTime = (ts: number) => {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Horário curto para a lista de conversas (hoje: hora; ontem; dia da semana; data)
export const formatChatTime = (ts: number | null) => {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  if (sameDay(d, now)) return formatTime(ts)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(d, yesterday)) return 'Ontem'
  if (now.getTime() - d.getTime() < 6 * 86_400_000) {
    return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export const formatDayLabel = (ts: number) => {
  const d = new Date(ts)
  const now = new Date()
  if (sameDay(d, now)) return 'Hoje'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(d, yesterday)) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export const formatDateTime = (ts: number | null | undefined) => {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${d.toLocaleDateString('pt-BR')} ${formatTime(ts)}`
}

export const formatDate = (ts: number | null | undefined) => (ts ? new Date(ts).toLocaleDateString('pt-BR') : '—')

export const timeAgo = (ts: number | null | undefined) => {
  if (!ts) return '—'
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'agora'
  const m = Math.round(s / 60)
  if (m < 60) return `há ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  if (d < 30) return `há ${d} dia${d > 1 ? 's' : ''}`
  const mo = Math.round(d / 30)
  return `há ${mo} ${mo > 1 ? 'meses' : 'mês'}`
}

export const formatDuration = (seconds: number) => {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

export const formatSeconds = (s?: number) => (s ? `${Math.floor(s / 60)}:${pad(s % 60)}` : '')

export const formatNumber = (n: number) => n.toLocaleString('pt-BR')

export const compactNumber = (n: number) =>
  n >= 10_000 ? new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : formatNumber(n)

export const formatBytes = (n?: number) => {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

// +55 81 99999-9999
export const formatPhone = (phone?: string | null) => {
  if (!phone) return ''
  const d = phone.replace(/\D/g, '')
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4)
    const rest = d.slice(4)
    const split = rest.length === 9 ? 5 : 4
    return `+55 ${ddd} ${rest.slice(0, split)}-${rest.slice(split)}`
  }
  return `+${d}`
}

export const jidUser = (jid?: string | null) => (jid ? jid.split('@')[0].split(':')[0] : '')

export const isGroupJid = (jid: string) => jid.endsWith('@g.us')

// Nome para exibir de um contato: nome salvo > telefone > id
export const displayName = (name?: string | null, phone?: string | null, jid?: string | null) =>
  name || (phone ? formatPhone(phone) : '') || (jid && !jid.endsWith('@lid') ? formatPhone(jidUser(jid)) : jidUser(jid)) || 'Desconhecido'

export const initials = (name: string) => {
  const clean = name.replace(/[^\p{L}\p{N} ]/gu, '').trim()
  if (!clean) return '?'
  const parts = clean.split(/\s+/)
  // Array.from: pega o caractere inteiro (letras "estilizadas" ocupam 2 posições na string)
  const first = (w?: string) => (w ? Array.from(w)[0] : '')
  return (first(parts[0]) + (parts.length > 1 ? first(parts[parts.length - 1]) : '')).toUpperCase()
}

// Cor estável por pessoa (nomes nos grupos, avatares)
const NAME_COLORS = ['#e26b2c', '#2a9d8f', '#b5179e', '#3a86ff', '#8338ec', '#d62828', '#2b9348', '#c77dff', '#0096c7', '#e85d04']
export const colorFor = (key: string) => {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length]
}
