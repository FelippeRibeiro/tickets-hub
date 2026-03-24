package controller

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/FelippeRibeiro/tickets-hub/internal/repository"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/middlewares"
	"github.com/FelippeRibeiro/tickets-hub/pkg/utils"
)

type TicketController struct {
	ticketRepository *repository.TicketRepository
	topicRepository  *repository.TopicRepository
}

func NewTicketController(ticketRepository *repository.TicketRepository, topicRepository *repository.TopicRepository) *TicketController {
	return &TicketController{
		ticketRepository: ticketRepository,
		topicRepository:  topicRepository,
	}
}

func (tc *TicketController) SetupRoutes(server *http.ServeMux) {
	server.Handle("POST /api/tickets", middlewares.AuthMiddleware(http.HandlerFunc(tc.CreateTicket), false))
}

func (tc *TicketController) CreateTicket(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	if user.IsAdmin {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"error": "admins cannot create tickets"})
		return
	}

	var body model.CreateTicket
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if body.Title == "" || body.Description == "" || body.TopicID == 0 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "title, description and topic_id are required"})
		return
	}

	_, err := tc.topicRepository.FindByID(body.TopicID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "topic not found"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	ticket, err := tc.ticketRepository.Create(user.UserID, &body)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(ticket)
}
