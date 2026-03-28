package controller

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/FelippeRibeiro/tickets-hub/internal/repository"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/middlewares"
	"github.com/FelippeRibeiro/tickets-hub/pkg/utils"
)

type TicketController struct {
	ticketRepository     *repository.TicketRepository
	topicRepository      *repository.TopicRepository
	attachmentRepository *repository.AttachmentRepository
}

func NewTicketController(
	ticketRepository *repository.TicketRepository,
	topicRepository *repository.TopicRepository,
	attachmentRepository *repository.AttachmentRepository,
) *TicketController {
	return &TicketController{
		ticketRepository:     ticketRepository,
		topicRepository:      topicRepository,
		attachmentRepository: attachmentRepository,
	}
}

func (tc *TicketController) SetupRoutes(server *http.ServeMux) {
	server.Handle("GET /api/tickets/{id}", http.HandlerFunc(tc.GetTicket))
	server.Handle("GET /api/tickets", middlewares.AuthMiddleware(http.HandlerFunc(tc.ListTickets), false))
	server.Handle("POST /api/tickets", middlewares.AuthMiddleware(http.HandlerFunc(tc.CreateTicket), false))
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

	if tc.attachmentRepository != nil {
		rows, aerr := tc.attachmentRepository.ListByTicketID(id)
		if aerr == nil && len(rows) > 0 {
			ticket.Attachments = make([]model.TicketAttachment, 0, len(rows))
			for _, row := range rows {
				ticket.Attachments = append(ticket.Attachments, model.TicketAttachment{
					ID:           row.ID,
					OriginalName: row.OriginalName,
					MimeType:     row.MimeType,
					SizeBytes:    row.SizeBytes,
					URL:          fmt.Sprintf("/api/files/tickets/%d/attachments/%d", id, row.ID),
				})
			}
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(ticket)
}

func (tc *TicketController) ListTickets(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	userID := &user.UserID

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

	tickets, err := tc.ticketRepository.List(topicID,userID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(tickets)
}

func (tc *TicketController) CreateTicket(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
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
