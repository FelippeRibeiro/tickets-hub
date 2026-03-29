import { useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Camera, LogOut, Settings, Ticket, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/user-avatar'
import { useAuth } from '@/contexts/auth-context'
import * as api from '@/lib/api'
import { cn } from '@/lib/utils'

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-muted text-foreground'
      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
  )

export function AppShell() {
  const { user, logout, refresh } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    setUploadingAvatar(true)
    try {
      await api.uploadProfileAvatar(file)
      await refresh()
    } catch (err) {
      console.error(err)
      alert(err instanceof api.ApiError ? err.message : 'Não foi possível atualizar a foto.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function onRemoveAvatar() {
    if (!user?.has_avatar) return
    setUploadingAvatar(true)
    try {
      await api.deleteProfileAvatar()
      await refresh()
    } catch (err) {
      console.error(err)
      alert(err instanceof api.ApiError ? err.message : 'Não foi possível remover a foto.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh max-w-6xl">
        <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-border/70 bg-card/30 px-4 py-5 md:flex">
          <Link
            to="/"
            className="mb-8 flex items-center gap-2 px-2 text-lg font-semibold tracking-tight"
          >
            <Ticket className="size-6 text-primary" />
            Tickets Hub
          </Link>
          <nav className="flex flex-1 flex-col gap-1.5">
            <NavLink to="/" end className={navClass}>
              Início
            </NavLink>
            {user?.is_admin ? (
              <NavLink to="/admin" className={navClass}>
                <span className="flex items-center gap-2">
                  <Settings className="size-4" />
                  Admin
                </span>
              </NavLink>
            ) : null}
          </nav>
          <div className="mt-auto space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="sr-only"
              aria-label="Escolher foto de perfil"
              onChange={(e) => void onPickAvatar(e)}
            />
            <div className="flex items-center gap-3 px-1">
              {user ? (
                <UserAvatar
                  userId={user.id}
                  name={user.name}
                  hasAvatar={Boolean(user.has_avatar)}
                  size="lg"
                />
              ) : null}
              <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {user?.name}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="flex-1 gap-1.5 text-xs"
                disabled={!user || uploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="size-3.5 shrink-0" />
                Foto
              </Button>
              {user?.has_avatar ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 px-2 text-muted-foreground"
                  disabled={uploadingAvatar}
                  title="Remover foto"
                  onClick={() => void onRemoveAvatar()}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </div>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 border-border/70 bg-background/70"
              onClick={() => void logout()}
            >
              <LogOut className="size-4" />
              Sair
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 border-border md:border-l-0">
          <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur md:hidden">
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <Ticket className="size-5 text-primary" />
              Tickets Hub
            </Link>
            <Button size="sm" variant="outline" onClick={() => void logout()}>
              Sair
            </Button>
          </header>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
