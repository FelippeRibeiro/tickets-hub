package controller

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/FelippeRibeiro/tickets-hub/internal/repository"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/middlewares"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/realtime"
	"github.com/FelippeRibeiro/tickets-hub/pkg/utils"
	"github.com/gorilla/websocket"
)

type NotificationController struct {
	notificationRepository *repository.NotificationRepository
	hub                    *realtime.Hub
	upgrader               websocket.Upgrader
}

func NewNotificationController(notificationRepository *repository.NotificationRepository, hub *realtime.Hub) *NotificationController {
	return &NotificationController{
		notificationRepository: notificationRepository,
		hub:                    hub,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
}

func (nc *NotificationController) SetupRoutes(server *http.ServeMux) {
	server.Handle("GET /api/notifications", middlewares.AuthMiddleware(http.HandlerFunc(nc.ListNotifications), false))
	server.Handle("POST /api/notifications/read-all", middlewares.AuthMiddleware(http.HandlerFunc(nc.MarkAllRead), false))
	server.Handle("POST /api/notifications/{id}/read", middlewares.AuthMiddleware(http.HandlerFunc(nc.MarkRead), false))
	server.Handle("GET /api/notifications/ws", http.HandlerFunc(nc.WebSocket))
}

func (nc *NotificationController) ListNotifications(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	limit := 20
	offset := 0
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	if raw := r.URL.Query().Get("offset"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	items, err := nc.notificationRepository.ListByUser(user.UserID, limit, offset)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	unreadCount, err := nc.notificationRepository.UnreadCount(user.UserID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{
		"items":        items,
		"unread_count": unreadCount,
	})
}

func (nc *NotificationController) MarkRead(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || id <= 0 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid notification id"})
		return
	}

	if err := nc.notificationRepository.MarkRead(id, user.UserID); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "notification marked as read"})
}

func (nc *NotificationController) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	if err := nc.notificationRepository.MarkAllRead(user.UserID); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "all notifications marked as read"})
}

func (nc *NotificationController) WebSocket(w http.ResponseWriter, r *http.Request) {
	token, err := r.Cookie("token")
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	claims, err := utils.ValidateJWTToken(token.Value)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	conn, err := nc.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	nc.hub.Register(claims.UserID, conn)
	defer func() {
		nc.hub.Unregister(claims.UserID, conn)
		_ = conn.Close()
	}()

	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			return
		}
	}
}
