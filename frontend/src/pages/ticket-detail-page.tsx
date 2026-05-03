import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Reply, Trash2 } from 'lucide-react';
import {
  ApiError,
  createTicketComment,
  deleteComment,
  deleteTicket,
  getTicket,
  getTicketComments,
  getTicketLikes,
  likeComment,
  likeTicket,
  uploadTicketAttachment,
  type Comment,
  unlikeComment,
  unlikeTicket,
  type Ticket,
  type TicketAttachment,
} from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { MediaCarousel } from '@/components/media-carousel';
import { AttachmentPreview } from '@/components/attachment-preview';
import { LinkPreviewCard } from '@/components/link-preview-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

type CommentNode = { comment: Comment; children: CommentNode[] };

/** Agrupa comentários em árvore (respostas logo abaixo do pai). */
function buildCommentTree(flat: Comment[]): CommentNode[] {
  if (flat.length === 0) return [];
  const byDate = (a: Comment, b: Comment) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  const ids = new Set(flat.map((c) => c.id));
  const roots = flat.filter((c) => !c.parent_comment_id || !ids.has(c.parent_comment_id));
  roots.sort(byDate);

  function childrenOf(parentId: number): CommentNode[] {
    const kids = flat.filter((c) => c.parent_comment_id === parentId);
    kids.sort(byDate);
    return kids.map((c) => ({ comment: c, children: childrenOf(c.id) }));
  }

  return roots.map((c) => ({ comment: c, children: childrenOf(c.id) }));
}

/** Remove um comentário e todos os descendentes (alinhado a ON DELETE CASCADE no servidor). */
function removeCommentBranch(flat: Comment[], removeId: number): Comment[] {
  const byParent = new Map<number, number[]>();
  for (const c of flat) {
    if (c.parent_comment_id) {
      const list = byParent.get(c.parent_comment_id) ?? [];
      list.push(c.id);
      byParent.set(c.parent_comment_id, list);
    }
  }
  const drop = new Set<number>();
  const stack = [removeId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    drop.add(id);
    for (const cid of byParent.get(id) ?? []) stack.push(cid);
  }
  return flat.filter((c) => !drop.has(c.id));
}

