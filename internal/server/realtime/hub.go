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
