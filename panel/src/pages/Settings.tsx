import { CheckCircle2, CircleAlert, PlugZap } from 'lucide-react'
import { useState } from 'react'


import { ConfigSection, useConfig, useSections } from '../components/ConfigForm'
import { Button, ErrorState, Loading, Page, PageHeader, SearchInput } from '../components/ui'
import { post } from '../lib/api'

interface MpTest {
  ok: boolean
  error?: string
  account?: string
  email?: string
  production?: boolean
  webhookSecret?: boolean
  notificationUrl?: string | null
}

// Botão "Testar credenciais" da seção do Mercado Pago
const MercadoPagoTest = () => {
  const [result, setResult] = useState<MpTest | null>(null)
  const [loading, setLoading] = useState(false)
  const test = async () => {
    setLoading(true)
    try {
      setResult(await post<MpTest>('/config/mercadopago/test'))
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'Erro' })
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="mt-5 rounded-lg border border-border bg-surface-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-text-2">Depois de salvar o token, teste se o Mercado Pago aceita.</div>
        <Button size="sm" variant="outline" loading={loading} icon={<PlugZap className="size-4" />} onClick={test}>Testar credenciais</Button>
      </div>
      {result && (
        result.ok ? (
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex items-center gap-2 text-accent"><CheckCircle2 className="size-4" /> Conectado à conta <b>{result.account}</b> ({result.email})</div>
            {!result.production && <div className="text-warning">⚠ Este é um token de teste: os PIX gerados não recebem dinheiro de verdade.</div>}
            <div className="text-text-3">Webhook: {result.notificationUrl || 'sem URL pública — o bot confere os PIX pendentes a cada minuto'}
              {result.webhookSecret ? ' · assinatura configurada' : ''}</div>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 text-sm text-danger"><CircleAlert className="size-4" /> {result.error}</div>
        )
      )}
    </div>
  )
}

// Seções que têm tela própria
const ELSEWHERE = new Set(['Privacidade do WhatsApp'])

export default function SettingsPage() {
  const query = useConfig()
  const [search, setSearch] = useState('')
  const s = search.toLowerCase()
  const fields = (query.data || []).filter(f => !ELSEWHERE.has(f.section) &&
    (!s || f.label.toLowerCase().includes(s) || (f.help || '').toLowerCase().includes(s) || f.section.toLowerCase().includes(s)))
  const sections = useSections(fields)

  return (
    <Page>
      <PageHeader title="Configurações" subtitle="Tudo que antes ficava nas variáveis de ambiente. Salvo no banco, vale na hora (exceto onde indicado)."
        actions={<SearchInput value={search} onChange={setSearch} placeholder="Buscar configuração" className="w-72" />} />
      {query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : (
        <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
          <nav className="hidden lg:block">
            <ul className="sticky top-4 space-y-0.5">
              {sections.map(([title]) => (
                <li key={title}>
                  <a href={`#sec-${title}`} onClick={e => { e.preventDefault(); document.getElementById(`sec-${title}`)?.scrollIntoView({ behavior: 'smooth' }) }}
                    className="block rounded-lg px-3 py-1.5 text-sm text-text-2 hover:bg-surface-2 hover:text-text">{title}</a>
                </li>
              ))}
              <li><a href="/painel/perfil" className="block rounded-lg px-3 py-1.5 text-sm text-text-2 hover:bg-surface-2 hover:text-text">Privacidade (Perfil) →</a></li>
            </ul>
          </nav>
          <div className="space-y-5">
            {sections.map(([title, list]) => (
              <div key={title} id={`sec-${title}`} className="scroll-mt-4">
                <ConfigSection title={title} fields={list} extra={title === 'VIP e pagamentos' ? <MercadoPagoTest /> : undefined} />
              </div>
            ))}
          </div>
        </div>
      )}
    </Page>
  )
}
