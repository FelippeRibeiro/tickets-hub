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
  tickets_count?: number
}

export type TicketAttachment = {
  id: number
  original_name: string
  mime_type: string
  size_bytes: number
  url: string
}

export type Ticket = {
  id: number
  title: string
  description: string
  status: string
  user_id: number
  topic_id: number
  created_at: string
  user_name: string
  likes_count: number
  comments_count: number
  liked: boolean
  topic_name: string
  attachments?: TicketAttachment[]
}


export type Comment = {
  id: number
  comment: string
  created_at: string
  user_id: number
  ticket_id: number
  user_name: string
}
export type PaginatedComments = {
  items: Comment[]
  limit: number
  offset: number
  next_offset: number
  has_more: boolean
}
export type LikeSummary = {
  count: number
  liked: boolean
}

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

export type DeleteTopicConflict = {
  error: string
  tickets_count: number
  requires_force: boolean
}

export async function deleteTopic(id: number, force = false) {
  const q = force ? '?force=true' : ''
  return api<{ message: string; id: number }>(`/api/topics/${id}${q}`, {
    method: 'DELETE',
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
  message: string
  token: string
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
  return api<Ticket[]>(`/api/tickets${q}`)
}

export function getTicket(id: number) {
  return api<Ticket>(`/api/tickets/${id}`)
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

export async function uploadTicketAttachment(ticketId: number, file: File) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/api/tickets/${ticketId}/attachments`, {
    method: 'POST',
    body: form,
    credentials: 'include',
  })
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = (await res.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status)
  }
  return parseJson<TicketAttachment>(res)
}

export function getTicketComments(
  ticketId: number,
  params?: { limit?: number; offset?: number }
) {
  const limit = params?.limit ?? 10
  const offset = params?.offset ?? 0
  return api<PaginatedComments>(
    `/api/tickets/${ticketId}/comments?limit=${limit}&offset=${offset}`
  )
}

export function createTicketComment(ticketId: number, comment: string) {
  return api<Comment>(`/api/tickets/${ticketId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  })
}

export function getTicketLikes(ticketId: number) {
  return api<LikeSummary>(`/api/tickets/${ticketId}/likes`)
}

export function likeTicket(ticketId: number) {
  return api<LikeSummary>(`/api/tickets/${ticketId}/likes`, {
    method: 'POST',
  })
}

export function unlikeTicket(ticketId: number) {
  return api<void>(`/api/tickets/${ticketId}/likes`, {
    method: 'DELETE',
  })
}
