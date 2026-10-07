import { useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  Activity,
  Ban,
  Contact,
  Crown,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessagesSquare,
  Monitor,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  TerminalSquare,
  UserCircle,
  Users,
  WifiOff,
  X
} from 'lucide-react'
import { ReactNode, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { get } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useEvent, useLiveState } from '../lib/events'
import { Theme, useTheme } from '../lib/theme'
import { Avatar } from './ui'

interface NavItem { to: string, label: string, icon: ReactNode, badge?: number }

const useChatCounts = () => {
  const queryClient = useQueryClient()
  const timer = useRef<number>()
  const query = useQuery({
    queryKey: ['chat-counts'],
    queryFn: () => get<{ all: number, unread: number, waiting: number, mine: number }>('/chats/counts'),
    refetchInterval: 60_000
  })
  const refresh = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => queryClient.invalidateQueries({ queryKey: ['chat-counts'] }), 1500)
  }
  useEvent('message', refresh)
  useEvent('chat', refresh)
  return query.data
}

const ThemeToggle = () => {
  const [theme, setTheme] = useTheme()
  const next: Record<Theme, Theme> = { system: 'dark', dark: 'light', light: 'system' }
  const label = { system: 'Tema do sistema', dark: 'Tema escuro', light: 'Tema claro' }[theme]
  const Icon = { system: Monitor, dark: Moon, light: Sun }[theme]
  return (
    <button onClick={() => setTheme(next[theme])} title={label} aria-label={label}
      className="rounded-lg p-2 text-text-3 hover:bg-surface-2 hover:text-text">
      <Icon className="size-4" />
    </button>
  )
}

const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { user, logout } = useAuth()
  const counts = useChatCounts()
  const live = useLiveState()

  const groups: { title: string, items: NavItem[] }[] = [
    { title: '', items: [{ to: '/', label: 'Visão geral', icon: <LayoutDashboard /> }] },
    {
      title: 'Atendimento',
      items: [
        { to: '/conversas', label: 'Conversas', icon: <MessagesSquare />, badge: counts?.waiting },
        { to: '/grupos', label: 'Grupos', icon: <Users /> },
        { to: '/membros', label: 'Membros', icon: <Contact /> }
      ]
    },
    {
      title: 'Moderação',
      items: [
        { to: '/vips', label: 'VIPs', icon: <Crown /> },
        { to: '/banidos', label: 'Banidos', icon: <Ban /> },
        { to: '/admins', label: 'Admins', icon: <ShieldCheck /> }
      ]
    },
    {
      title: 'Bot',
      items: [
        { to: '/anuncios', label: 'Anúncios', icon: <Megaphone /> },
        { to: '/comandos', label: 'Comandos', icon: <TerminalSquare /> },
        { to: '/perfil', label: 'Perfil do bot', icon: <UserCircle /> },
        { to: '/configuracoes', label: 'Configurações', icon: <Settings /> },
        { to: '/sistema', label: 'Sistema e logs', icon: <Activity /> }
      ]
    }
  ]

  const statusLabel = live.whatsapp === 'open' ? 'Conectado' : live.whatsapp === 'connecting' ? 'Conectando…' : 'Desconectado'

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 px-4">
        <img src="/painel/favicon.svg" alt="" className="size-8" />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold leading-5">StickerBot</div>
          <Link to="/sistema" onClick={onNavigate} className="flex items-center gap-1.5 text-xs text-text-3 hover:text-text-2">
            <span className={clsx('size-2 rounded-full', {
              'bg-accent': live.whatsapp === 'open',
              'bg-warning': live.whatsapp === 'connecting',
              'bg-danger': live.whatsapp === 'close'
            })} />
            {statusLabel}
          </Link>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {groups.map(group => (
          <div key={group.title}>
            {group.title && <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-text-3">{group.title}</div>}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) => clsx(
                    'flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors [&_svg]:size-[18px]',
                    isActive ? 'bg-accent-soft text-accent' : 'text-text-2 hover:bg-surface-2 hover:text-text'
                  )}
                >
                  {item.icon}
                  <span className="flex-1 truncate">{item.label}</span>
                  {!!item.badge && (
                    <span className="tabular rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-accent-text">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2 border-t border-border p-3">
        <Avatar name={user?.name || '?'} jid={user ? `${user.phone}@s.whatsapp.net` : undefined} size={34} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{user?.name}</div>
          <div className="text-xs text-text-3">{user?.isOwner ? 'Dono' : 'Admin'}</div>
        </div>
        <ThemeToggle />
        <button onClick={logout} title="Sair" aria-label="Sair" className="rounded-lg p-2 text-text-3 hover:bg-surface-2 hover:text-danger">
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  )
}

export const Layout = () => {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const live = useLiveState()
  const fullBleed = location.pathname.startsWith('/conversas')

  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface lg:block">
        <Sidebar />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-[var(--overlay)]" onClick={() => setOpen(false)} />
          <aside className="animate-fade-in absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-surface">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-lg p-2 text-text-3 hover:bg-surface-2" aria-label="Fechar menu">
              <X className="size-5" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className={clsx('flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden', fullBleed && 'hidden')}>
          <button onClick={() => setOpen(true)} className="-ml-2 rounded-lg p-2 text-text-2 hover:bg-surface-2" aria-label="Abrir menu">
            <Menu className="size-5" />
          </button>
          <img src="/painel/favicon.svg" alt="" className="size-7" />
          <span className="font-semibold">StickerBot</span>
        </header>

        {live.whatsapp === 'close' && (
          <Link to="/sistema" className="flex items-center justify-center gap-2 bg-danger px-4 py-2 text-center text-sm font-medium text-white">
            <WifiOff className="size-4" /> O WhatsApp do bot está desconectado. Toque para ver o QR Code e os logs.
          </Link>
        )}

        <main className={clsx('min-h-0 flex-1', fullBleed ? 'overflow-hidden' : 'overflow-y-auto')}>
          <Outlet context={{ openMenu: () => setOpen(true) }} />
        </main>
      </div>
    </div>
  )
}
