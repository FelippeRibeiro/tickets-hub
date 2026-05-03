import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import {
  ApiError,
  getMyTickets,
  getTickets,
  getTopics,
  likeTicket,
  unlikeTicket,
  type Ticket,
  type Topic,
} from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { ComposeTicketDialog } from '@/components/compose-ticket-dialog';
import { CreateTopicDialog } from '@/components/create-topic-dialog';
import { TicketFeedCard } from '@/components/ticket-feed-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { FEED_REFETCH_EVENT } from '@/lib/feed-events';
import { cn } from '@/lib/utils';

const sortLabels = {
  created_at_desc: 'Data de publicação',
  likes_desc: 'Mais curtidos',
  likes_asc: 'Menos curtidos',
  comments_desc: 'Mais comentados',
  comments_asc: 'Menos comentados',
} as const;

type HomePageProps = {
  onlyMine?: boolean;
  title?: string;
  subtitle?: string;
  /** Esconde o título principal quando dentro de “Minha atividade”. */
  embedded?: boolean;
}

export function HomePage({
  onlyMine = false,
  title = 'Feed',
  subtitle = 'Últimos tickets da comunidade',
  embedded = false,
}: HomePageProps) {
  const { user } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [topicFilter, setTopicFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'created_at_desc' | 'likes_desc' | 'likes_asc' | 'comments_desc' | 'comments_asc'>('created_at_desc');
  const [likedByTicket, setLikedByTicket] = useState<Record<number, boolean>>({});
  const [likesByTicket, setLikesByTicket] = useState<Record<number, number>>({});
  const [pendingLikeByTicket, setPendingLikeByTicket] = useState<Record<number, boolean>>({});
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTopics = useCallback(async () => {
    const list = await getTopics();
    setTopics(list);
    return list;
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const loadTickets = useCallback(async () => {
    const q = debouncedSearch || undefined;
    const list = onlyMine
      ? await getMyTickets(topicFilter ?? undefined, { q })
      : await getTickets(topicFilter ?? undefined, { mine: false, q });
    setTickets(list);
  }, [onlyMine, topicFilter, debouncedSearch]);

  useEffect(() => {
    void loadTopics().catch(() => {
      /* topics públicos — falha rara */
    });
  }, [loadTopics]);

  useEffect(() => {
    const onFeedRefetch = () => {
      void loadTickets();
    };
    window.addEventListener(FEED_REFETCH_EVENT, onFeedRefetch);
    return () => window.removeEventListener(FEED_REFETCH_EVENT, onFeedRefetch);
  }, [loadTickets]);

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

  const sortedTickets = useMemo(() => {
    const list = [...tickets];

    const getLikesCount = (ticket: Ticket) => likesByTicket[ticket.id] ?? ticket.likes_count ?? 0;
    const getCommentsCount = (ticket: Ticket) => ticket.comments_count ?? 0;
    const getCreatedAt = (ticket: Ticket) => new Date(ticket.created_at).getTime() || 0;

    list.sort((a, b) => {
      switch (sortBy) {
        case 'likes_desc':
          return getLikesCount(b) - getLikesCount(a) || getCreatedAt(b) - getCreatedAt(a);
        case 'likes_asc':
          return getLikesCount(a) - getLikesCount(b) || getCreatedAt(b) - getCreatedAt(a);
        case 'comments_desc':
          return getCommentsCount(b) - getCommentsCount(a) || getCreatedAt(b) - getCreatedAt(a);
        case 'comments_asc':
          return getCommentsCount(a) - getCommentsCount(b) || getCreatedAt(b) - getCreatedAt(a);
        case 'created_at_desc':
        default:
          return getCreatedAt(b) - getCreatedAt(a);
      }
    });

    return list;
  }, [likesByTicket, sortBy, tickets]);

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
    <div
      className={cn(
        embedded ? 'min-h-0' : 'mx-auto min-h-svh max-w-2xl border-x border-border/70 bg-card/10'
      )}
    >
      {embedded ? (
        <div className="sticky top-0 z-30 flex justify-end border-b border-border/70 bg-background/90 px-5 py-3 backdrop-blur">
          {user ? (
            <ComposeTicketDialog topics={topics} onCreated={refreshFeed} onTopicCreated={loadTopics} />
          ) : null}
        </div>
      ) : (
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 px-5 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight">{title}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
            </div>
            {user ? <ComposeTicketDialog topics={topics} onCreated={refreshFeed} onTopicCreated={loadTopics} /> : null}
          </div>
        </header>
      )}

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
        <div className="mt-3">
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por título, descrição ou tópico…"
            className="h-9"
            aria-label="Buscar tickets"
          />
        </div>
      </div>

      <div className="px-4 py-2">
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground">
                  <ArrowUpDown className="size-3.5" />
                  {sortLabels[sortBy]}
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuRadioGroup value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <DropdownMenuRadioItem value="created_at_desc">Data de publicação</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="likes_desc">Mais curtidos</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="likes_asc">Menos curtidos</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="comments_desc">Mais comentados</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="comments_asc">Menos comentados</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
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
          <div className="rounded-xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
            {debouncedSearch
              ? 'Nenhum ticket encontrado para sua busca.'
              : onlyMine
                ? 'Você ainda não criou nenhum ticket.'
                : 'Nenhum ticket ainda. Seja o primeiro a publicar.'}
          </div>
        ) : (
          sortedTickets.map((t) => (
            <TicketFeedCard
              key={t.id}
              ticket={t}
              liked={!!likedByTicket[t.id]}
              likesCount={likesByTicket[t.id] ?? t.likes_count ?? 0}
              pendingLike={!!pendingLikeByTicket[t.id]}
              onToggleLike={onToggleLike}
            />
          ))
        )}
      </div>
    </div>
  );
}
