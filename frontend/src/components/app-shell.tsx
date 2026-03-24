import { Link, NavLink, Outlet } from 'react-router-dom'
import { LogOut, Settings, Ticket } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
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
        <aside className="sticky top-0 hidden h-svh w-56 shrink-0 flex-col border-r border-border px-3 py-4 md:flex">
          <Link
            to="/"
            className="mb-6 flex items-center gap-2 px-3 text-lg font-semibold tracking-tight"
          >
            <Ticket className="size-6 text-primary" />
            Tickets Hub
          </Link>
          <nav className="flex flex-1 flex-col gap-1">
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
          <div className="mt-auto space-y-2 border-t border-border pt-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-muted-foreground">Tema</span>
              <ThemeToggle />
            </div>
            <p className="truncate px-3 text-xs text-muted-foreground">
              {user?.name}
            </p>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => void logout()}
            >
              <LogOut className="size-4" />
              Sair
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 border-border md:border-l-0">
          <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:hidden">
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <Ticket className="size-5 text-primary" />
              Tickets Hub
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
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
