import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { UserAvatar } from '@/components/user-avatar'
import { useNotifications } from '@/contexts/notifications-context'

function formatRelativeDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function notificationText(
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

export function NotificationsMenu() {
  const navigate = useNavigate()
  const {
    items,
    unreadCount,
    loading,
    connected,
    error,
    markRead,
    markAllRead,
  } = useNotifications()
  const [open, setOpen] = useState(false)

  const latestItems = useMemo(() => items.slice(0, 10), [items])

  async function handleOpenTicket(notificationId: number, ticketId: number, alreadyRead: boolean) {
    if (!alreadyRead) {
      await markRead(notificationId)
    }
    setOpen(false)
    navigate(`/ticket/${ticketId}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="relative gap-2">
            <Bell className="size-4" />
            <span className="hidden sm:inline">Notificações</span>
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </Button>
        }
      />
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-[min(92vw,24rem)] overflow-hidden p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Notificações</DialogTitle>
          <DialogDescription>
            Acompanhe curtidas e comentários recebidos em tempo real.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] ${connected ? 'text-emerald-400' : 'text-muted-foreground'}`}>
              {connected ? 'Ao vivo' : 'Offline'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={unreadCount === 0}
              onClick={() => void markAllRead()}
            >
              <CheckCheck className="size-3.5" />
              Ler tudo
            </Button>
          </div>
        </div>
        <Separator />
        <div className="max-h-[60svh] overflow-y-auto p-2">
          {error ? (
            <p className="px-2 py-4 text-center text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {loading ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              Carregando notificações...
            </p>
          ) : latestItems.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              Você ainda não tem notificações.
            </p>
          ) : (
            latestItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`mb-1 flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/70 ${
                  item.read_at ? 'opacity-75' : 'bg-muted/40'
                }`}
                onClick={() => void handleOpenTicket(item.id, item.ticket_id, Boolean(item.read_at))}
              >
                <UserAvatar
                  userId={item.actor_id ?? 0}
                  name={item.actor_name}
                  hasAvatar={item.actor_has_avatar && Boolean(item.actor_id)}
                  size="sm"
                  enableAvatarPreview={false}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {notificationText(item.type, item.actor_name)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{item.ticket_title}</p>
                  {item.comment_preview ? (
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                      {item.comment_preview.replace(/\s+/g, ' ').trim()}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatRelativeDate(item.created_at)}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

