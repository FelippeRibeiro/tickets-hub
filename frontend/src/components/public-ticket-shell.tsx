import { Link, Outlet } from 'react-router-dom'
import { Ticket } from 'lucide-react'

export function PublicTicketShell() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <Ticket className="size-5 text-primary" />
          Tickets Hub
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Entrar
          </Link>
          <Link
            to="/cadastro"
            className="rounded-lg border border-border/70 bg-muted/30 px-3 py-1.5 text-sm font-medium hover:bg-muted/50"
          >
            Cadastro
          </Link>
        </div>
      </header>
      <main className="min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
