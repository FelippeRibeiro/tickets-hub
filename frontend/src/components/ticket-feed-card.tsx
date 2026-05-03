import { Link } from 'react-router-dom'
import { MessageCircle, Heart } from 'lucide-react'
import type { Ticket } from '@/lib/api'
import { TicketFeedAttachments } from '@/components/ticket-feed-attachments'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/user-avatar'
import { cn } from '@/lib/utils'

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export type TicketFeedCardProps = {
  ticket: Ticket
  liked: boolean
  likesCount: number
  pendingLike: boolean
  onToggleLike: (e: React.MouseEvent, ticketID: number) => void
}

export function TicketFeedCard({
  ticket: t,
  liked,
  likesCount,
  pendingLike,
  onToggleLike,
}: TicketFeedCardProps) {
  return (
    <article className="mb-3 rounded-xl border border-border/70 bg-card/60 px-4 py-3 shadow-sm transition-colors hover:bg-muted/30">
      <div className="flex items-start gap-3">
        <UserAvatar
          userId={t.user_id}
          name={t.user_name}
          hasAvatar={Boolean(t.user_has_avatar)}
          className="size-10 shrink-0 self-start"
        />
        <div className="min-w-0 flex-1">
          <Link
            to={`/ticket/${t.id}`}
            className="-m-1 block rounded-lg p-1 outline-offset-2 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
          >
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
          </Link>
          {t.attachments && t.attachments.length > 0 ? (
            <div className="mt-2">
              <TicketFeedAttachments attachments={t.attachments} />
            </div>
          ) : null}
          <div className="mt-3 flex max-w-xs items-center gap-6 text-muted-foreground">
            <button
              type="button"
              className={cn(
                'flex items-center gap-1.5 text-xs',
                liked ? 'text-red-400' : 'text-muted-foreground'
              )}
              disabled={pendingLike}
              onClick={(e) => void onToggleLike(e, t.id)}
            >
              <Heart className={cn('size-4', liked ? 'fill-current opacity-100' : 'opacity-60')} />
              <span className="opacity-90">{likesCount}</span>
            </button>
            <Link
              to={`/ticket/${t.id}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <MessageCircle
                className={`size-4 opacity-60 ${(t.comments_count ?? 0) > 0 ? 'text-green-400' : 'text-muted-foreground'}`}
              />
              <span className="opacity-70">{t.comments_count ?? 0}</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
