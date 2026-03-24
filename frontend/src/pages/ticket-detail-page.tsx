import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle } from 'lucide-react';
import { ApiError, getTicket, type TicketWithTopic } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { initialsFromName } from '@/lib/utils';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ticketId = Number(id);
  const [ticket, setTicket] = useState<TicketWithTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || Number.isNaN(ticketId) || ticketId <= 0) {
      setError('Ticket inválido');
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const t = await getTicket(ticketId);
        if (!cancelled) {
          setTicket(t);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Não foi possível carregar o ticket');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, ticketId]);

  return (
    <div className="mx-auto min-h-svh max-w-xl border-x border-border">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/90 px-2 py-2 backdrop-blur">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Voltar" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </Button>
        <Link to="/" className="text-sm font-semibold hover:underline">
          Ticket
        </Link>
      </header>

      <div className="px-4 pb-12">
        {loading ? (
          <div className="space-y-4 pt-6">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <p className="p-6 text-center text-sm text-destructive">{error}</p>
        ) : ticket ? (
          <>
            <article className="border-b border-border py-4">
              <div className="flex gap-3">
                <div
                  className="flex size-12 shrink-0 select-none items-center justify-center rounded-full bg-muted text-sm font-semibold tracking-tight text-muted-foreground"
                  aria-hidden
                >
                  {initialsFromName(ticket.user_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{ticket.user_name}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-sm text-muted-foreground">{formatDate(ticket.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-primary">{ticket.topic_name || `Tópico #${ticket.topic_id}`}</p>
                  <h1 className="mt-3 text-xl font-bold leading-tight tracking-tight">{ticket.title}</h1>
                  <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{ticket.description}</p>
                  <div className="mt-6 flex flex-wrap gap-8 border-t border-border pt-4 text-muted-foreground">
                    <button type="button" disabled className="flex items-center gap-2 text-sm opacity-60">
                      <Heart className="size-5" />
                      <span>Curtidas em breve</span>
                    </button>
                    <span className="flex items-center gap-2 text-sm">
                      <MessageCircle className="size-5" />
                      <span>Comentários em breve</span>
                    </span>
                  </div>
                </div>
              </div>
            </article>

            <section className="pt-6">
              <h2 className="px-1 text-lg font-bold">Comentários</h2>
              <Separator className="my-3" />
              <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                A área de comentários será habilitada em uma próxima versão.
                <br />
                <span className="text-xs opacity-80">Curtidas e respostas no estilo rede social.</span>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
