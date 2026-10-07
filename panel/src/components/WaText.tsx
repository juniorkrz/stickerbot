import { ReactNode } from 'react'

// Renderiza a formatação do WhatsApp: *negrito* _itálico_ ~tachado~ ```mono``` `código`, links e @menções

const TOKEN_RE = new RegExp(
  [
    '```([\\s\\S]+?)```', // 1 bloco mono
    '`([^`\\n]+)`', // 2 código
    '\\*([^*\\n]+)\\*', // 3 negrito
    '(?<![\\p{L}\\p{N}])_([^_\\n]+)_(?![\\p{L}\\p{N}])', // 4 itálico
    '~([^~\\n]+)~', // 5 tachado
    '@(\\d{5,})', // 6 menção
    '(https?:\\/\\/[^\\s<]+[^\\s<.,;:!?)\\]\'"])' // 7 link
  ].join('|'),
  'gu'
)

const renderInline = (text: string, mentionName: (user: string) => string | undefined, keyBase: string): ReactNode[] => {
  const out: ReactNode[] = []
  const re = new RegExp(TOKEN_RE.source, TOKEN_RE.flags)
  let last = 0
  let i = 0
  let match: RegExpExecArray | null

  const plain = (value: string) => {
    value.split('\n').forEach((part, idx) => {
      if (idx > 0) out.push(<br key={`${keyBase}-br-${i++}`} />)
      if (part) out.push(part)
    })
  }

  while ((match = re.exec(text))) {
    if (match.index > last) plain(text.slice(last, match.index))
    const key = `${keyBase}-${i++}`
    if (match[1] !== undefined) {
      out.push(
        <code key={key} className="my-1 block whitespace-pre-wrap rounded bg-black/5 px-1.5 py-1 font-mono text-[13px] dark:bg-white/5">
          {match[1]}
        </code>
      )
    } else if (match[2] !== undefined) {
      out.push(<code key={key} className="rounded bg-black/5 px-1 font-mono text-[13px] dark:bg-white/10">{match[2]}</code>)
    } else if (match[3] !== undefined) {
      out.push(<strong key={key} className="font-semibold">{renderInline(match[3], mentionName, key)}</strong>)
    } else if (match[4] !== undefined) {
      out.push(<em key={key}>{renderInline(match[4], mentionName, key)}</em>)
    } else if (match[5] !== undefined) {
      out.push(<s key={key}>{renderInline(match[5], mentionName, key)}</s>)
    } else if (match[6] !== undefined) {
      out.push(<span key={key} className="font-medium text-info">@{mentionName(match[6]) || match[6]}</span>)
    } else if (match[7] !== undefined) {
      out.push(
        <a key={key} href={match[7]} target="_blank" rel="noreferrer noopener"
          className="break-all text-info underline-offset-2 hover:underline">
          {match[7]}
        </a>
      )
    }
    last = re.lastIndex
  }
  if (last < text.length) plain(text.slice(last))
  return out
}

export const WaText = ({ text, mentionName }: { text: string, mentionName?: (user: string) => string | undefined }) => (
  <>{renderInline(text, mentionName || (() => undefined), 't')}</>
)
