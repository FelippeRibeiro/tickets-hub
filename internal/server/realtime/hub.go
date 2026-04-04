package realtime

import (
	"encoding/json"
	"sync"

	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/gorilla/websocket"
)

type notificationEvent struct {
	Type         string             `json:"type"`
	Notification model.Notification `json:"notification"`
}

// TicketCreatedPayload is sent when a new ticket is published (WebSocket event).
type TicketCreatedPayload struct {
	ID           int    `json:"id"`
	Title        string `json:"title"`
	TopicName    string `json:"topic_name"`
	AuthorName   string `json:"author_name"`
	AuthorUserID int    `json:"author_user_id"`
	IsAnonymous  bool   `json:"is_anonymous"`
}

type ticketCreatedEvent struct {
	Type   string               `json:"type"`
	Ticket TicketCreatedPayload `json:"ticket"`
}

type Hub struct {
	mu      sync.RWMutex
	clients map[int]map[*websocket.Conn]struct{}
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[int]map[*websocket.Conn]struct{}),
	}
}

func (h *Hub) Register(userID int, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.clients[userID] == nil {
		h.clients[userID] = make(map[*websocket.Conn]struct{})
	}
	h.clients[userID][conn] = struct{}{}
}

func (h *Hub) Unregister(userID int, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	userClients := h.clients[userID]
	if userClients == nil {
		return
	}

	delete(userClients, conn)
	if len(userClients) == 0 {
		delete(h.clients, userID)
	}
}

func (h *Hub) BroadcastNotification(userID int, notification model.Notification) {
	payload, err := json.Marshal(notificationEvent{
		Type:         "notification.created",
		Notification: notification,
	})
	if err != nil {
		return
	}

	h.mu.RLock()
	connections := make([]*websocket.Conn, 0, len(h.clients[userID]))
	for conn := range h.clients[userID] {
		connections = append(connections, conn)
	}
	h.mu.RUnlock()

	for _, conn := range connections {
		if err := conn.WriteMessage(websocket.TextMessage, payload); err != nil {
			_ = conn.Close()
			h.Unregister(userID, conn)
		}
	}
}

// BroadcastNewTicketExcept notifies all connected users except the author.
func (h *Hub) BroadcastNewTicketExcept(excludeUserID int, ticket TicketCreatedPayload) {
	payload, err := json.Marshal(ticketCreatedEvent{
		Type:   "ticket.created",
		Ticket: ticket,
	})
	if err != nil {
		return
	}

	h.mu.RLock()
	type connPair struct {
		userID int
		conn   *websocket.Conn
	}
	var pairs []connPair
	for userID, conns := range h.clients {
		if userID == excludeUserID {
			continue
		}
		for conn := range conns {
			pairs = append(pairs, connPair{userID: userID, conn: conn})
		}
	}
	h.mu.RUnlock()

	for _, p := range pairs {
		if err := p.conn.WriteMessage(websocket.TextMessage, payload); err != nil {
			_ = p.conn.Close()
			h.Unregister(p.userID, p.conn)
		}
	}
}
