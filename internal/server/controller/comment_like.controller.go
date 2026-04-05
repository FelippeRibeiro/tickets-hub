package controller

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/FelippeRibeiro/tickets-hub/internal/repository"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/middlewares"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/realtime"
	"github.com/FelippeRibeiro/tickets-hub/pkg/utils"
)

type CommentLikeController struct {
	commentLikeRepository  *repository.CommentLikeRepository
	commentRepository      *repository.CommentRepository
	notificationRepository *repository.NotificationRepository
	hub                    *realtime.Hub
}

func NewCommentLikeController(
	commentLikeRepository *repository.CommentLikeRepository,
	commentRepository *repository.CommentRepository,
	notificationRepository *repository.NotificationRepository,
	hub *realtime.Hub,
) *CommentLikeController {
	return &CommentLikeController{
		commentLikeRepository:  commentLikeRepository,
		commentRepository:      commentRepository,
		notificationRepository: notificationRepository,
		hub:                    hub,
	}
}

func (lc *CommentLikeController) SetupRoutes(server *http.ServeMux) {
	server.Handle("GET /api/comments/{comment_id}/likes", middlewares.AuthMiddleware(http.HandlerFunc(lc.GetSummary), false))
	server.Handle("POST /api/comments/{comment_id}/likes", middlewares.AuthMiddleware(http.HandlerFunc(lc.Like), false))
	server.Handle("DELETE /api/comments/{comment_id}/likes", middlewares.AuthMiddleware(http.HandlerFunc(lc.Unlike), false))
}

func (lc *CommentLikeController) commentID(w http.ResponseWriter, r *http.Request) (int, bool) {
	id, err := strconv.Atoi(r.PathValue("comment_id"))
	if err != nil || id <= 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid comment id"})
		return 0, false
	}
	_, err = lc.commentRepository.FindByID(id)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		if errors.Is(err, sql.ErrNoRows) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "comment not found"})
			return 0, false
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return 0, false
	}
	return id, true
}

func (lc *CommentLikeController) GetSummary(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	commentID, ok := lc.commentID(w, r)
	if !ok {
		return
	}
	summary, err := lc.commentLikeRepository.Summary(user.UserID, commentID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(summary)
}

func (lc *CommentLikeController) Like(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	commentID, ok := lc.commentID(w, r)
	if !ok {
		return
	}
	inserted, err := lc.commentLikeRepository.Create(user.UserID, commentID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	if inserted && lc.notificationRepository != nil && lc.hub != nil {
		comment, err := lc.commentRepository.FindByID(commentID)
		if err == nil && comment.UserId > 0 && comment.UserId != user.UserID {
			actorID := user.UserID
			cid := commentID
			n, nerr := lc.notificationRepository.Create(
				comment.UserId,
				"comment_like",
				comment.TicketId,
				&actorID,
				false,
				&cid,
			)
			if nerr == nil && n != nil {
				lc.hub.BroadcastNotification(comment.UserId, *n)
			}
		}
	}
	summary, err := lc.commentLikeRepository.Summary(user.UserID, commentID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(summary)
}

func (lc *CommentLikeController) Unlike(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	commentID, ok := lc.commentID(w, r)
	if !ok {
		return
	}
	if err := lc.commentLikeRepository.Delete(user.UserID, commentID); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	summary, err := lc.commentLikeRepository.Summary(user.UserID, commentID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(summary)
}
