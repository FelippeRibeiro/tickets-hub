package controller

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

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
	server.Handle("GET /api/tickets/{id}", middlewares.AuthMiddleware(http.HandlerFunc(tc.GetTicket), false))
	server.Handle("GET /api/tickets", middlewares.AuthMiddleware(http.HandlerFunc(tc.ListTickets), false))
	server.Handle("POST /api/tickets", middlewares.AuthMiddleware(http.HandlerFunc(tc.CreateTicket), false))
}

type ticketWithTopic struct {
	model.Ticket
	TopicName string `json:"topic_name"`
}

func (tc *TicketController) GetTicket(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid ticket id"})
		return
	}

	ticket, err := tc.ticketRepository.FindByID(id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{"error": "ticket not found"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	topic, err := tc.topicRepository.FindByID(ticket.TopicID)
	topicName := ""
	if err == nil && topic != nil {
		topicName = topic.Name
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(ticketWithTopic{Ticket: *ticket, TopicName: topicName})
}

func (tc *TicketController) ListTickets(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var topicID *int
	if raw := r.URL.Query().Get("topic_id"); raw != "" {
		id, err := strconv.Atoi(raw)
		if err != nil || id <= 0 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid topic_id query parameter"})
			return
		}
		_, err = tc.topicRepository.FindByID(id)
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
		topicID = &id
	}

	tickets, err := tc.ticketRepository.List(topicID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	topics, err := tc.topicRepository.FindAll()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	topicNames := make(map[int]string, len(topics))
	for _, tp := range topics {
		topicNames[tp.ID] = tp.Name
	}
	out := make([]ticketWithTopic, 0, len(tickets))
	for _, tk := range tickets {
		out = append(out, ticketWithTopic{Ticket: tk, TopicName: topicNames[tk.TopicID]})
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(out)
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
