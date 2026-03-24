export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T
  }
  const text = await res.text()
  if (!text) {
    return undefined as T
  }
  return JSON.parse(text) as T
}

export async function api<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = (await parseJson<{ error?: string }>(res)) as {
        error?: string
      }
      if (body?.error) {
        message = body.error
      }
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status)
  }

  return parseJson<T>(res)
}

export type User = {
  id: number
  name: string
  email: string
  is_admin: boolean
}

export type Topic = {
  id: number
  name: string
}

export type Ticket = {
  id: number
  title: string
  description: string
  status: string
  user_id: number
  topic_id: number
  created_at: string
}

export type TicketWithTopic = Ticket & { topic_name: string }

export function getHealth() {
  return api<{ ok: boolean }>('/health')
}

export function getTopics() {
  return api<Topic[]>('/api/topics')
}

export function createTopic(name: string) {
  return api<Topic>('/api/topics', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function registerUser(payload: {
  name: string
  email: string
  password: string
}) {
  return api<CreateUserResponse>('/api/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

type CreateUserResponse = {
  name?: string
  email?: string
  password?: string
}

export function login(payload: { email: string; password: string }) {
  return api<{ token: string }>('/api/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function logout() {
  return api<void>('/api/logout', { method: 'POST' })
}

export function getMe() {
  return api<User>('/api/me')
}

export function getUsers() {
  return api<User[]>('/api/users')
}

export function getTickets(topicId?: number) {
  const q =
    topicId !== undefined && topicId > 0 ? `?topic_id=${topicId}` : ''
  return api<TicketWithTopic[]>(`/api/tickets${q}`)
}

export function getTicket(id: number) {
  return api<TicketWithTopic>(`/api/tickets/${id}`)
}

export function createTicket(payload: {
  title: string
  description: string
  topic_id: number
}) {
  return api<Ticket>('/api/tickets', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
