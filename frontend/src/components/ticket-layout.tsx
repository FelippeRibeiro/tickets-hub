import { useAuth } from '@/contexts/auth-context';
import { AppShell } from '@/components/app-shell';
import { PublicTicketShell } from '@/components/public-ticket-shell';

export function TicketLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-svh items-center justify-center text-muted-foreground">Carregando…</div>;
  }

  if (user) {
    return <AppShell />;
  }

  return <PublicTicketShell />;
}
