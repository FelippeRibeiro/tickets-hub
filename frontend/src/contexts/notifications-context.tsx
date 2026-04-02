import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/contexts/auth-context'
import {
  ApiError,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '@/lib/api'

type NotificationsState = {
  items: Notification[]
  unreadCount: number
  loading: boolean
  connected: boolean
  error: string | null
  refresh: () => Promise<void>
  markRead: (notificationId: number) => Promise<void>
  markAllRead: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsState | null>(null)

function sortNotifications(items: Notification[]) {
  return [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([])
      setUnreadCount(0)
      setError(null)
      return
    }

    setLoading(true)
    try {
      const payload = await getNotifications()
      setItems(sortNotifications(payload.items))
      setUnreadCount(payload.unread_count)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel carregar notificacoes.')
    } finally {
      setLoading(false)
    }
  }, [user])

  const markRead = useCallback(async (notificationId: number) => {
    await markNotificationRead(notificationId)
    setItems((prev) =>
      prev.map((item) =>
        item.id === notificationId && !item.read_at
          ? { ...item, read_at: new Date().toISOString() }
          : item
      )
    )
    setUnreadCount((prev) => Math.max(prev - 1, 0))
  }, [])

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead()
    const now = new Date().toISOString()
    setItems((prev) => prev.map((item) => ({ ...item, read_at: item.read_at ?? now })))
    setUnreadCount(0)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!user) {
      socketRef.current?.close()
      socketRef.current = null
      setConnected(false)
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/notifications/ws`)
    socketRef.current = socket

    socket.onopen = () => {
      setConnected(true)
    }

    socket.onclose = () => {
      setConnected(false)
      if (socketRef.current === socket) {
        socketRef.current = null
      }
    }

    socket.onerror = () => {
      setConnected(false)
    }

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string
          notification?: Notification
        }
        if (payload.type !== 'notification.created' || !payload.notification) {
          return
        }

        setItems((prev) => {
          const next = [payload.notification!, ...prev.filter((item) => item.id !== payload.notification!.id)]
          return sortNotifications(next).slice(0, 20)
        })
        setUnreadCount((prev) => prev + 1)
      } catch {
        /* ignore invalid websocket payload */
      }
    }

    return () => {
      socket.close()
    }
  }, [user])

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      loading,
      connected,
      error,
      refresh,
      markRead,
      markAllRead,
    }),
    [items, unreadCount, loading, connected, error, refresh, markRead, markAllRead]
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationsProvider')
  }
  return ctx
}

