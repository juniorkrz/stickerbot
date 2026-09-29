import clsx from 'clsx'
import { Loader2, Search, X } from 'lucide-react'
import {
  ButtonHTMLAttributes,
  createContext,
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'
import { createPortal } from 'react-dom'

import { avatarUrl } from '../lib/api'
import { colorFor, initials } from '../lib/format'

// ---------------- Botões ----------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'icon' | 'icon-sm'

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}>(({ variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...props }, ref) => (
  <button
    ref={ref}
    disabled={disabled || loading}
    className={clsx(
      'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors select-none',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      'disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
      {
        primary: 'bg-accent text-accent-text hover:bg-accent-hover',
        secondary: 'bg-surface-2 text-text hover:bg-surface-3',
        ghost: 'text-text-2 hover:bg-surface-2 hover:text-text',
        danger: 'bg-danger text-white hover:opacity-90',
        outline: 'border border-border text-text hover:bg-surface-2'
      }[variant],
      {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-4 text-sm',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8'
      }[size],
      className
    )}
    {...props}
  >
    {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
    {children}
  </button>
))
Button.displayName = 'Button'

// ---------------- Campos ----------------

const fieldClass = 'w-full rounded-lg border border-border bg-surface px-3 text-sm text-text placeholder:text-text-3 ' +
  'outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={clsx(fieldClass, 'h-10', className)} {...props} />
))
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={clsx(fieldClass, 'py-2 min-h-20', className)} {...props} />
)
Textarea.displayName = 'Textarea'

export const Select = ({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={clsx(fieldClass, 'h-10 pr-8', className)} {...props}>{children}</select>
)

export const SearchInput = ({ value, onChange, placeholder = 'Buscar...', className }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) => (
  <div className={clsx('relative', className)}>
    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" />
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={clsx(fieldClass, 'h-10 pl-9 pr-8 bg-surface-2 border-transparent')}
    />
    {value && (
      <button onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-3 hover:text-text"
        aria-label="Limpar busca">
        <X className="size-4" />
      </button>
    )}
  </div>
)

export const Field = ({ label, help, error, children, className }: {
  label: ReactNode
  help?: ReactNode
  error?: string
  children: ReactNode
  className?: string
}) => (
  <label className={clsx('block space-y-1.5', className)}>
    <span className="text-[13px] font-medium text-text-2">{label}</span>
    {children}
    {error ? <span className="block text-xs text-danger">{error}</span> : help && <span className="block text-xs text-text-3">{help}</span>}
  </label>
)

export const Switch = ({ checked, onChange, disabled, label }: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label?: string
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={clsx(
      'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
      checked ? 'bg-accent' : 'bg-surface-3'
    )}
  >
    <span className={clsx('inline-block size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5.5' : 'translate-x-0.5')} />
  </button>
)

export const SwitchRow = ({ label, help, checked, onChange, disabled }: {
  label: ReactNode
  help?: ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) => (
  <div className="flex items-start justify-between gap-4 py-2.5">
    <div className="min-w-0">
      <div className="text-sm text-text">{label}</div>
      {help && <div className="mt-0.5 text-xs text-text-3">{help}</div>}
    </div>
    <Switch checked={checked} onChange={onChange} disabled={disabled} label={typeof label === 'string' ? label : undefined} />
  </div>
)

// ---------------- Layout ----------------

export const Card = ({ className, children, title, action, padded = true }: {
  className?: string
  children: ReactNode
  title?: ReactNode
  action?: ReactNode
  padded?: boolean
}) => (
  <section className={clsx('rounded-xl border border-border bg-surface shadow-card', className)}>
    {(title || action) && (
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-[15px] font-semibold text-text">{title}</h2>
        {action}
      </header>
    )}
    <div className={clsx(padded && 'p-4 sm:p-5')}>{children}</div>
  </section>
)

export const PageHeader = ({ title, subtitle, actions }: { title: ReactNode, subtitle?: ReactNode, actions?: ReactNode }) => (
  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-text-3">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
)

export const Page = ({ children, className }: { children: ReactNode, className?: string }) => (
  <div className={clsx('mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7', className)}>{children}</div>
)

type Tone = 'neutral' | 'accent' | 'danger' | 'warning' | 'info' | 'violet'
export const Badge = ({ tone = 'neutral', children, className }: { tone?: Tone, children: ReactNode, className?: string }) => (
  <span className={clsx(
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 whitespace-nowrap',
    {
      neutral: 'bg-surface-2 text-text-2',
      accent: 'bg-accent-soft text-accent',
      danger: 'bg-danger-soft text-danger',
      warning: 'bg-warning-soft text-warning',
      info: 'bg-info-soft text-info',
      violet: 'bg-violet-soft text-violet'
    }[tone],
    className
  )}>
    {children}
  </span>
)

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={clsx('size-5 animate-spin text-text-3', className)} />

export const Loading = ({ label = 'Carregando...' }: { label?: string }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-3"><Spinner />{label}</div>
)

export const EmptyState = ({ icon, title, children }: { icon?: ReactNode, title: string, children?: ReactNode }) => (
  <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
    {icon && <div className="mb-3 text-text-3 [&_svg]:size-10">{icon}</div>}
    <div className="text-sm font-medium text-text">{title}</div>
    {children && <div className="mt-1 max-w-sm text-sm text-text-3">{children}</div>}
  </div>
)

export const ErrorState = ({ error, onRetry }: { error: unknown, onRetry?: () => void }) => (
  <div className="flex flex-col items-center gap-3 py-12 text-center">
    <div className="text-sm text-danger">{error instanceof Error ? error.message : 'Algo deu errado'}</div>
    {onRetry && <Button size="sm" onClick={onRetry}>Tentar de novo</Button>}
  </div>
)

// ---------------- Avatar ----------------

export const Avatar = ({ jid, name, size = 40, className, noPhoto }: {
  jid?: string
  name: string
  size?: number
  className?: string
  noPhoto?: boolean
}) => {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [jid])
  const showPhoto = jid && !failed && !noPhoto
  return (
    <div
      className={clsx('relative shrink-0 overflow-hidden rounded-full font-semibold text-white', className)}
      style={{ width: size, height: size, background: colorFor(jid || name), fontSize: Math.max(11, size * 0.38) }}
    >
      <span className="absolute inset-0 flex items-center justify-center">{initials(name)}</span>
      {showPhoto && (
        <img
          src={avatarUrl(jid)}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailed(true)}
          onLoad={e => { if ((e.target as HTMLImageElement).naturalWidth === 0) setFailed(true) }}
        />
      )}
    </div>
  )
}