const urlPattern = /https?:\/\/[^\s<>"'`]+/gi;

function extractFirstURL(text: string) {
  return text.match(urlPattern)?.[0] ?? null;
}

function renderTextWithLinks(text: string) {
  const matches = Array.from(text.matchAll(urlPattern));
  if (matches.length === 0) {
    return text;
  }

  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, index) => {
    const url = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }
    nodes.push(
      <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4 break-all">
        {url}
      </a>,
    );
    lastIndex = start + url.length;
  });

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const ticketId = Number(id);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [anonymousComment, setAnonymousComment] = useState(false);
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
  const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null);
  const [deletingComment, setDeletingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [pendingCommentLike, setPendingCommentLike] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const commentFileInputRef = useRef<HTMLInputElement | null>(null);
  const commentFormRef = useRef<HTMLDivElement | null>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const commentsContainerRef = useRef<HTMLDivElement | null>(null);
  const COMMENT_PAGE_SIZE = 10;

  const canUploadAttachments = Boolean(user) && Boolean(ticket) && (user!.is_admin || user!.id === ticket!.user_id);
  const canDeleteTicket = Boolean(ticket?.is_owner);

  const commentsCountLabel = useMemo(() => {
    const count = ticket?.comments_count ?? comments.length;
    return `${count} comentário${count === 1 ? '' : 's'}`;
  }, [ticket?.comments_count, comments.length]);
  const ticketLink = useMemo(() => (ticket ? extractFirstURL(ticket.description) : null), [ticket]);

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

  const targetCommentIdFromHash = useMemo(() => {
    const m = /^#comment-(\d+)$/.exec(location.hash);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [location.hash]);

  const scrollToCommentForm = useCallback(() => {
    window.setTimeout(() => {
      commentFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      commentTextareaRef.current?.focus();
    }, 0);
  }, []);

  const beginReplyTo = useCallback(
    (c: Comment) => {
      setReplyingTo(c);
      scrollToCommentForm();
    },
    [scrollToCommentForm],
  );

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

  /** Recarrega comentários desde o início (ex.: após publicar), com limite suficiente para montar a árvore. */
  async function reloadCommentsAfterPost(targetTicketID: number, minCount: number) {
    const limit = Math.min(Math.max(minCount, COMMENT_PAGE_SIZE), 500);
    setLoadingComments(true);
    try {
      const page = await getTicketComments(targetTicketID, { limit, offset: 0 });
      const normalized = normalizeCommentsPage(page, limit, 0);
      setComments(normalized.items);
      setHasMoreComments(normalized.has_more);
      setNextOffset(normalized.next_offset);
    } catch {
      /* mantém lista atual se falhar */
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

  const scrolledToCommentFromHashRef = useRef<number | null>(null);

  useEffect(() => {
    scrolledToCommentFromHashRef.current = null;
  }, [location.hash]);

  /** Abre páginas de comentários até o âncora existir e faz scroll (ex.: link da Minha atividade). */
  useEffect(() => {
    if (!ticket || loading || targetCommentIdFromHash == null) {
      return;
    }
    const found = comments.some((c) => c.id === targetCommentIdFromHash);
    if (found) {
      if (scrolledToCommentFromHashRef.current === targetCommentIdFromHash) {
        return;
      }
      scrolledToCommentFromHashRef.current = targetCommentIdFromHash;
      const cid = targetCommentIdFromHash;
      const t = window.setTimeout(() => {
        document.getElementById(`comment-${cid}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
      return () => window.clearTimeout(t);
    }
    if (hasMoreComments && !loadingComments) {
      void loadCommentsPage(ticket.id, nextOffset);
    }
  }, [
    ticket,
    loading,
    targetCommentIdFromHash,
    comments,
    hasMoreComments,
    loadingComments,
    nextOffset,
  ]);

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

  async function onToggleCommentLike(e: React.MouseEvent, commentId: number) {
    e.preventDefault();
    e.stopPropagation();
    if (!user || pendingCommentLike[commentId]) {
      return;
    }
    setPendingCommentLike((prev) => ({ ...prev, [commentId]: true }));
    try {
      const target = comments.find((c) => c.id === commentId);
      const isLiked = Boolean(target?.liked);
      if (isLiked) {
        const summary = await unlikeComment(commentId);
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId ? { ...c, liked: summary.liked, likes_count: summary.count } : c,
          ),
        );
      } else {
        const summary = await likeComment(commentId);
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId ? { ...c, liked: summary.liked, likes_count: summary.count } : c,
          ),
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao atualizar curtida do comentário');
    } finally {
      setPendingCommentLike((prev) => ({ ...prev, [commentId]: false }));
    }
  }

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
    if (sendingComment) {
      return;
    }
    if (!ticket) {
      return;
    }
    const trimmed = commentText.trim();
    if (!trimmed && commentFiles.length === 0) {
      return;
    }
    setSendingComment(true);
    try {
      await createTicketComment(ticket.id, trimmed, commentFiles.length > 0 ? commentFiles : undefined, {
        isAnonymous: anonymousComment,
        parentCommentId: replyingTo?.id,
      });
      const nextCount = (ticket.comments_count ?? 0) + 1;
      setCommentText('');
      setCommentFiles([]);
      setAnonymousComment(false);
      setReplyingTo(null);
      if (commentFileInputRef.current) {
        commentFileInputRef.current.value = '';
      }
      setTicket((prev: Ticket | null) =>
        prev
          ? {
              ...prev,
              comments_count: nextCount,
            }
          : prev,
      );
      await reloadCommentsAfterPost(ticket.id, nextCount);
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

  async function onDeleteComment() {
    if (!commentToDelete || deletingComment) {
      return;
    }
    setDeletingComment(true);
    try {
      await deleteComment(commentToDelete.id);
      let removed = 0;
      setComments((prev) => {
        const next = removeCommentBranch(prev, commentToDelete.id);
        removed = prev.length - next.length;
        return next;
      });
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              comments_count: Math.max((prev.comments_count ?? 0) - removed, 0),
            }
          : prev,
      );
      setCommentToDelete(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao excluir comentário');
    } finally {
      setDeletingComment(false);
    }
  }

  function renderAttachmentMedia(a: TicketAttachment) {
    if (a.mime_type.startsWith('image/')) {
      return (
        <AttachmentPreview key={a.id} attachment={a}>
          <img src={a.url} alt={a.original_name} className="max-h-72 w-full rounded-lg border border-border object-contain" loading="lazy" />
        </AttachmentPreview>
      );
    }
    if (a.mime_type.startsWith('video/')) {
      return (
        <AttachmentPreview key={a.id} attachment={a}>
          <video
            src={a.url}
            controls
            playsInline
            preload="metadata"
            className="mx-auto block max-h-[min(75vh,24rem)] w-full max-w-full rounded-lg border border-border bg-black object-contain"
          />
        </AttachmentPreview>
      );
    }
    return (
      <a key={a.id} href={a.url} className="text-sm text-primary underline" target="_blank" rel="noreferrer">
        {a.original_name}
      </a>
    );
  }

  function renderCommentNodes(nodes: CommentNode[], depth: number): ReactNode {
    return (
      <>
        {nodes.map((node) => {
          const { comment } = node;
          return (
            <div key={comment.id} className="space-y-2">
              <article
                id={`comment-${comment.id}`}
                className={cn(
                  'scroll-mt-28 rounded-xl border border-border bg-card p-3',
                  depth > 0 && 'bg-muted/15',
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <UserAvatar userId={comment.user_id} name={comment.user_name} hasAvatar={Boolean(comment.user_has_avatar)} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{comment.user_name}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</p>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    {user ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-muted-foreground hover:text-foreground"
                        onClick={() => beginReplyTo(comment)}
                      >
                        <Reply className="size-3.5" />
                        <span className="text-xs">Responder</span>
                      </Button>
                    ) : null}
                    {comment.is_owner || (user && user.is_admin) ? (
                      <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setCommentToDelete(comment)}>
                        <Trash2 className="size-4" />
                        Excluir
                      </Button>
                    ) : null}
                  </div>
                </div>
                {comment.parent_comment_id ? (
                  <p className="mb-2 border-l-2 border-muted-foreground/40 pl-2 text-xs text-muted-foreground">
                    Respondendo a{' '}
                    <span className="font-medium text-foreground">
                      {comment.parent_user_name?.trim() ? comment.parent_user_name : 'um comentário'}
                    </span>
                  </p>
                ) : null}
                {comment.comment ? (
                  <p className="whitespace-pre-wrap wrap-anywhere text-sm leading-relaxed">{renderTextWithLinks(comment.comment)}</p>
                ) : null}
                {comment.attachments && comment.attachments.length > 0 ? (
                  <div className="mt-3 grid gap-3">{comment.attachments.map((a) => renderAttachmentMedia(a))}</div>
                ) : null}
                <div className="mt-3 flex items-center gap-2">
                  {user ? (
                    <button
                      type="button"
                      className={cn(
                        'flex items-center gap-1.5 text-xs disabled:opacity-50',
                        comment.liked ? 'text-red-400' : 'text-muted-foreground',
                      )}
                      disabled={Boolean(pendingCommentLike[comment.id])}
                      onClick={(ev) => void onToggleCommentLike(ev, comment.id)}
                    >
                      <Heart className={cn('size-4', comment.liked ? 'fill-current opacity-100' : 'opacity-60')} />
                      <span>{comment.likes_count ?? 0}</span>
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Heart className="size-4 opacity-60" />
                      {comment.likes_count ?? 0}
                    </span>
                  )}
                </div>
              </article>
              {node.children.length > 0 ? (
                <div className="ml-1 space-y-2 border-l-2 border-primary/25 pl-3">{renderCommentNodes(node.children, depth + 1)}</div>
              ) : null}
            </div>
          );
        })}
      </>
    );
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
            <article className="overflow-hidden rounded-xl border border-border/70 bg-card/60 shadow-sm">
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <UserAvatar userId={ticket.user_id} name={ticket.user_name} hasAvatar={Boolean(ticket.user_has_avatar)} className="size-12 self-start" />
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
                        <Button type="button" variant="destructive" size="sm" className="shrink-0" onClick={() => setDeleteDialogOpen(true)}>
                          <Trash2 className="size-4" />
                          Excluir
                        </Button>
                      ) : null}
                    </div>
                    <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight">{ticket.title}</h1>
                    <p className="mt-4 whitespace-pre-wrap wrap-anywhere text-[15px] leading-relaxed text-foreground">
                      {renderTextWithLinks(ticket.description)}
                    </p>
                  </div>
                </div>
              </div>
              {ticket.attachments && ticket.attachments.length > 0 ? (
                <div className="border-t border-border/50 bg-muted/10 px-0 pt-3">
                  <MediaCarousel attachments={ticket.attachments} className="px-5" />
                </div>
              ) : null}
              <div className="space-y-4 p-5 pt-4">
                {ticketLink ? <LinkPreviewCard url={ticketLink} /> : null}
                <div className="flex flex-wrap gap-8 border-t border-border/70 pt-4 text-muted-foreground">
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
            </article>

            {canUploadAttachments ? (
              <div className="mt-6 rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="mb-2 text-sm font-medium">Adicionar imagem ou vídeo</p>
                <p className="mb-3 text-xs text-muted-foreground">Até 1 GB por arquivo. Formatos de imagem e vídeo comuns.</p>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => void onPickAttachmentFile(e)} />
                <Button type="button" variant="secondary" size="sm" disabled={uploadingFile} onClick={() => fileInputRef.current?.click()}>
                  {uploadingFile ? 'Enviando…' : 'Escolher arquivo'}
                </Button>
                {uploadError ? <p className="mt-2 text-sm text-destructive">{uploadError}</p> : null}
              </div>
            ) : null}

            <section className="pt-7">
              <h2 className="px-1 text-lg font-bold">Comentários</h2>
              <Separator className="my-3" />

              <div ref={commentsContainerRef} className="mt-4 max-h-104 space-y-3 overflow-y-auto pr-1">
                {comments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                    Ainda não há comentários neste ticket.
                  </div>
                ) : (
                  renderCommentNodes(commentTree, 0)
                )}
                {loadingComments ? <p className="py-2 text-center text-xs text-muted-foreground">Carregando mais comentários…</p> : null}
                {!hasMoreComments && comments.length > 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">Fim dos comentários.</p>
                ) : null}
              </div>

              {user ? (
                <div ref={commentFormRef} className="mt-6 scroll-mt-24">
                  <form onSubmit={onSubmitComment} className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                    {replyingTo ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/25 bg-background/80 px-3 py-2 text-sm">
                        <span className="min-w-0 truncate text-muted-foreground">
                          Respondendo a <span className="font-medium text-foreground">{replyingTo.user_name}</span>
                        </span>
                        <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setReplyingTo(null)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : null}
                    <Textarea
                      ref={commentTextareaRef}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Escreva um comentário (ou só anexe mídia)..."
                      rows={3}
                      maxLength={5000}
                    />
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
                          {commentFiles.length} {commentFiles.length === 1 ? 'arquivo' : 'arquivos'}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Você pode selecionar várias mídias de uma vez.</span>
                      )}
                    </div>
                    <label className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/60 p-3">
                      <input type="checkbox" checked={anonymousComment} onChange={(e) => setAnonymousComment(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border" />
                      <span className="text-sm text-muted-foreground">Comentar anonimamente. Seu nome e foto nao serao exibidos neste comentario.</span>
                    </label>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={sendingComment || (!commentText.trim() && commentFiles.length === 0)}>
                        {sendingComment ? 'Enviando...' : 'Comentar'}
                      </Button>
                    </div>
                  </form>
                </div>
              ) : (
                <p className="mt-6 rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                  Entre para comentar.{' '}
                  <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                    Entrar
                  </Link>
                </p>
              )}
            </section>
          </>
        ) : null}
      </div>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir ticket?</DialogTitle>
            <DialogDescription>Esta ação remove o ticket, comentários e anexos associados. Não poderá ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deletingTicket} onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={deletingTicket} onClick={() => void onDeleteTicket()}>
              {deletingTicket ? 'Excluindo...' : 'Confirmar exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(commentToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setCommentToDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir comentário?</DialogTitle>
            <DialogDescription>Esta ação remove o comentário e os anexos associados. Não poderá ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deletingComment} onClick={() => setCommentToDelete(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={deletingComment} onClick={() => void onDeleteComment()}>
              {deletingComment ? 'Excluindo...' : 'Confirmar exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
