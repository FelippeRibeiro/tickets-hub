package controller

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/FelippeRibeiro/tickets-hub/internal/repository"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/middlewares"
	"github.com/FelippeRibeiro/tickets-hub/pkg/utils"
)

type LikeController struct {
	likeRepository   *repository.LikeRepository
	ticketRepository *repository.TicketRepository
}

func NewLikeController(likeRepository *repository.LikeRepository, ticketRepository *repository.TicketRepository) *LikeController {
	return &LikeController{
		likeRepository:   likeRepository,
		ticketRepository: ticketRepository,
	}
}

func (lc *LikeController) SetupRoutes(server *http.ServeMux) {
	server.Handle("GET /api/tickets/{id}/likes", http.HandlerFunc(lc.GetSummary))
	server.Handle("POST /api/tickets/{id}/likes", middlewares.AuthMiddleware(http.HandlerFunc(lc.Like), false))
	server.Handle("DELETE /api/tickets/{id}/likes", middlewares.AuthMiddleware(http.HandlerFunc(lc.Unlike), false))
}

func (lc *LikeController) getTicketID(w http.ResponseWriter, r *http.Request) (int, bool) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || id <= 0 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid ticket id"})
		return 0, false
	}
	_, err = lc.ticketRepository.FindByID(id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{"error": "ticket not found"})
			return 0, false
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return 0, false
	}
	return id, true
}

func (lc *LikeController) GetSummary(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	ticketID, ok := lc.getTicketID(w, r)
	if !ok {
		return
	}
	userID := -1
	if c, err := r.Cookie("token"); err == nil {
		if claims, err := utils.ValidateJWTToken(c.Value); err == nil {
			userID = claims.UserID
		}
	}
	summary, err := lc.likeRepository.Summary(userID, ticketID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(summary)
}

func (lc *LikeController) Like(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	ticketID, ok := lc.getTicketID(w, r)
	if !ok {
		return
	}
	if err := lc.likeRepository.Create(user.UserID, ticketID); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	summary, err := lc.likeRepository.Summary(user.UserID, ticketID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(summary)
}

func (lc *LikeController) Unlike(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	ticketID, ok := lc.getTicketID(w, r)
	if !ok {
		return
	}
	if err := lc.likeRepository.Delete(user.UserID, ticketID); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
