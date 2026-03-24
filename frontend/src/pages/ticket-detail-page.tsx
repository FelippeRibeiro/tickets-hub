import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle } from 'lucide-react';
import { ApiError, createTicketComment, getTicket, getTicketComments, getTicketLikes, likeTicket, type Comment, type TicketWithTopic, unlikeTicket } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { initialsFromName } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

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

function normalizeCommentsPage(
  payload: unknown,
  fallbackLimit = 10,
  fallbackOffset = 0
): { items: Comment[]; has_more: boolean; next_offset: number } {
  // Backward compatibility: old backend returned only array.
  if (Array.isArray(payload)) {
    const items = payload as Comment[]
    return {
      items,
      has_more: items.length >= fallbackLimit,
      next_offset: fallbackOffset + items.length,
    }
  }
  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { items?: unknown }).items)
  ) {
    const page = payload as {
      items: Comment[]
      has_more?: boolean
      next_offset?: number
    }
    return {
      items: page.items,
      has_more: Boolean(page.has_more),
      next_offset: Number(page.next_offset ?? fallbackOffset + page.items.length),
    }
  }
  return {
    items: [],
    has_more: false,
    next_offset: fallbackOffset,
  }
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ticketId = Number(id);
  const [ticket, setTicket] = useState<TicketWithTopic | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [nextOffset, setNextOffset] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [togglingLike, setTogglingLike] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const commentsContainerRef = useRef<HTMLDivElement | null>(null);
  const COMMENT_PAGE_SIZE = 10;

  const commentsCountLabel = useMemo(() => {
    const count = ticket?.comments_count ?? comments.length;
    return `${count} comentário${count === 1 ? '' : 's'}`;
  }, [ticket?.comments_count, comments.length]);

  async function loadCommentsPage(targetTicketID: number, offset: number) {
    if (loadingComments) {
      return;
    }
    setLoadingComments(true);
    try {
      const page = await getTicketComments(targetTicketID, {
        limit: COMMENT_PAGE_SIZE,
        offset,
      });
      const normalized = normalizeCommentsPage(page, COMMENT_PAGE_SIZE, offset);
      setComments((prev) => (offset === 0 ? normalized.items : [...prev, ...normalized.items]));
      setHasMoreComments(normalized.has_more);
      setNextOffset(normalized.next_offset);
    } finally {
      setLoadingComments(false);
    }
  }

  useEffect(() => {
    if (!id || Number.isNaN(ticketId) || ticketId <= 0) {
      setError('Ticket inválido');
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [t, c, l] = await Promise.all([
          getTicket(ticketId),
          getTicketComments(ticketId, { limit: COMMENT_PAGE_SIZE, offset: 0 }),
          getTicketLikes(ticketId),
        ]);
        if (!cancelled) {
          const normalized = normalizeCommentsPage(c, COMMENT_PAGE_SIZE, 0);
          setTicket(t);
          setComments(normalized.items);
          setHasMoreComments(normalized.has_more);
          setNextOffset(normalized.next_offset);
          setLikesCount(l.count);
          setLiked(l.liked);
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

  useEffect(() => {
    const el = commentsContainerRef.current;
    if (!el) {
      return;
    }
    const onScroll = () => {
      if (!ticket || !hasMoreComments || loadingComments) {
        return;
      }
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (nearBottom) {
        void loadCommentsPage(ticket.id, nextOffset);
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [ticket, hasMoreComments, loadingComments, nextOffset]);

  async function onToggleLike() {
    if (!ticket || togglingLike) {
      return;
    }
    setTogglingLike(true);
    try {
      if (liked) {
        await unlikeTicket(ticket.id);
        setLiked(false);
        setLikesCount((prev) => Math.max(prev - 1, 0));
      } else {
        const summary = await likeTicket(ticket.id);
        setLiked(summary.liked);
        setLikesCount(summary.count);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao atualizar curtida');
    } finally {
      setTogglingLike(false);
    }
  }

  async function onSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket || sendingComment) {
      return;
    }
    const trimmed = commentText.trim();
    if (!trimmed) {
      return;
    }
    setSendingComment(true);
    try {
      const created = await createTicketComment(ticket.id, trimmed);
      setComments((prev) => [...prev, created]);
      setCommentText('');
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              comments_count: (prev.comments_count ?? 0) + 1,
            }
          : prev
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao enviar comentário');
    } finally {
      setSendingComment(false);
    }
  }

  return (
    <div className="mx-auto min-h-svh max-w-2xl border-x border-border/70 bg-card/10">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border/70 bg-background/90 px-3 py-3 backdrop-blur">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Voltar" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </Button>
        <Link to="/" className="text-sm font-semibold hover:underline">
          Ticket
        </Link>
      </header>

      <div className="px-5 pb-12 pt-2">
        {loading ? (
          <div className="space-y-4 pt-6">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <p className="p-6 text-center text-sm text-destructive">{error}</p>
        ) : ticket ? (
          <>
            <article className="rounded-xl border border-border/70 bg-card/60 p-5 shadow-sm">
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
                  <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight">{ticket.title}</h1>
                  <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{ticket.description}</p>
                  <div className="mt-6 flex flex-wrap gap-8 border-t border-border/70 pt-4 text-muted-foreground">
                    <button type="button" className="flex items-center gap-2 text-sm disabled:opacity-50" onClick={onToggleLike} disabled={togglingLike}>
                      <Heart className="size-5" />
                      <span>{likesCount} curtida{likesCount === 1 ? '' : 's'}</span>
                    </button>
                    <span className="flex items-center gap-2 text-sm">
                      <MessageCircle className="size-5" />
                      <span>{commentsCountLabel}</span>
                    </span>
                  </div>
                </div>
              </div>
            </article>

            <section className="pt-7">
              <h2 className="px-1 text-lg font-bold">Comentários</h2>
              <Separator className="my-3" />
              <form onSubmit={onSubmitComment} className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Escreva um comentário..."
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={sendingComment || !commentText.trim()}>
                    {sendingComment ? 'Enviando...' : 'Comentar'}
                  </Button>
                </div>
              </form>

              <div ref={commentsContainerRef} className="mt-4 max-h-104 space-y-3 overflow-y-auto pr-1">
                {comments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                    Ainda não há comentários neste ticket.
                  </div>
                ) : (
                  comments.map((comment) => (
                    <article key={comment.id} className="rounded-xl border border-border bg-card p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                          {initialsFromName(comment.user_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{comment.user_name}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</p>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{comment.comment}</p>
                    </article>
                  ))
                )}
                {loadingComments ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">Carregando mais comentários…</p>
                ) : null}
                {!hasMoreComments && comments.length > 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">Fim dos comentários.</p>
                ) : null}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
