import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Trash2 } from 'lucide-react';
import { ApiError, createTicketComment, deleteTicket, getTicket, getTicketComments, getTicketLikes, likeTicket, uploadTicketAttachment, type Comment, unlikeTicket, type Ticket, type TicketAttachment } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { AttachmentPreview } from '@/components/attachment-preview';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';
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

function normalizeCommentsPage(payload: unknown, fallbackLimit = 10, fallbackOffset = 0): { items: Comment[]; has_more: boolean; next_offset: number } {
  // Backward compatibility: old backend returned only array.
  if (Array.isArray(payload)) {
    const items = payload as Comment[];
    return {
      items,
      has_more: items.length >= fallbackLimit,
      next_offset: fallbackOffset + items.length,
    };
  }
  if (payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown }).items)) {
    const page = payload as {
      items: Comment[];
      has_more?: boolean;
      next_offset?: number;
    };
    return {
      items: page.items,
      has_more: Boolean(page.has_more),
      next_offset: Number(page.next_offset ?? fallbackOffset + page.items.length),
    };
  }
  return {
    items: [],
    has_more: false,
    next_offset: fallbackOffset,
  };
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const ticketId = Number(id);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [sendingComment, setSendingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [nextOffset, setNextOffset] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [togglingLike, setTogglingLike] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTicket, setDeletingTicket] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const commentFileInputRef = useRef<HTMLInputElement | null>(null);
  const commentsContainerRef = useRef<HTMLDivElement | null>(null);
  const COMMENT_PAGE_SIZE = 10;

  const canUploadAttachments =
    Boolean(user) && Boolean(ticket) && (user!.is_admin || user!.id === ticket!.user_id);
  const canDeleteTicket =
    Boolean(user) && Boolean(ticket) && (user!.is_admin || user!.id === ticket!.user_id);

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
        const [t, c, l] = await Promise.all([getTicket(ticketId), getTicketComments(ticketId, { limit: COMMENT_PAGE_SIZE, offset: 0 }), getTicketLikes(ticketId)]);
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
    if (!user || !ticket || togglingLike) {
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

  async function onPickAttachmentFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !ticket) {
      return;
    }
    setUploadError(null);
    setUploadingFile(true);
    try {
      await uploadTicketAttachment(ticket.id, file);
      const refreshed = await getTicket(ticket.id);
      setTicket(refreshed);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Falha ao enviar arquivo');
    } finally {
      setUploadingFile(false);
    }
  }

  async function onSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket || sendingComment) {
      return;
    }
    const trimmed = commentText.trim();
    if (!trimmed && commentFiles.length === 0) {
      return;
    }
    setSendingComment(true);
    try {
      const created = await createTicketComment(
        ticket.id,
        trimmed,
        commentFiles.length > 0 ? commentFiles : undefined,
      );
      setComments((prev) => [...prev, created]);
      setCommentText('');
      setCommentFiles([]);
      if (commentFileInputRef.current) {
        commentFileInputRef.current.value = '';
      }
      setTicket((prev: Ticket | null) =>
        prev
          ? {
              ...prev,
              comments_count: (prev.comments_count ?? 0) + 1,
            }
          : prev,
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao enviar comentário');
    } finally {
      setSendingComment(false);
    }
  }

  async function onDeleteTicket() {
    if (!ticket || deletingTicket) {
      return;
    }
    setDeletingTicket(true);
    try {
      await deleteTicket(ticket.id);
      navigate('/', { replace: true });
    } catch (e) {
      setDeleteDialogOpen(false);
      setError(e instanceof ApiError ? e.message : 'Falha ao excluir ticket');
    } finally {
      setDeletingTicket(false);
    }
  }

  function renderAttachmentMedia(a: TicketAttachment) {
    if (a.mime_type.startsWith('image/')) {
      return (
        <AttachmentPreview key={a.id} attachment={a}>
          <img
            src={a.url}
            alt={a.original_name}
            className="max-h-72 w-full rounded-lg border border-border object-contain"
            loading="lazy"
          />
        </AttachmentPreview>
      );
    }
    if (a.mime_type.startsWith('video/')) {
      return (
        <AttachmentPreview key={a.id} attachment={a}>
          <video
            src={a.url}
            controls
            className="max-h-72 w-full rounded-lg border border-border bg-black/40"
            preload="metadata"
          />
        </AttachmentPreview>
      );
    }
    return (
      <a
        key={a.id}
        href={a.url}
        className="text-sm text-primary underline"
        target="_blank"
        rel="noreferrer"
      >
        {a.original_name}
      </a>
    );
  }

  return (
    <div className="mx-auto min-h-svh max-w-2xl border-x border-border/70 bg-card/10">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border/70 bg-background/90 px-3 py-3 backdrop-blur">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Voltar" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </Button>
        <Link
          to={user ? '/' : '/login'}
          className="text-sm font-semibold hover:underline"
        >
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
                <UserAvatar
                  userId={ticket.user_id}
                  name={ticket.user_name}
                  hasAvatar={Boolean(ticket.user_has_avatar)}
                  className="size-12"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{ticket.user_name}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-sm text-muted-foreground">{formatDate(ticket.created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm text-primary">{ticket.topic_name || `Tópico #${ticket.topic_id}`}</p>
                    </div>
                    {canDeleteTicket ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setDeleteDialogOpen(true)}
                      >
                        <Trash2 className="size-4" />
                        Excluir
                      </Button>
                    ) : null}
                  </div>
                  <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight">{ticket.title}</h1>
                  <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{ticket.description}</p>
                  <div className="mt-6 flex flex-wrap gap-8 border-t border-border/70 pt-4 text-muted-foreground">
                    {user ? (
                      <button
                        type="button"
                        className={`flex items-center gap-2 text-sm disabled:opacity-50 cursor-pointer ${liked ? 'text-red-400' : 'text-muted-foreground'}`}
                        onClick={onToggleLike}
                        disabled={togglingLike}
                      >
                        <Heart className={cn('size-5', liked ? 'fill-current opacity-100' : 'opacity-60')} />
                        <span>
                          {likesCount} curtida{likesCount === 1 ? '' : 's'}
                        </span>
                      </button>
                    ) : (
                      <span className="flex items-center gap-2 text-sm">
                        <Heart className="size-5 opacity-60" />
                        <span>
                          {likesCount} curtida{likesCount === 1 ? '' : 's'}
                        </span>
                      </span>
                    )}
                    <span className="flex items-center gap-2 text-sm">
                      <MessageCircle className="size-5" />
                      <span>{commentsCountLabel}</span>
                    </span>
                  </div>
                </div>
              </div>
            </article>

            {ticket.attachments && ticket.attachments.length > 0 ? (
              <section className="mt-6 space-y-3">
                <h2 className="px-1 text-lg font-bold">Anexos</h2>
                <div className="grid gap-4 sm:grid-cols-1">
                  {ticket.attachments.map((a) => renderAttachmentMedia(a))}
                </div>
              </section>
            ) : null}

            {canUploadAttachments ? (
              <div className="mt-6 rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="mb-2 text-sm font-medium">Adicionar imagem ou vídeo</p>
                <p className="mb-3 text-xs text-muted-foreground">Até 1 GB por arquivo. Formatos de imagem e vídeo comuns.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => void onPickAttachmentFile(e)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={uploadingFile}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingFile ? 'Enviando…' : 'Escolher arquivo'}
                </Button>
                {uploadError ? <p className="mt-2 text-sm text-destructive">{uploadError}</p> : null}
              </div>
            ) : null}

            <section className="pt-7">
              <h2 className="px-1 text-lg font-bold">Comentários</h2>
              <Separator className="my-3" />
              {user ? (
                <form onSubmit={onSubmitComment} className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                  <Textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Escreva um comentário (ou só anexe mídia)..." rows={3} />
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      ref={commentFileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="max-w-full text-sm file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-sm"
                      onChange={(e) => {
                        const list = e.target.files;
                        setCommentFiles(list ? Array.from(list) : []);
                      }}
                    />
                    {commentFiles.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {commentFiles.length}{' '}
                        {commentFiles.length === 1 ? 'arquivo' : 'arquivos'}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={
                        sendingComment ||
                        (!commentText.trim() && commentFiles.length === 0)
                      }
                    >
                      {sendingComment ? 'Enviando...' : 'Comentar'}
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                  Entre para comentar.{' '}
                  <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                    Entrar
                  </Link>
                </p>
              )}

              <div ref={commentsContainerRef} className="mt-4 max-h-104 space-y-3 overflow-y-auto pr-1">
                {comments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">Ainda não há comentários neste ticket.</div>
                ) : (
                  comments.map((comment) => (
                    <article key={comment.id} className="rounded-xl border border-border bg-card p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <UserAvatar
                          userId={comment.user_id}
                          name={comment.user_name}
                          hasAvatar={Boolean(comment.user_has_avatar)}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{comment.user_name}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</p>
                        </div>
                      </div>
                      {comment.comment ? (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{comment.comment}</p>
                      ) : null}
                      {comment.attachments && comment.attachments.length > 0 ? (
                        <div className="mt-3 grid gap-3">
                          {comment.attachments.map((a) => renderAttachmentMedia(a))}
                        </div>
                      ) : null}
                    </article>
                  ))
                )}
                {loadingComments ? <p className="py-2 text-center text-xs text-muted-foreground">Carregando mais comentários…</p> : null}
                {!hasMoreComments && comments.length > 0 ? <p className="py-2 text-center text-xs text-muted-foreground">Fim dos comentários.</p> : null}
              </div>
            </section>
          </>
        ) : null}
      </div>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir ticket?</DialogTitle>
            <DialogDescription>
              Esta ação remove o ticket, comentários e anexos associados. Não poderá ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deletingTicket}
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingTicket}
              onClick={() => void onDeleteTicket()}
            >
              {deletingTicket ? 'Excluindo...' : 'Confirmar exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
