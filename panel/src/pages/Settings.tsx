import { useState } from 'react'

import { ConfigSection, useConfig, useSections } from '../components/ConfigForm'
import { ErrorState, Loading, Page, PageHeader, SearchInput } from '../components/ui'

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
                <ConfigSection title={title} fields={list} />
              </div>
            ))}
          </div>
        </div>
      )}
    </Page>
  )
}
