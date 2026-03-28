package controller

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/FelippeRibeiro/tickets-hub/internal/repository"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/middlewares"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/upload"
	"github.com/FelippeRibeiro/tickets-hub/pkg/utils"
)

type TicketController struct {
	ticketRepository     *repository.TicketRepository
	topicRepository      *repository.TopicRepository
	attachmentRepository *repository.AttachmentRepository
	uploadRoot           string
}

func NewTicketController(
	ticketRepository *repository.TicketRepository,
	topicRepository *repository.TopicRepository,
	attachmentRepository *repository.AttachmentRepository,
	uploadRoot string,
) *TicketController {
	return &TicketController{
		ticketRepository:     ticketRepository,
		topicRepository:      topicRepository,
		attachmentRepository: attachmentRepository,
		uploadRoot:           uploadRoot,
	}
}

func (tc *TicketController) SetupRoutes(server *http.ServeMux) {
	server.Handle("GET /api/tickets/{id}", http.HandlerFunc(tc.GetTicket))
	server.Handle("GET /api/tickets", middlewares.AuthMiddleware(http.HandlerFunc(tc.ListTickets), false))
	server.Handle("POST /api/tickets", middlewares.AuthMiddleware(http.HandlerFunc(tc.CreateTicket), false))
}

func (tc *TicketController) ticketAttachments(ticketID int) []model.TicketAttachment {
	if tc.attachmentRepository == nil {
		return nil
	}
	rows, err := tc.attachmentRepository.ListByTicketID(ticketID)
	if err != nil || len(rows) == 0 {
		return nil
	}
	out := make([]model.TicketAttachment, 0, len(rows))
	for _, row := range rows {
		out = append(out, model.TicketAttachment{
			ID:           row.ID,
			OriginalName: row.OriginalName,
			MimeType:     row.MimeType,
			SizeBytes:    row.SizeBytes,
			URL:          fmt.Sprintf("/api/files/tickets/%d/attachments/%d", ticketID, row.ID),
		})
	}
	return out
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

	if atts := tc.ticketAttachments(id); len(atts) > 0 {
		ticket.Attachments = atts
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

	tickets, err := tc.ticketRepository.List(topicID, userID)
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

	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		tc.createTicketMultipart(w, r, user)
		return
	}

	var body model.CreateTicket
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}

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

	full, err := tc.ticketRepository.FindByID(ticket.ID)
	if err != nil {
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(ticket)
		return
	}
	if atts := tc.ticketAttachments(ticket.ID); len(atts) > 0 {
		full.Attachments = atts
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(full)
}

func (tc *TicketController) createTicketMultipart(w http.ResponseWriter, r *http.Request, user *utils.Claims) {
	w.Header().Set("Content-Type", "application/json")

	r.Body = http.MaxBytesReader(w, r.Body, upload.MaxMediaBytes+1)
	if err := r.ParseMultipartForm(64 << 20); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			w.WriteHeader(http.StatusRequestEntityTooLarge)
			json.NewEncoder(w).Encode(map[string]string{"error": "payload too large (max 1GB)"})
			return
		}
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid multipart form"})
		return
	}

	title := strings.TrimSpace(r.FormValue("title"))
	description := strings.TrimSpace(r.FormValue("description"))
	topicID, err := strconv.Atoi(strings.TrimSpace(r.FormValue("topic_id")))
	if err != nil || topicID <= 0 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "title, description and topic_id are required"})
		return
	}

	if title == "" || description == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "title, description and topic_id are required"})
		return
	}

	_, err = tc.topicRepository.FindByID(topicID)
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

	body := model.CreateTicket{Title: title, Description: description, TopicID: topicID}
	ticket, err := tc.ticketRepository.Create(user.UserID, &body)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	if tc.attachmentRepository != nil && r.MultipartForm != nil {
		for _, fh := range r.MultipartForm.File["files"] {
			file, err := fh.Open()
			if err != nil {
				continue
			}
			relPath, mime, written, err := upload.SaveMedia(tc.uploadRoot, "tickets", ticket.ID, file, fh)
			_ = file.Close()
			if err != nil {
				continue
			}
			_, err = tc.attachmentRepository.Insert(ticket.ID, fh.Filename, relPath, mime, written)
			if err != nil {
				_ = os.Remove(filepath.Join(tc.uploadRoot, filepath.FromSlash(relPath)))
			}
		}
	}

	full, err := tc.ticketRepository.FindByID(ticket.ID)
	if err != nil {
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(ticket)
		return
	}
	if atts := tc.ticketAttachments(ticket.ID); len(atts) > 0 {
		full.Attachments = atts
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(full)
}
