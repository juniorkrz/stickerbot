import clsx from 'clsx'
import {
  Ban,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  Copy,
  Download,
  Eye,
  FileText,
  MapPin,
  Pencil,
  Reply,
  SmilePlus,
  Trash2,
  User
} from 'lucide-react'
import { memo, ReactNode, useEffect, useRef, useState } from 'react'

import { mediaUrl } from '../../lib/api'
import { colorFor, displayName, formatBytes, formatPhone, formatSeconds, formatTime, jidUser } from '../../lib/format'
import type { Message } from '../../lib/types'
import { WaText } from '../WaText'

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

export interface BubbleContext {
  isGroup: boolean
  names: Record<string, string>
  admins: Record<string, string>
  canDeleteOthers: boolean
  onReply: (m: Message) => void
  onReact: (m: Message, emoji: string) => void
  onDelete: (m: Message) => void
  onJump: (id: string) => void
  onOpenMedia: (m: Message) => void
  onCopy: (text: string) => void
}

const StatusIcon = ({ status, pending }: { status: number, pending?: boolean }) => {
  if (pending || status <= 1) return <Clock className="size-3.5" />
  if (status === 2) return <Check className="size-4" />
  return <CheckCheck className={clsx('size-4', status >= 4 && 'text-[#53bdeb]')} />
}

export const senderName = (m: Message, names: Record<string, string>) =>
  (m.sender && names[m.sender]) || m.pushName || displayName(null, m.senderPhone, m.sender)

const MediaFallback = ({ label }: { label: string }) => (
  <div className="flex h-24 w-60 max-w-full items-center justify-center rounded-md bg-black/5 text-xs text-bubble-meta dark:bg-white/5">{label}</div>
)

const ImageMedia = ({ m, onOpen, sticker }: { m: Message, onOpen: () => void, sticker?: boolean }) => {
  const [failed, setFailed] = useState(false)
  if (!m.hasMedia || failed) return <MediaFallback label={failed ? 'Mídia indisponível' : sticker ? 'Figurinha' : 'Foto'} />
  const w = m.meta.width || 300
  const h = m.meta.height || 300
  const maxW = sticker ? 150 : 320
  const ratio = Math.min(1, maxW / w)
  return (
    <button onClick={onOpen} className="block overflow-hidden rounded-md" style={sticker ? undefined : { maxWidth: maxW }}>
      <img
        src={mediaUrl(m.jid, m.id)}
        loading="lazy"
        alt=""
        onError={() => setFailed(true)}
        className={clsx(sticker ? 'size-[150px] object-contain' : 'block h-auto w-full object-cover')}
        style={sticker ? undefined : { aspectRatio: `${w} / ${h}`, maxHeight: 420, width: Math.round(w * ratio) }}
      />
    </button>
  )
}

const VideoMedia = ({ m, gif }: { m: Message, gif?: boolean }) => {
  const [show, setShow] = useState(gif)
  if (!m.hasMedia) return <MediaFallback label="Vídeo" />
  if (!show) {
    return (
      <button onClick={() => setShow(true)} className="flex h-40 w-64 max-w-full flex-col items-center justify-center gap-1 rounded-md bg-black/70 text-white">
        <span className="text-3xl">▶</span>
        <span className="text-xs">{formatSeconds(m.meta.seconds) || 'Vídeo'} · toque para carregar</span>
      </button>
    )
  }
  return gif
    ? <video src={mediaUrl(m.jid, m.id)} autoPlay loop muted playsInline className="max-h-80 max-w-[320px] rounded-md" />
    : <video src={mediaUrl(m.jid, m.id)} controls autoPlay playsInline className="max-h-96 max-w-[320px] rounded-md bg-black" />
}

const AudioMedia = ({ m }: { m: Message }) => {
  if (!m.hasMedia) return <MediaFallback label="Áudio" />
  return (
    <div className="flex w-72 max-w-full items-center gap-2">
      {m.type === 'ptt' && <span className="text-lg">🎤</span>}
      <audio src={mediaUrl(m.jid, m.id)} controls preload="none" className="h-10 w-full" />
    </div>
  )
}

const DocumentMedia = ({ m }: { m: Message }) => (
  <a
    href={m.hasMedia ? mediaUrl(m.jid, m.id, true) : undefined}
    target="_blank"
    rel="noreferrer"
    className="flex w-72 max-w-full items-center gap-3 rounded-md bg-black/5 p-3 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
  >
    <FileText className="size-8 shrink-0 text-bubble-meta" />
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-medium">{m.meta.fileName || 'Documento'}</div>
      <div className="text-xs text-bubble-meta">
        {[m.meta.mimetype?.split('/')[1]?.toUpperCase(), formatBytes(m.meta.fileLength)].filter(Boolean).join(' · ')}
      </div>
    </div>
    {m.hasMedia && <Download className="size-4 shrink-0 text-bubble-meta" />}
  </a>
)

