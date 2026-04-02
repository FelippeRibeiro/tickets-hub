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
  soundEnabled: boolean
  toastEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
  setToastEnabled: (enabled: boolean) => void
  transientItems: Notification[]
  dismissTransient: (notificationId: number) => void
  refresh: () => Promise<void>
  markRead: (notificationId: number) => Promise<void>
  markAllRead: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsState | null>(null)
const SOUND_PREF_KEY = 'tickets-hub.notifications.sound'
const TOAST_PREF_KEY = 'tickets-hub.notifications.toast'
const WS_PING_INTERVAL_MS = 25000
const WS_RECONNECT_BASE_MS = 1000
const WS_RECONNECT_MAX_MS = 10000
const WS_MAX_RECONNECT_ATTEMPTS = 10

function readStoredPreference(key: string, fallback = true) {
  if (typeof window === 'undefined') {
    return fallback
  }
  const value = window.localStorage.getItem(key)
  if (value === null) {
    return fallback
  }
  return value === 'true'
}

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
  const [soundEnabled, setSoundEnabled] = useState(() => readStoredPreference(SOUND_PREF_KEY, true))
  const [toastEnabled, setToastEnabled] = useState(() => readStoredPreference(TOAST_PREF_KEY, true))
  const [transientItems, setTransientItems] = useState<Notification[]>([])
  const socketRef = useRef<WebSocket | null>(null)
  const timeoutsRef = useRef<Record<number, number>>({})
  const reconnectTimeoutRef = useRef<number | null>(null)
  const pingIntervalRef = useRef<number | null>(null)
  const reconnectAttemptsRef = useRef(0)

  const dismissTransient = useCallback((notificationId: number) => {
    setTransientItems((prev) => prev.filter((item) => item.id !== notificationId))
    const timeoutId = timeoutsRef.current[notificationId]
    if (timeoutId) {
      window.clearTimeout(timeoutId)
      delete timeoutsRef.current[notificationId]
    }
  }, [])

  const playNotificationSound = useCallback(() => {
    if (typeof window === 'undefined' || !soundEnabled) {
      return
    }
    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextCtor) {
        return
      }
      const context = new AudioContextCtor()
      const oscillator = context.createOscillator()
      const gainNode = context.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, context.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.12)
      gainNode.gain.setValueAtTime(0.001, context.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.28)

      oscillator.connect(gainNode)
      gainNode.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.28)

      void context.close().catch(() => undefined)
    } catch {
      /* audio may be blocked by browser autoplay policies */
    }
  }, [soundEnabled])

  const showTransient = useCallback((notification: Notification) => {
    setTransientItems((prev) => [notification, ...prev.filter((item) => item.id !== notification.id)].slice(0, 3))
    const previousTimeout = timeoutsRef.current[notification.id]
    if (previousTimeout) {
      window.clearTimeout(previousTimeout)
    }
    timeoutsRef.current[notification.id] = window.setTimeout(() => {
      setTransientItems((prev) => prev.filter((item) => item.id !== notification.id))
      delete timeoutsRef.current[notification.id]
    }, 5000)
  }, [])

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

  const clearSocketTimers = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (pingIntervalRef.current !== null) {
      window.clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
  }, [])

  const closeSocket = useCallback(() => {
    clearSocketTimers()
    const socket = socketRef.current
    socketRef.current = null
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close()
      return
    }
    if (socket && socket.readyState === WebSocket.CONNECTING) {
      socket.close()
    }
  }, [clearSocketTimers])

  const scheduleReconnect = useCallback(() => {
    if (
      !user ||
      reconnectTimeoutRef.current !== null ||
      reconnectAttemptsRef.current >= WS_MAX_RECONNECT_ATTEMPTS
    ) {
      return
    }
    const delay = Math.min(
      WS_RECONNECT_BASE_MS * 2 ** reconnectAttemptsRef.current,
      WS_RECONNECT_MAX_MS
    )
    reconnectTimeoutRef.current = window.setTimeout(() => {
      reconnectTimeoutRef.current = null
      reconnectAttemptsRef.current += 1
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const socket = new WebSocket(`${protocol}//${window.location.host}/api/notifications/ws`)
      socketRef.current = socket

      socket.onopen = () => {
        reconnectAttemptsRef.current = 0
        setConnected(true)
        if (pingIntervalRef.current !== null) {
          window.clearInterval(pingIntervalRef.current)
        }
        pingIntervalRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            try {
              socket.send('ping')
            } catch {
              /* ignore ping errors; reconnect will handle close */
            }
          }
        }, WS_PING_INTERVAL_MS)
      }

      socket.onclose = () => {
        setConnected(false)
        if (socketRef.current === socket) {
          socketRef.current = null
        }
        if (pingIntervalRef.current !== null) {
          window.clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }
        scheduleReconnect()
      }

      socket.onerror = () => {
        setConnected(false)
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close()
        }
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
          playNotificationSound()
          if (toastEnabled) {
            showTransient(payload.notification)
          }
        } catch {
          /* ignore invalid websocket payload */
        }
      }
    }, delay)
  }, [playNotificationSound, showTransient, toastEnabled, user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(SOUND_PREF_KEY, String(soundEnabled))
  }, [soundEnabled])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(TOAST_PREF_KEY, String(toastEnabled))
  }, [toastEnabled])

  useEffect(() => {
    if (!user) {
      closeSocket()
      setConnected(false)
      reconnectAttemptsRef.current = 0
      return
    }

    scheduleReconnect()

    const reconnectIfNeeded = () => {
      if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
        scheduleReconnect()
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reconnectIfNeeded()
        void refresh()
      }
    }

    const onOnline = () => {
      reconnectAttemptsRef.current = 0
      reconnectIfNeeded()
      void refresh()
    }

    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      closeSocket()
    }
  }, [closeSocket, refresh, scheduleReconnect, user])

  useEffect(() => {
    return () => {
      closeSocket()
      Object.values(timeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId))
      timeoutsRef.current = {}
    }
  }, [closeSocket])

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      loading,
      connected,
      error,
      soundEnabled,
      toastEnabled,
      setSoundEnabled: (enabled: boolean) => setSoundEnabled(enabled),
      setToastEnabled: (enabled: boolean) => setToastEnabled(enabled),
      transientItems,
      dismissTransient,
      refresh,
      markRead,
      markAllRead,
    }),
    [
      items,
      unreadCount,
      loading,
      connected,
      error,
      soundEnabled,
      toastEnabled,
      transientItems,
      dismissTransient,
      refresh,
      markRead,
      markAllRead,
    ]
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

