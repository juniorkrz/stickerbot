import clsx from 'clsx'
import { File as FileIcon, Image as ImageIcon, Lock, Music, Paperclip, SendHorizontal, Sticker, X } from 'lucide-react'
import { ClipboardEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'

import { enc, fileToDataUrl, post } from '../../lib/api'
import { formatBytes } from '../../lib/format'
import type { Message } from '../../lib/types'
import { Button, Input, Modal, Switch, useUi } from '../ui'

type Kind = 'image' | 'video' | 'gif' | 'audio' | 'document' | 'sticker'

const kindFor = (file: File): Kind => {
  if (file.type === 'image/gif') return 'image'
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return 'document'
}

interface Attachment { file: File, kind: Kind, preview?: string }

export const Composer = ({ jid, replyTo, onCancelReply, senderLabel, disabledReason, onSent }: {
  jid: string
  replyTo: Message | null
  onCancelReply: () => void
  senderLabel: (m: Message) => string
  disabledReason?: string
  onSent: (optimistic: { text?: string, kind?: string, quotedId?: string }) => void
}) => {
  const { toast } = useUi()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [menu, setMenu] = useState(false)
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [caption, setCaption] = useState('')
  const [asSticker, setAsSticker] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const acceptRef = useRef<{ accept: string, sticker: boolean }>({ accept: '*', sticker: false })
  const lastTyping = useRef(0)

  // rascunho por conversa
  useEffect(() => {
    try {
      setText(sessionStorage.getItem(`draft:${jid}`) || '')
    } catch {
      setText('')
    }
    setTimeout(() => textRef.current?.focus(), 30)
  }, [jid])
  useEffect(() => {
    try {
      if (text) sessionStorage.setItem(`draft:${jid}`, text)
      else sessionStorage.removeItem(`draft:${jid}`)
    } catch {
      // sem storage
    }
  }, [text, jid])

  useEffect(() => {
    if (replyTo) textRef.current?.focus()
  }, [replyTo])

  // altura automática
  useEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  const typing = () => {
    const now = Date.now()
    if (now - lastTyping.current < 8000) return
    lastTyping.current = now
    void post(`/chats/${enc(jid)}/presence`, { state: 'composing' }).catch(() => undefined)
  }

  const sendText = async () => {
    const value = text.trim()
    if (!value || sending) return
    setSending(true)
    onSent({ text: value, quotedId: replyTo?.id })
    setText('')
    try {
      await post(`/chats/${enc(jid)}/messages`, { text: value, quotedId: replyTo?.id })
      onCancelReply()
      lastTyping.current = 0
    } catch (e) {
      setText(value)
      toast(e instanceof Error ? e.message : 'Não foi possível enviar', 'error')
    } finally {
      setSending(false)
      textRef.current?.focus()
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void sendText()
    } else if (e.key === 'Escape' && replyTo) {
      onCancelReply()
    }
  }

  const pickFile = (accept: string, sticker = false) => {
    acceptRef.current = { accept, sticker }
    setMenu(false)
    if (fileRef.current) {
      fileRef.current.accept = accept
      fileRef.current.value = ''
      fileRef.current.click()
    }
  }

  const openAttachment = (file: File, sticker = false) => {
    const kind = kindFor(file)
    setAttachment({ file, kind, preview: kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : undefined })
    setCaption(text)
    setAsSticker(sticker && kind === 'image')
  }

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const file = Array.from(e.clipboardData.files)[0]
    if (file) {
      e.preventDefault()
      openAttachment(file)
    }
  }

  const closeAttachment = () => {
    if (attachment?.preview) URL.revokeObjectURL(attachment.preview)
    setAttachment(null)
  }

  const sendAttachment = async () => {
    if (!attachment) return
    if (attachment.file.size > 60 * 1024 * 1024) {
      toast('Arquivo muito grande (máx. 60 MB)', 'error')
      return
    }
    setSending(true)
    try {
      const data = await fileToDataUrl(attachment.file)
      const kind = asSticker ? 'sticker' : attachment.kind
      onSent({ text: kind === 'sticker' ? undefined : caption.trim() || undefined, kind, quotedId: replyTo?.id })
      await post(`/chats/${enc(jid)}/media`, {
        kind,
        data,
        mimetype: attachment.file.type,
        fileName: attachment.file.name,
        caption: kind === 'sticker' || kind === 'audio' ? undefined : caption.trim(),
        quotedId: replyTo?.id
      })
      if (caption.trim() === text.trim()) setText('')
      onCancelReply()
      closeAttachment()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível enviar', 'error')
    } finally {
      setSending(false)
    }
  }

  if (disabledReason) {
    return (
      <div className="flex items-center justify-center gap-2 border-t border-border bg-surface px-4 py-4 text-sm text-text-3">
        <Lock className="size-4" /> {disabledReason}
      </div>
    )
  }

  return (
    <div className="shrink-0 border-t border-border bg-surface">
      {replyTo && (
        <div className="flex items-center gap-3 px-4 pt-2">
          <div className="min-w-0 flex-1 rounded-md border-l-4 border-accent bg-surface-2 px-3 py-1.5">
            <div className="text-xs font-medium text-accent">{replyTo.fromMe ? 'Você (bot)' : senderLabel(replyTo)}</div>
            <div className="truncate text-xs text-text-3">{replyTo.text || `[${replyTo.type}]`}</div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onCancelReply} aria-label="Cancelar resposta"><X className="size-4" /></Button>
        </div>
      )}
      <div className="flex items-end gap-1 px-2 py-2 sm:px-3">
        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setMenu(v => !v)} aria-label="Anexar" title="Anexar">
            <Paperclip className="size-5" />
          </Button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="animate-fade-in absolute bottom-12 left-0 z-20 w-52 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-card">
                {[
                  { icon: <ImageIcon className="size-4 text-violet" />, label: 'Fotos e vídeos', action: () => pickFile('image/*,video/*') },
                  { icon: <Sticker className="size-4 text-accent" />, label: 'Figurinha (de uma imagem)', action: () => pickFile('image/*', true) },
                  { icon: <Music className="size-4 text-warning" />, label: 'Áudio', action: () => pickFile('audio/*') },
                  { icon: <FileIcon className="size-4 text-info" />, label: 'Documento', action: () => pickFile('*') }
                ].map(i => (
                  <button key={i.label} onClick={i.action} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-2">
                    {i.icon}{i.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <input ref={fileRef} type="file" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) openAttachment(f, acceptRef.current.sticker) }} />
        </div>
        <textarea
          ref={textRef}
          rows={1}
          value={text}
          onChange={e => { setText(e.target.value); typing() }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder="Digite uma mensagem"
          className="max-h-40 min-h-10 flex-1 resize-none rounded-lg bg-surface-2 px-3 py-2.5 text-[15px] leading-5 text-text outline-none placeholder:text-text-3"
        />
        <Button variant="primary" size="icon" className="rounded-full" onClick={sendText} disabled={!text.trim()} loading={sending && !attachment}
          aria-label="Enviar" title="Enviar (Enter)">
          <SendHorizontal className="size-5" />
        </Button>
      </div>

      <Modal
        open={!!attachment}
        onClose={closeAttachment}
        title="Enviar arquivo"
        footer={<><Button variant="ghost" onClick={closeAttachment}>Cancelar</Button>
          <Button variant="primary" loading={sending} onClick={sendAttachment} icon={<SendHorizontal className="size-4" />}>Enviar</Button></>}
      >
        {attachment && (
          <div className="space-y-4">
            <div className="flex justify-center rounded-lg bg-surface-2 p-3">
              {attachment.kind === 'image' && attachment.preview && (
                <img src={attachment.preview} alt="" className={clsx('max-h-72 rounded object-contain', asSticker && 'size-48')} />
              )}
              {(attachment.kind === 'video' || attachment.kind === 'gif') && attachment.preview && (
                <video src={attachment.preview} controls className="max-h-72 rounded" />
              )}
              {(attachment.kind === 'document' || attachment.kind === 'audio') && (
                <div className="flex items-center gap-3 py-6">
                  {attachment.kind === 'audio' ? <Music className="size-10 text-text-3" /> : <FileIcon className="size-10 text-text-3" />}
                  <div>
                    <div className="font-medium">{attachment.file.name}</div>
                    <div className="text-xs text-text-3">{formatBytes(attachment.file.size)}</div>
                  </div>
                </div>
              )}
            </div>
            {attachment.kind === 'image' && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">Enviar como figurinha</span>
                <Switch checked={asSticker} onChange={setAsSticker} label="Enviar como figurinha" />
              </div>
            )}
            {(attachment.kind === 'video' || attachment.kind === 'gif') && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">Enviar como GIF (sem som, em loop)</span>
                <Switch checked={attachment.kind === 'gif'}
                  onChange={v => setAttachment(a => a && { ...a, kind: v ? 'gif' : 'video' })} label="Enviar como GIF" />
              </div>
            )}
            {!asSticker && attachment.kind !== 'audio' && (
              <Input placeholder="Legenda (opcional)" value={caption} onChange={e => setCaption(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendAttachment()} />
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