const Body = ({ m, ctx }: { m: Message, ctx: BubbleContext }) => {
  const mentionName = (user: string) => {
    const hit = Object.entries(ctx.names).find(([jid]) => jidUser(jid) === user)
    return hit?.[1] || (user.length >= 12 && user.length <= 13 ? formatPhone(user) : undefined)
  }
  const caption = m.text ? <div className="mt-1 whitespace-pre-wrap break-words"><WaText text={m.text} mentionName={mentionName} /></div> : null

  if (m.deleted) {
    return <span className="flex items-center gap-1.5 italic text-bubble-meta"><Ban className="size-4" /> Mensagem apagada</span>
  }
  switch (m.type) {
  case 'text':
  case 'unknown':
    return <div className="whitespace-pre-wrap break-words"><WaText text={m.text || ''} mentionName={mentionName} /></div>
  case 'image':
    return <><ImageMedia m={m} onOpen={() => ctx.onOpenMedia(m)} />{caption}</>
  case 'sticker':
    return <ImageMedia m={m} sticker onOpen={() => ctx.onOpenMedia(m)} />
  case 'video':
    return <><VideoMedia m={m} />{caption}</>
  case 'gif':
    return <><VideoMedia m={m} gif />{caption}</>
  case 'audio':
  case 'ptt':
    return <AudioMedia m={m} />
  case 'document':
    return <><DocumentMedia m={m} />{caption}</>
  case 'location':
    return (
      <a target="_blank" rel="noreferrer" className="flex items-center gap-2 text-info hover:underline"
        href={`https://www.google.com/maps?q=${m.meta.latitude},${m.meta.longitude}`}>
        <MapPin className="size-5" /> {m.text || 'Localização'}
      </a>
    )
  case 'contact':
    return <span className="flex items-center gap-2"><User className="size-5 text-bubble-meta" />{m.meta.name || 'Contato'}</span>
  case 'poll':
    return (
      <div className="min-w-56">
        <div className="mb-2 font-medium">📊 {m.text}</div>
        <ul className="space-y-1">
          {(m.meta.options || []).map((o, i) => <li key={i} className="rounded border border-black/10 px-2 py-1 text-sm dark:border-white/10">{o}</li>)}
        </ul>
      </div>
    )
  case 'viewonce':
    return <span className="flex items-center gap-1.5 italic text-bubble-meta"><Eye className="size-4" /> Visualização única (abra no celular)</span>
  default:
    return <span className="italic text-bubble-meta">[{m.type}]</span>
  }
}

const Menu = ({ m, ctx, onClose, alignRight }: { m: Message, ctx: BubbleContext, onClose: () => void, alignRight: boolean }) => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])
  const item = (icon: ReactNode, label: string, action: () => void, danger?: boolean) => (
    <button
      onClick={() => { action(); onClose() }}
      className={clsx('flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-surface-2', danger ? 'text-danger' : 'text-text')}
    >
      {icon}{label}
    </button>
  )
  const canDelete = !m.deleted && (m.fromMe || ctx.canDeleteOthers)
  return (
    <div ref={ref} className={clsx('animate-fade-in absolute top-6 z-20 w-52 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-card',
      alignRight ? 'right-0' : 'left-0')}>
      <div className="flex justify-between border-b border-border px-2 pb-1">
        {QUICK_REACTIONS.map(e => (
          <button key={e} onClick={() => { ctx.onReact(m, e); onClose() }} className="rounded-full p-1.5 text-lg hover:bg-surface-2">{e}</button>
        ))}
      </div>
      {item(<Reply className="size-4" />, 'Responder', () => ctx.onReply(m))}
      {m.text && item(<Copy className="size-4" />, 'Copiar texto', () => ctx.onCopy(m.text || ''))}
      {m.hasMedia && item(<Download className="size-4" />, 'Baixar', () => window.open(mediaUrl(m.jid, m.id, true), '_blank'))}
      {m.reactions.me && item(<SmilePlus className="size-4" />, 'Remover reação do bot', () => ctx.onReact(m, ''))}
      {canDelete && item(<Trash2 className="size-4" />, 'Apagar para todos', () => ctx.onDelete(m), true)}
    </div>
  )
}