// ---------------- Modal ----------------

export const Modal = ({ open, onClose, title, children, footer, size = 'md' }: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) => {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[var(--overlay)]" onClick={onClose} />
      <div className={clsx(
        'animate-fade-in relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-border bg-surface shadow-card sm:rounded-2xl',
        { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-3xl' }[size]
      )}>
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar"><X className="size-4" /></Button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body
  )
}

// ---------------- Toasts e confirmação ----------------

interface Toast { id: number, message: string, tone: 'success' | 'error' | 'info' }
interface ConfirmOptions { title: string, message?: ReactNode, confirmLabel?: string, danger?: boolean }

const UiContext = createContext<{
  toast: (message: string, tone?: Toast['tone']) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}>({ toast: () => undefined, confirm: async () => false })

export const UiProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)

  const toast = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, tone }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), tone === 'error' ? 6000 : 3500)
  }, [])

  const confirm = useCallback((options: ConfirmOptions) =>
    new Promise<boolean>(resolve => setConfirmState({ ...options, resolve })), [])

  const close = (value: boolean) => {
    confirmState?.resolve(value)
    setConfirmState(null)
  }

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end">
          {toasts.map(t => (
            <div key={t.id} role="status" className={clsx(
              'animate-fade-in pointer-events-auto max-w-sm rounded-lg px-4 py-3 text-sm font-medium shadow-card',
              t.tone === 'error' ? 'bg-danger text-white' : t.tone === 'info' ? 'bg-surface-3 text-text' : 'bg-text text-bg'
            )}>
              {t.message}
            </div>
          ))}
        </div>,
        document.body
      )}
      <Modal
        open={!!confirmState}
        onClose={() => close(false)}
        title={confirmState?.title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>Cancelar</Button>
            <Button variant={confirmState?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {confirmState?.confirmLabel || 'Confirmar'}
            </Button>
          </>
        }
      >
        <div className="text-sm text-text-2">{confirmState?.message}</div>
      </Modal>
    </UiContext.Provider>
  )
}

export const useUi = () => useContext(UiContext)

// ---------------- Abas (segmented) ----------------

export const Tabs = <T extends string>({ value, onChange, items, className }: {
  value: T
  onChange: (v: T) => void
  items: { value: T, label: ReactNode, count?: number }[]
  className?: string
}) => (
  <div className={clsx('flex gap-1 overflow-x-auto', className)} role="tablist">
    {items.map(item => (
      <button
        key={item.value}
        role="tab"
        aria-selected={value === item.value}
        onClick={() => onChange(item.value)}
        className={clsx(
          'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors',
          value === item.value ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-text-2 hover:bg-surface-3'
        )}
      >
        {item.label}
        {!!item.count && <span className="tabular rounded-full bg-accent px-1.5 text-[11px] leading-4 text-accent-text">{item.count}</span>}
      </button>
    ))}
  </div>
)

// ---------------- Tabela simples ----------------

export const Table = ({ children, className }: { children: ReactNode, className?: string }) => (
  <div className={clsx('overflow-x-auto', className)}>
    <table className="w-full text-left text-sm">{children}</table>
  </div>
)

export const Th = ({ children, className }: { children?: ReactNode, className?: string }) => (
  <th className={clsx('border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-text-3', className)}>{children}</th>
)

export const Td = ({ children, className }: { children?: ReactNode, className?: string }) => (
  <td className={clsx('border-b border-border px-4 py-3 align-middle', className)}>{children}</td>
)
