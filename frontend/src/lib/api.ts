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
  const isFormData =
    typeof FormData !== 'undefined' && init?.body instanceof FormData
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body && !isFormData
        ? { 'Content-Type': 'application/json' }
        : {}),
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
  has_avatar: boolean
}

/** URL da foto de perfil (bytes na BD); usar só quando `has_avatar` for true. */
export function userAvatarUrl(userId: number) {
  return `/api/users/${userId}/avatar`
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
  is_anonymous: boolean
  status: string
  user_id: number
  topic_id: number
  created_at: string
  user_name: string
  user_has_avatar: boolean
  likes_count: number
  comments_count: number
  liked: boolean
  is_owner: boolean
  topic_name: string
  attachments?: TicketAttachment[]
}


export type Comment = {
  id: number
  comment: string
  created_at: string
  user_id: number
  ticket_id: number
  is_anonymous: boolean
  user_name: string
  user_has_avatar: boolean
  is_owner: boolean
  attachments?: TicketAttachment[]
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

export type Notification = {
  id: number
  user_id: number
  type: 'like' | 'comment'
  ticket_id: number
  actor_id?: number
  actor_name: string
  actor_has_avatar: boolean
  actor_is_anonymous: boolean
  comment_id?: number
  comment_preview?: string
  ticket_title: string
  read_at?: string | null
  created_at: string
}

export type NotificationsResponse = {
  items: Notification[]
  unread_count: number
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

export async function uploadProfileAvatar(file: File) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/me/avatar', {
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
  return parseJson<{ has_avatar: boolean }>(res)
}

export function deleteProfileAvatar() {
  return api<{ has_avatar: boolean }>('/api/me/avatar', {
    method: 'DELETE',
  })
}

export function changeProfileName(name: string) {
  return api<{ message: string }>('/api/me/name', {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
}

export function getUsers() {
  return api<User[]>('/api/users')
}

export function getTickets(topicId?: number, options?: { mine?: boolean }) {
  const params = new URLSearchParams()
  if (topicId !== undefined && topicId > 0) {
    params.set('topic_id', String(topicId))
  }
  if (options?.mine) {
    params.set('mine', 'true')
  }
  const query = params.toString()
  return api<Ticket[]>(`/api/tickets${query ? `?${query}` : ''}`)
}

export function getTicket(id: number) {
  return api<Ticket>(`/api/tickets/${id}`)
}

export function deleteTicket(id: number) {
  return api<{ message: string }>(`/api/tickets/${id}`, {
    method: 'DELETE',
  })
}

export function createTicket(payload: {
  title: string
  description: string
  topic_id: number
  is_anonymous?: boolean
  files?: File[]
}) {
  if (payload.files && payload.files.length > 0) {
    const form = new FormData()
    form.append('title', payload.title)
    form.append('description', payload.description)
    form.append('topic_id', String(payload.topic_id))
    form.append('is_anonymous', String(Boolean(payload.is_anonymous)))
    for (const f of payload.files) {
      form.append('files', f)
    }
    return api<Ticket>('/api/tickets', { method: 'POST', body: form })
  }
  return api<Ticket>('/api/tickets', {
    method: 'POST',
    body: JSON.stringify({
      title: payload.title,
      description: payload.description,
      topic_id: payload.topic_id,
      is_anonymous: Boolean(payload.is_anonymous),
    }),
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

export function createTicketComment(
  ticketId: number,
  comment: string,
  files?: File[],
  isAnonymous?: boolean
) {
  if (files && files.length > 0) {
    const form = new FormData()
    form.append('comment', comment)
    form.append('is_anonymous', String(Boolean(isAnonymous)))
    for (const f of files) {
      form.append('files', f)
    }
    return api<Comment>(`/api/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: form,
    })
  }
  return api<Comment>(`/api/tickets/${ticketId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ comment, is_anonymous: Boolean(isAnonymous) }),
  })
}

export function deleteComment(commentId: number) {
  return api<{ message: string }>(`/api/comments/${commentId}`, {
    method: 'DELETE',
  })
}

export function getTicketLikes(ticketId: number) {
  return api<LikeSummary>(`/api/tickets/${ticketId}/likes`)
}

export function getNotifications(params?: { limit?: number; offset?: number }) {
  const limit = params?.limit ?? 20
  const offset = params?.offset ?? 0
  return api<NotificationsResponse>(`/api/notifications?limit=${limit}&offset=${offset}`)
}

export function markNotificationRead(notificationId: number) {
  return api<{ message: string }>(`/api/notifications/${notificationId}/read`, {
    method: 'POST',
  })
}

export function markAllNotificationsRead() {
  return api<{ message: string }>('/api/notifications/read-all', {
    method: 'POST',
  })
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
