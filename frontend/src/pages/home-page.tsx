import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Heart } from 'lucide-react';
import { ApiError, getTickets, getTopics, type TicketWithTopic, type Topic } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { ComposeTicketDialog } from '@/components/compose-ticket-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, initialsFromName } from '@/lib/utils';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function HomePage() {
  const { user } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [tickets, setTickets] = useState<TicketWithTopic[]>([]);
  const [topicFilter, setTopicFilter] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTopics = useCallback(async () => {
    const list = await getTopics();
    setTopics(list);
  }, []);

  const loadTickets = useCallback(async () => {
    const list = await getTickets(topicFilter ?? undefined);
    setTickets(list);
  }, [topicFilter]);

  useEffect(() => {
    void loadTopics().catch(() => {
      /* topics públicos — falha rara */
    });
  }, [loadTopics]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        await loadTickets();
        if (!cancelled) {
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Erro ao carregar tickets');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTickets]);

  const refreshFeed = useCallback(() => {
    void loadTickets();
  }, [loadTickets]);

  return (
    <div className="mx-auto min-h-svh max-w-xl border-x border-border">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Feed</h1>
            <p className="text-xs text-muted-foreground">Últimos tickets da comunidade</p>
          </div>
          {user && !user.is_admin ? (
            <ComposeTicketDialog topics={topics} onCreated={refreshFeed} />
          ) : user?.is_admin ? (
            <p className="max-w-[10rem] text-right text-xs text-muted-foreground">Contas admin não abrem tickets pelo app.</p>
          ) : null}
        </div>
      </header>

      <div className="border-b border-border px-2 py-2">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex w-max gap-2 pb-1">
            <Button type="button" size="sm" variant={topicFilter === null ? 'secondary' : 'ghost'} className={cn('shrink-0 rounded-full')} onClick={() => setTopicFilter(null)}>
              Todos
            </Button>
            {topics.map((t) => (
              <Button key={t.id} type="button" size="sm" variant={topicFilter === t.id ? 'secondary' : 'ghost'} className="shrink-0 rounded-full" onClick={() => setTopicFilter(t.id)}>
                {t.name || `Tópico ${t.id}`}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="divide-y divide-border">
        {error ? (
          <div className="p-6 text-center text-sm text-destructive">{error}</div>
        ) : loading ? (
          <div className="space-y-0 p-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border-b border-border p-4">
                <Skeleton className="mb-2 h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhum ticket ainda. Seja o primeiro a publicar.</div>
        ) : (
          tickets.map((t) => (
            <Link key={t.id} to={`/ticket/${t.id}`} className="block px-4 py-3 transition-colors hover:bg-muted/40">
              <div className="flex gap-3">
                <div
                  className="mt-1 flex size-10 shrink-0 select-none items-center justify-center rounded-full bg-muted text-xs font-semibold tracking-tight text-muted-foreground"
                  aria-hidden
                >
                  {initialsFromName(t.user_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{t.user_name}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{formatDate(t.created_at)}</span>
                  </div>
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    {t.topic_name || `Tópico #${t.topic_id}`}
                  </Badge>
                  <p className="mt-2 text-[15px] font-medium leading-snug">{t.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                  <div className="mt-3 flex max-w-xs items-center gap-6 text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-xs">
                      <Heart className="size-4 opacity-60" />
                      <span className="opacity-70">—</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs">
                      <MessageCircle className="size-4 opacity-60" />
                      <span className="opacity-70">Em breve</span>
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
