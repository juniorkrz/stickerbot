import './index.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { Layout } from './components/Layout'
import { Loading, UiProvider } from './components/ui'
import { ApiError } from './lib/api'
import { AuthProvider, useAuth } from './lib/auth'
import { LoginPage } from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Chats = lazy(() => import('./pages/Chats'))
const Groups = lazy(() => import('./pages/Groups'))
const Members = lazy(() => import('./pages/Members'))
const Vips = lazy(() => import('./pages/Vips'))
const Bans = lazy(() => import('./pages/Bans'))
const Admins = lazy(() => import('./pages/Admins'))
const Ads = lazy(() => import('./pages/Ads'))
const Commands = lazy(() => import('./pages/Commands'))
const Profile = lazy(() => import('./pages/Profile'))
const SettingsPage = lazy(() => import('./pages/Settings'))
const SystemPage = lazy(() => import('./pages/System'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2
    }
  }
})

const AppRoutes = () => {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex h-full items-center justify-center"><Loading label="Abrindo o painel..." /></div>
  if (!user) return <LoginPage />
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="conversas" element={<Chats />} />
          <Route path="conversas/:jid" element={<Chats />} />
          <Route path="grupos" element={<Groups />} />
          <Route path="grupos/:jid" element={<Groups />} />
          <Route path="membros" element={<Members />} />
          <Route path="vips" element={<Vips />} />
          <Route path="banidos" element={<Bans />} />
          <Route path="admins" element={<Admins />} />
          <Route path="anuncios" element={<Ads />} />
          <Route path="comandos" element={<Commands />} />
          <Route path="perfil" element={<Profile />} />
          <Route path="configuracoes" element={<SettingsPage />} />
          <Route path="sistema" element={<SystemPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/painel">
        <UiProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </UiProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)
