import { Link, NavLink, Outlet } from 'react-router-dom'
import { LogOut, Settings, Ticket, UserCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProfileSettingsDialog } from '@/components/profile-settings-dialog'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-muted text-foreground'
      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
  )

export function AppShell() {
  const { user, logout } = useAuth()

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
            {user ? (
              <ProfileSettingsDialog
                trigger={
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-start gap-2"
                  >
                    <UserCircle2 className="size-4" />
                    Editar perfil
                  </Button>
                }
              />
            ) : null}
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
            <div className="flex items-center gap-2">
              {user ? (
                <ProfileSettingsDialog
                  trigger={
                    <Button size="sm" variant="outline">
                      Perfil
                    </Button>
                  }
                />
              ) : null}
              <Button size="sm" variant="outline" onClick={() => void logout()}>
                Sair
              </Button>
            </div>
          </header>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
