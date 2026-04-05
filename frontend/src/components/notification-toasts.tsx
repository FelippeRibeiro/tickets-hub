import { Bell, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/user-avatar'
import { useNotifications } from '@/contexts/notifications-context'

function toastText(
  type: 'like' | 'comment' | 'participant_comment' | 'reply' | 'comment_like',
  actorName: string
) {
  if (type === 'participant_comment') {
    return `${actorName} também comentou na publicação`
  }
  if (type === 'reply') {
    return `${actorName} respondeu ao seu comentário`
  }
  if (type === 'comment_like') {
    return `${actorName} curtiu seu comentário`
  }
  if (type === 'comment') {
    return `${actorName} comentou no seu ticket`
  }
  return `${actorName} curtiu seu ticket`
}

export function NotificationToasts() {
  const navigate = useNavigate()
  const { transientItems, dismissTransient, markRead } = useNotifications()

  if (transientItems.length === 0) {
    return null
  }

  return (
    <>
      {transientItems.map((item) => (
        <div
          key={item.id}
          className="pointer-events-auto rounded-xl border border-border/70 bg-background/95 p-3 shadow-lg backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <UserAvatar
              userId={item.actor_id ?? 0}
              name={item.actor_name}
              hasAvatar={item.actor_has_avatar && Boolean(item.actor_id)}
              size="sm"
            />
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                if (!item.read_at) {
                  void markRead(item.id)
                }
                dismissTransient(item.id)
                navigate(`/ticket/${item.ticket_id}`)
              }}
            >
              <div className="flex items-center gap-2">
                <Bell className="size-3.5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Nova notificação</span>
              </div>
              <p className="mt-1 text-sm font-medium">{toastText(item.type, item.actor_name)}</p>
              <p className="truncate text-xs text-muted-foreground">{item.ticket_title}</p>
              {item.comment_preview ? (
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                  {item.comment_preview.replace(/\s+/g, ' ').trim()}
                </p>
              ) : null}
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              onClick={() => dismissTransient(item.id)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </>
  )
}

