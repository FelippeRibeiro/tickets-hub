import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ApiError,
  getMyComments,
  getMyLikedTickets,
  likeTicket,
  unlikeTicket,
  type MyActivityComment,
  type Ticket,
} from '@/lib/api';
import { TicketFeedCard } from '@/components/ticket-feed-card';
import { TicketFeedAttachments } from '@/components/ticket-feed-attachments';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';
import { FEED_REFETCH_EVENT } from '@/lib/feed-events';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-muted text-foreground'
      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
  );

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

export function ActivityPageLayout() {
  return (
    <div className="mx-auto min-h-svh max-w-2xl border-x border-border/70 bg-card/10">
      <header className="border-b border-border/70 bg-background/90 px-4 py-4 backdrop-blur sm:px-5">
        <h1 className="text-xl font-bold tracking-tight">Minha atividade</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Seus tickets, comentários e curtidas
        </p>
      </header>
      <div className="sticky top-0 z-30 border-b border-border/70 bg-background/95 px-2 py-2 backdrop-blur sm:px-4">
        <nav
          className="flex gap-1 overflow-x-auto scroll-smooth pb-0.5"
          aria-label="Abas de atividade"
        >
          <NavLink to="/minha-atividade/tickets" className={tabClass} end>
            Meus tickets
          </NavLink>
          <NavLink to="/minha-atividade/comentarios" className={tabClass}>
            Meus comentários
          </NavLink>
          <NavLink to="/minha-atividade/likes" className={tabClass}>
            Meus likes
          </NavLink>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}

function commentPreview(text: string, max = 220) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function ActivityCommentsTab() {
  const navigate = useNavigate();
  const [items, setItems] = useState<MyActivityComment[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = 20;

  const load = useCallback(
    async (fromOffset: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await getMyComments({ limit, offset: fromOffset });
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setOffset(fromOffset + res.items.length);
        setHasMore(res.has_more);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Erro ao carregar comentários');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    void load(0, false);
  }, [load]);

  return (
    <div className="p-3">
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <div className="space-y-3 p-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border/70 bg-card/60 p-4">
              <Skeleton className="mb-2 h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
          Você ainda não comentou em nenhum ticket.
        </div>
      ) : (
        <>
          {items.map((c) => (
            <article
              key={c.id}
              role="link"
              tabIndex={0}
              className="mb-3 cursor-pointer rounded-xl border border-border/70 bg-card/60 px-4 py-3 shadow-sm outline-offset-2 transition-colors hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => navigate(`/ticket/${c.ticket_id}#comment-${c.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/ticket/${c.ticket_id}#comment-${c.id}`);
                }
              }}
            >
              <div className="flex items-start gap-3">
                <UserAvatar
                  userId={c.user_id}
                  name={c.user_name}
                  hasAvatar={Boolean(c.user_has_avatar)}
                  className="size-10 shrink-0 pointer-events-none"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">{c.user_name}</span>
                    <span className="text-muted-foreground">·</span>
                    <time className="text-xs text-muted-foreground" dateTime={c.created_at}>
                      {formatDate(c.created_at)}
                    </time>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {c.topic_name || `Tópico`}
                    </Badge>
                    <span className="text-xs font-medium text-primary">{c.ticket_title}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap wrap-anywhere text-sm text-foreground">
                    {commentPreview(c.comment)}
                  </p>
                  {c.parent_user_name ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Resposta a {c.parent_user_name}
                    </p>
                  ) : null}
                  {c.attachments && c.attachments.length > 0 ? (
                    <div
                      className="mt-2"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <TicketFeedAttachments attachments={c.attachments} />
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
          {hasMore ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={loadingMore}
                onClick={() => void load(offset, true)}
              >
                {loadingMore ? 'Carregando…' : 'Carregar mais'}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function ActivityLikesTab() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likedByTicket, setLikedByTicket] = useState<Record<number, boolean>>({});
  const [likesByTicket, setLikesByTicket] = useState<Record<number, number>>({});
  const [pendingLikeByTicket, setPendingLikeByTicket] = useState<Record<number, boolean>>({});
  const limit = 20;

  const load = useCallback(
    async (fromOffset: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await getMyLikedTickets({ limit, offset: fromOffset });
        setTickets((prev) => (append ? [...prev, ...res.items] : res.items));
        setOffset(fromOffset + res.items.length);
        setHasMore(res.has_more);
        if (!append) {
          setLikedByTicket(Object.fromEntries(res.items.map((t) => [t.id, true])));
          setLikesByTicket(
            Object.fromEntries(res.items.map((t) => [t.id, t.likes_count ?? 0]))
          );
        } else {
          setLikedByTicket((prev) => {
            const next = { ...prev };
            for (const t of res.items) {
              next[t.id] = true;
            }
            return next;
          });
          setLikesByTicket((prev) => {
            const next = { ...prev };
            for (const t of res.items) {
              next[t.id] = t.likes_count ?? 0;
            }
            return next;
          });
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Erro ao carregar curtidas');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    void load(0, false);
  }, [load]);

  useEffect(() => {
    const onRefetch = () => {
      void load(0, false);
    };
    window.addEventListener(FEED_REFETCH_EVENT, onRefetch);
    return () => window.removeEventListener(FEED_REFETCH_EVENT, onRefetch);
  }, [load]);

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
        setLikesByTicket((prev) => ({
          ...prev,
          [ticketID]: Math.max((prev[ticketID] ?? 1) - 1, 0),
        }));
        setTickets((prev) => prev.filter((t) => t.id !== ticketID));
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
    <div className="p-3">
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center text-sm text-destructive">
          {error}
        </div>
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
        <div className="rounded-xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
          Você ainda não curtiu nenhum ticket.
        </div>
      ) : (
        <>
          {tickets.map((t) => (
            <TicketFeedCard
              key={t.id}
              ticket={t}
              liked={!!likedByTicket[t.id]}
              likesCount={likesByTicket[t.id] ?? t.likes_count ?? 0}
              pendingLike={!!pendingLikeByTicket[t.id]}
              onToggleLike={onToggleLike}
            />
          ))}
          {hasMore ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={loadingMore}
                onClick={() => void load(offset, true)}
              >
                {loadingMore ? 'Carregando…' : 'Carregar mais'}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
