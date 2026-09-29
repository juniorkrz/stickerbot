import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { ConfigSection, useConfig } from '../components/ConfigForm'
import { Avatar, Button, Card, ErrorState, Field, Input, Loading, Page, PageHeader, Textarea, useUi } from '../components/ui'
import { del, fileToDataUrl, get, post, put } from '../lib/api'
import { formatPhone } from '../lib/format'
import type { Profile as ProfileData } from '../lib/types'

// recorta a imagem em quadrado (o WhatsApp exige foto quadrada)
const squareImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const size = Math.min(img.width, img.height, 1080)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const side = Math.min(img.width, img.height)
      canvas.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = reject
    fileToDataUrl(file).then(src => { img.src = src }, reject)
  })

export default function Profile() {
  const queryClient = useQueryClient()
  const { toast, confirm } = useUi()
  const query = useQuery({ queryKey: ['profile'], queryFn: () => get<ProfileData>('/profile') })
  const config = useConfig()
  const [name, setName] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [photoKey, setPhotoKey] = useState(0)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const p = query.data

  useEffect(() => {
    if (p) {
      setName(p.name)
      setStatus(p.status)
    }
  }, [p])

  const save = async () => {
    setSaving(true)
    try {
      await put('/profile', { name, status })
      toast('Perfil atualizado no WhatsApp')
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['config'] })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    } finally {
      setSaving(false)
    }
  }

  const upload = async (file: File) => {
    setUploading(true)
    try {
      await post('/profile/picture', { data: await squareImage(file) })
      toast('Foto atualizada')
      setPhotoKey(k => k + 1)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    } finally {
      setUploading(false)
    }
  }

  if (query.isLoading) return <Page><Loading /></Page>
  if (query.error || !p) return <Page><ErrorState error={query.error} onRetry={() => query.refetch()} /></Page>
  const dirty = name !== p.name || status !== p.status
  const privacy = (config.data || []).filter(f => f.section === 'Privacidade do WhatsApp')

  return (
    <Page>
      <PageHeader title="Perfil do bot" subtitle={p.connected ? `WhatsApp ${formatPhone(p.phone)}` : 'O WhatsApp do bot está desconectado'} />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card>
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <Avatar key={photoKey} jid={p.jid} name={p.name} size={180} />
              <button onClick={() => fileRef.current?.click()} disabled={!p.connected || uploading} aria-label="Trocar foto"
                className="absolute bottom-2 right-2 flex size-11 items-center justify-center rounded-full bg-accent text-accent-text shadow-card disabled:opacity-50">
                <Camera className="size-5" />
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f) }} />
            <div className="mt-4 text-lg font-semibold">{p.name}</div>
            <div className="text-sm text-text-3">{formatPhone(p.phone)}</div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" loading={uploading} disabled={!p.connected} onClick={() => fileRef.current?.click()}>Trocar foto</Button>
              <Button size="sm" variant="ghost" className="text-danger" disabled={!p.connected} icon={<Trash2 className="size-4" />} onClick={async () => {
                if (await confirm({ title: 'Remover a foto do bot?', confirmLabel: 'Remover', danger: true })) {
                  await del('/profile/picture').then(() => { toast('Foto removida'); setPhotoKey(k => k + 1) }, e => toast(e.message, 'error'))
                }
              }}>Remover</Button>
            </div>
            <p className="mt-3 text-xs text-text-3">A imagem é recortada em quadrado.</p>
          </div>
        </Card>
        <div className="space-y-5">
          <Card title="Nome e recado">
            <div className="space-y-4">
              <Field label="Nome" help="Aparece para quem não tem o bot nos contatos e nas mensagens do bot.">
                <Input value={name} onChange={e => setName(e.target.value)} maxLength={25} />
              </Field>
              <Field label="Recado (status)" help={`${status.length}/139`}>
                <Textarea value={status} onChange={e => setStatus(e.target.value)} maxLength={139} rows={3} />
              </Field>
            </div>
            {dirty && (
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => { setName(p.name); setStatus(p.status) }}>Descartar</Button>
                <Button variant="primary" loading={saving} disabled={!p.connected} onClick={save}>Salvar no WhatsApp</Button>
              </div>
            )}
          </Card>
          {privacy.length > 0 && <ConfigSection title="Privacidade" fields={privacy} />}
        </div>
      </div>
    </Page>
  )
}
