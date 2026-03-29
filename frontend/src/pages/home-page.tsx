import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Heart } from 'lucide-react';
import { ApiError, getTickets, getTopics, likeTicket, unlikeTicket, type Ticket, type Topic } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { ComposeTicketDialog } from '@/components/compose-ticket-dialog';
import { CreateTopicDialog } from '@/components/create-topic-dialog';
import { TicketFeedAttachments } from '@/components/ticket-feed-attachments';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';

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
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [topicFilter, setTopicFilter] = useState<number | null>(null);
  const [likedByTicket, setLikedByTicket] = useState<Record<number, boolean>>({});
  const [likesByTicket, setLikesByTicket] = useState<Record<number, number>>({});
  const [pendingLikeByTicket, setPendingLikeByTicket] = useState<Record<number, boolean>>({});
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

  useEffect(() => {
    setLikedByTicket(Object.fromEntries(tickets.map((t) => [t.id, Boolean(t.liked)])));
    setLikesByTicket(Object.fromEntries(tickets.map((t) => [t.id, t.likes_count ?? 0])));
  }, [tickets]);

  const refreshFeed = useCallback(() => {
    void loadTickets();
  }, [loadTickets]);

  async function onToggleLike(e: React.MouseEvent, ticketID: number) {
    e.preventDefault();
    e.stopPropagation();
    if (pendingLikeByTicket[ticketID]) {
      return;
    }
    setPendingLikeByTicket((prev) => ({ ...prev, [ticketID]: true }));
    try {
      const isLiked = !!likedByTicket[ticketID];
      if (isLiked) {
        await unlikeTicket(ticketID);
        setLikedByTicket((prev) => ({ ...prev, [ticketID]: false }));
        setLikesByTicket((prev) => ({ ...prev, [ticketID]: Math.max((prev[ticketID] ?? 1) - 1, 0) }));
      } else {
        const summary = await likeTicket(ticketID);
        setLikedByTicket((prev) => ({ ...prev, [ticketID]: summary.liked }));
        setLikesByTicket((prev) => ({ ...prev, [ticketID]: summary.count }));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao curtir ticket');
    } finally {
      setPendingLikeByTicket((prev) => ({ ...prev, [ticketID]: false }));
    }
  }

  return (
    <div className="mx-auto min-h-svh max-w-2xl border-x border-border/70 bg-card/10">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 px-5 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Feed</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Últimos tickets da comunidade</p>
          </div>
          {user ? <ComposeTicketDialog topics={topics} onCreated={refreshFeed} /> : null}
        </div>
      </header>

      <div className="border-b border-border/70 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1 overflow-x-auto scroll-smooth scrollbar-x-hover">
            <div className="flex w-max min-w-full gap-2.5 pb-0.5 pr-1">
              <Button type="button" size="sm" variant={topicFilter === null ? 'secondary' : 'ghost'} className={cn('shrink-0 rounded-full')} onClick={() => setTopicFilter(null)}>
                Todos
              </Button>
              {topics.map((t) => (
                <Button key={t.id} type="button" size="sm" variant={topicFilter === t.id ? 'secondary' : 'ghost'} className="shrink-0 rounded-full" onClick={() => setTopicFilter(t.id)}>
                  {t.name || `Tópico ${t.id}`}
                </Button>
              ))}
            </div>
          </div>
          {user ? <CreateTopicDialog onCreated={() => void loadTopics()} /> : null}
        </div>
      </div>

      <div className="p-3">
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center text-sm text-destructive">{error}</div>
        ) : loading ? (
          <div className="space-y-3 p-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border/70 bg-card/60 p-4">
                <Skeleton className="mb-2 h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">Nenhum ticket ainda. Seja o primeiro a publicar.</div>
        ) : (
          tickets.map((t) => (
            <Link key={t.id} to={`/ticket/${t.id}`} className="mb-3 block rounded-xl border border-border/70 bg-card/60 px-4 py-3 shadow-sm transition-colors hover:bg-muted/30">
              <div className="flex gap-3">
                <UserAvatar
                  userId={t.user_id}
                  name={t.user_name}
                  hasAvatar={Boolean(t.user_has_avatar)}
                  className="mt-1 size-10"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{t.user_name}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{formatDate(t.created_at)}</span>
                  </div>
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    {t.topic_name || `Tópico #${t.topic_id}`}
                  </Badge>
                  <p className="mt-2 text-base font-semibold leading-snug">{t.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                  {t.attachments && t.attachments.length > 0 ? (
                    <TicketFeedAttachments attachments={t.attachments} />
                  ) : null}
                  <div className="mt-3 flex max-w-xs items-center gap-6 text-muted-foreground">
                    <button
                      type="button"
                      className={cn('flex items-center gap-1.5 text-xs', likedByTicket[t.id] ? 'text-red-400' : 'text-muted-foreground')}
                      disabled={pendingLikeByTicket[t.id]}
                      onClick={(e) => void onToggleLike(e, t.id)}
                    >
                      <Heart className={cn('size-4', likedByTicket[t.id] ? 'fill-current opacity-100' : 'opacity-60')} />
                      <span className="opacity-90">{likesByTicket[t.id] ?? t.likes_count ?? 0}</span>
                    </button>
                    <span className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <MessageCircle className={`size-4 opacity-60 ${(t.comments_count ?? 0 > 0) ? 'text-green-400' : 'text-muted-foreground'}`} />
                      <span className="opacity-70">{t.comments_count ?? 0}</span>
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
