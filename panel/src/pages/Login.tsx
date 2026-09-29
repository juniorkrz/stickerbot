import { ArrowLeft, KeyRound, MessageCircle, Terminal } from 'lucide-react'
import { FormEvent, useEffect, useRef, useState } from 'react'

import { Button, Input } from '../components/ui'
import { post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatPhone } from '../lib/format'
import type { PanelUser } from '../lib/types'

export const LoginPage = () => {
  const { setUser } = useAuth()
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState(() => {
    try {
      return localStorage.getItem('sbpanel-phone') || ''
    } catch {
      return ''
    }
  })
  const [code, setCode] = useState('')
  const [delivery, setDelivery] = useState<'whatsapp' | 'logs'>('whatsapp')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)

  const digits = phone.replace(/\D/g, '')

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const requestCode = async (e?: FormEvent) => {
    e?.preventDefault()
    setError('')
    if (digits.length < 12) {
      setError('Digite o número completo com DDI e DDD. Ex.: 55 81 99999-9999')
      return
    }
    setLoading(true)
    try {
      const res = await post<{ delivery: 'whatsapp' | 'logs' }>('/auth/request', { phone: digits })
      setDelivery(res.delivery)
      setStep('code')
      setCooldown(30)
      setCode('')
      try {
        localStorage.setItem('sbpanel-phone', digits)
      } catch {
        // sem storage
      }
      setTimeout(() => codeRef.current?.focus(), 50)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao pedir o código')
    } finally {
      setLoading(false)
    }
  }

  const verify = async (value = code) => {
    setError('')
    setLoading(true)
    try {
      const res = await post<{ user: PanelUser }>('/auth/verify', { phone: digits, code: value })
      setUser(res.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido')
      setCode('')
      codeRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  const onCodeChange = (value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 6)
    setCode(clean)
    if (clean.length === 6) void verify(clean)
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/painel/favicon.svg" alt="" className="mb-4 size-14" />
          <h1 className="text-2xl font-semibold tracking-tight">Painel do StickerBot</h1>
          <p className="mt-1 text-sm text-text-3">Acesso restrito aos admins do bot</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
          {step === 'phone' ? (
            <form onSubmit={requestCode} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-text-2">Seu número de WhatsApp</span>
                <Input
                  inputMode="tel"
                  autoComplete="tel"
                  autoFocus
                  placeholder="55 81 99999-9999"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
                <span className="block text-xs text-text-3">Com DDI (55) e DDD. Vamos mandar um código pelo WhatsApp do bot.</span>
              </label>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" variant="primary" className="w-full" loading={loading} icon={<MessageCircle className="size-4" />}>
                Receber código
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <button onClick={() => setStep('phone')} className="-mt-1 flex items-center gap-1 text-sm text-text-3 hover:text-text">
                <ArrowLeft className="size-4" /> Trocar número
              </button>
              {delivery === 'whatsapp' ? (
                <p className="text-sm text-text-2">
                  Se <b className="text-text">{formatPhone(digits)}</b> for admin do bot, o código chegou no WhatsApp agora.
                </p>
              ) : (
                <div className="flex gap-3 rounded-lg bg-warning-soft p-3 text-sm text-warning">
                  <Terminal className="mt-0.5 size-4 shrink-0" />
                  <span>O WhatsApp do bot está desconectado. O código foi escrito no log do servidor
                    (<code className="font-mono">docker logs stickerbot</code>).</span>
                </div>
              )}
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-text-2">Código de 6 dígitos</span>
                <Input
                  ref={codeRef}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  className="h-12 text-center font-mono text-2xl tracking-[0.5em]"
                  value={code}
                  onChange={e => onCodeChange(e.target.value)}
                />
              </label>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button variant="primary" className="w-full" loading={loading} disabled={code.length !== 6}
                onClick={() => verify()} icon={<KeyRound className="size-4" />}>
                Entrar
              </Button>
              <Button variant="ghost" className="w-full" disabled={cooldown > 0 || loading} onClick={() => requestCode()}>
                {cooldown > 0 ? `Reenviar código em ${cooldown}s` : 'Reenviar código'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
