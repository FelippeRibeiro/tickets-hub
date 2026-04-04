import { Megaphone, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/user-avatar'
import { useNotifications } from '@/contexts/notifications-context'
import { FEED_REFETCH_EVENT } from '@/lib/feed-events'

export function NewTicketToasts() {
  const navigate = useNavigate()
  const { newTicketToasts, dismissNewTicketToast } = useNotifications()

  if (newTicketToasts.length === 0) {
    return null
  }

  return (
    <>
      {newTicketToasts.map((item) => (
        <div
          key={item.toastId}
          className="pointer-events-auto rounded-xl border border-border/70 bg-background/95 p-3 shadow-lg backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <UserAvatar
              userId={item.authorUserId}
              name={item.authorName}
              hasAvatar={!item.isAnonymous && item.authorUserId > 0}
              size="sm"
            />
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                dismissNewTicketToast(item.toastId)
                navigate('/')
                window.setTimeout(() => {
                  window.dispatchEvent(new CustomEvent(FEED_REFETCH_EVENT))
                }, 0)
              }}
            >
              <div className="flex items-center gap-2">
                <Megaphone className="size-3.5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Nova publicação</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm font-medium">{item.title}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {item.authorName} · {item.topicName}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Toque para abrir o feed atualizado</p>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              onClick={() => dismissNewTicketToast(item.toastId)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </>
  )
}