export const MessageBubble = memo(({ m, ctx, showSender, highlight }: {
  m: Message
  ctx: BubbleContext
  showSender: boolean
  highlight?: boolean
}) => {
  const [menu, setMenu] = useState(false)

  if (m.type === 'system') {
    return (
      <div className="my-2 flex justify-center">
        <span className="rounded-lg bg-surface px-3 py-1 text-center text-xs text-text-2 shadow-sm">
          <WaText text={m.text || ''} mentionName={u => Object.entries(ctx.names).find(([j]) => jidUser(j) === u)?.[1]} />
        </span>
      </div>
    )
  }

  const isSticker = m.type === 'sticker' && !m.deleted
  const name = senderName(m, ctx.names)
  const reactions = Object.values(m.reactions).filter(Boolean)
  const grouped = reactions.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r]: (acc[r] || 0) + 1 }), {})

  return (
    <div id={`msg-${m.id}`} className={clsx('group flex px-3 sm:px-[6%]', m.fromMe ? 'justify-end' : 'justify-start', reactions.length ? 'mb-4' : 'mb-1')}>
      <div className={clsx(
        'relative max-w-[85%] sm:max-w-[65%] rounded-lg text-[14.2px] leading-[19px] text-text transition-shadow',
        isSticker ? 'bg-transparent' : m.fromMe ? 'bg-bubble-out shadow-sm' : 'bg-bubble-in shadow-sm',
        !isSticker && 'px-2 pt-1.5 pb-1',
        highlight && 'ring-2 ring-info'
      )}>
        <button
          onClick={() => setMenu(v => !v)}
          className={clsx(
            'absolute right-1 top-1 z-10 rounded-full p-0.5 text-bubble-meta opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100',
            m.fromMe ? 'bg-bubble-out' : 'bg-bubble-in'
          )}
          aria-label="Opções da mensagem"
        >
          <ChevronDown className="size-4" />
        </button>
        {menu && <Menu m={m} ctx={ctx} onClose={() => setMenu(false)} alignRight={m.fromMe} />}

        {showSender && ctx.isGroup && !m.fromMe && (
          <div className="mb-0.5 truncate pr-5 text-[12.8px] font-medium" style={{ color: colorFor(m.sender || name) }}>
            {name}
            {m.senderPhone && !ctx.names[m.sender || ''] && m.pushName && (
              <span className="ml-2 font-normal text-bubble-meta">{formatPhone(m.senderPhone)}</span>
            )}
          </div>
        )}
        {m.fromMe && m.sentBy && (
          <div className="mb-0.5 pr-5 text-[11.5px] font-medium text-bubble-meta">via painel · {ctx.admins[m.sentBy] || formatPhone(m.sentBy)}</div>
        )}
        {m.meta.forwarded && <div className="mb-0.5 text-[11.5px] italic text-bubble-meta">↪ Encaminhada</div>}

        {m.meta.quoted && (
          <button
            onClick={() => m.meta.quoted?.id && ctx.onJump(m.meta.quoted.id)}
            className="mb-1 block w-full min-w-40 overflow-hidden rounded-md border-l-4 bg-black/5 px-2 py-1 text-left dark:bg-white/5"
            style={{ borderColor: colorFor(m.meta.quoted.participant || 'me') }}
          >
            <div className="truncate text-xs font-medium" style={{ color: colorFor(m.meta.quoted.participant || 'me') }}>
              {m.meta.quoted.participant ? (ctx.names[m.meta.quoted.participant] || displayName(null, null, m.meta.quoted.participant)) : 'Você'}
            </div>
            <div className="line-clamp-2 text-xs text-bubble-meta">{m.meta.quoted.text || 'Mensagem'}</div>
          </button>
        )}

        <div className={clsx(!isSticker && 'pr-1')}>
          <Body m={m} ctx={ctx} />
        </div>

        <div className={clsx(
          'flex items-center justify-end gap-1 text-[11px] text-bubble-meta',
          isSticker ? 'mt-0.5 rounded bg-black/30 px-1.5 text-white w-fit ml-auto' : '-mb-0.5 mt-0.5'
        )}>
          {m.edited && <span className="flex items-center gap-0.5"><Pencil className="size-3" />editada</span>}
          <span className="tabular">{formatTime(m.timestamp)}</span>
          {m.fromMe && <StatusIcon status={m.status} pending={m.pending} />}
        </div>

        {reactions.length > 0 && (
          <div className={clsx('absolute -bottom-3.5 flex items-center gap-0.5 rounded-full border border-border bg-surface px-1.5 py-0.5 text-xs shadow-sm',
            m.fromMe ? 'right-2' : 'left-2')}>
            {Object.entries(grouped).map(([emoji, count]) => (
              <span key={emoji}>{emoji}{count > 1 && <span className="tabular ml-0.5 text-[10px] text-text-3">{count}</span>}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
MessageBubble.displayName = 'MessageBubble'
