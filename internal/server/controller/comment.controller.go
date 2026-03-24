package controller

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/FelippeRibeiro/tickets-hub/internal/repository"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/middlewares"
	"github.com/FelippeRibeiro/tickets-hub/pkg/utils"
	"github.com/jackc/pgx"
)

type CommentController struct {
	commentRepository *repository.CommentRepository
	ticketRepository  *repository.TicketRepository
}

func NewCommentController(commentRepository *repository.CommentRepository, ticketRepository *repository.TicketRepository) *CommentController {
	return &CommentController{
		commentRepository: commentRepository,
		ticketRepository:  ticketRepository,
	}
}
func (cc *CommentController) SetupRoutes(server *http.ServeMux) {
	server.Handle("POST /api/comments", middlewares.AuthMiddleware(http.HandlerFunc(cc.CreateComment), false))
}
func (cc *CommentController) CreateComment(w http.ResponseWriter, r *http.Request) {
	user, ok := (r.Context().Value("user")).(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	var comment model.CreateComment
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewDecoder(r.Body).Decode(&comment); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	if comment.Comment == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "comment is required"})
		return
	}

	_, err := cc.ticketRepository.FindByID(comment.TicketId)
	if err != nil {
		if errors.As(err, &pgx.ErrNoRows) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{"error": "ticket not found"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	err = cc.commentRepository.Create(user.UserID, &comment)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "comment created",
	})

}
