package controller

import (
	"context"
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
	"github.com/FelippeRibeiro/tickets-hub/internal/notify/discord"
	"github.com/FelippeRibeiro/tickets-hub/internal/repository"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/middlewares"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/realtime"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/upload"
	"github.com/FelippeRibeiro/tickets-hub/pkg/utils"
)

type TicketController struct {
	ticketRepository     *repository.TicketRepository
	topicRepository      *repository.TopicRepository
	attachmentRepository *repository.AttachmentRepository
	uploadRoot           string
	hub                  *realtime.Hub
}

func NewTicketController(
	ticketRepository *repository.TicketRepository,
	topicRepository *repository.TopicRepository,
	attachmentRepository *repository.AttachmentRepository,
	uploadRoot string,
	hub *realtime.Hub,
) *TicketController {
	return &TicketController{
		ticketRepository:     ticketRepository,
		topicRepository:      topicRepository,
		attachmentRepository: attachmentRepository,
		uploadRoot:           uploadRoot,
		hub:                  hub,
	}
}

func (tc *TicketController) SetupRoutes(server *http.ServeMux) {
	server.Handle("GET /api/tickets/{id}", middlewares.AuthMiddleware(http.HandlerFunc(tc.GetTicket), false))
	server.Handle("GET /api/tickets", middlewares.AuthMiddleware(http.HandlerFunc(tc.ListTickets), false))
	server.Handle("POST /api/tickets", middlewares.AuthMiddleware(http.HandlerFunc(tc.CreateTicket), false))
	server.Handle("DELETE /api/tickets/{id}", middlewares.AuthMiddleware(http.HandlerFunc(tc.DeleteTicket), false))
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

func (tc *TicketController) broadcastNewTicket(full *model.TicketWithUserName, authorUserID int) {
	if tc.hub == nil || full == nil {
		return
	}
	displayName := full.UserName
	authorForAvatar := full.UserID
	if full.IsAnonymous {
		displayName = "Usuário anônimo"
		authorForAvatar = 0
	}
	tc.hub.BroadcastNewTicketExcept(authorUserID, realtime.TicketCreatedPayload{
		ID:           full.ID,
		Title:        full.Title,
		TopicName:    full.TopicName,
		AuthorName:   displayName,
		AuthorUserID: authorForAvatar,
		IsAnonymous:  full.IsAnonymous,
	})
}

func (tc *TicketController) notifyDiscordNewTicket(full *model.TicketWithUserName) {
	webhook := strings.TrimSpace(os.Getenv("DISCORD_WEBHOOK_URL"))
	base := strings.TrimSpace(os.Getenv("PUBLIC_BASE_URL"))
	if webhook == "" || base == "" || full == nil {
		return
	}
	t := full
	go func() {
		publishedBy := strings.TrimSpace(t.UserName)
		if publishedBy == "" {
			publishedBy = "Desconhecido"
		}
		if t.IsAnonymous {
			publishedBy = "Anônimo"
		}
		_ = discord.NotifyNewTicket(context.Background(), webhook, base, t.ID, t.Title, t.TopicName, t.Description, t.IsAnonymous, publishedBy)
	}()
}

func (tc *TicketController) GetTicket(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

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
	if user != nil {
		ticket.IsOwner = ticket.UserID == user.UserID || user.IsAdmin
	}
	if ticket.IsAnonymous {
		ticket.UserName = "Usuário anônimo"
		ticket.UserHasAvatar = false
		ticket.UserID = 0
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
	onlyMine := strings.EqualFold(r.URL.Query().Get("mine"), "true")
	searchQ := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(searchQ) > 200 {
		searchQ = searchQ[:200]
	}
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

	tickets, err := tc.ticketRepository.List(topicID, userID, onlyMine, searchQ)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	tc.enrichListAttachments(tickets)

	for i := range tickets {
		tickets[i].IsOwner = tickets[i].UserID == user.UserID || user.IsAdmin
		if tickets[i].IsAnonymous {
			tickets[i].UserName = "Usuário anônimo"
			tickets[i].UserHasAvatar = false
			tickets[i].UserID = 0
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(tickets)
}

func (tc *TicketController) enrichListAttachments(tickets []model.TicketWithUserName) {
	if tc.attachmentRepository == nil || len(tickets) == 0 {
		return
	}
	ids := make([]int, len(tickets))
	for i := range tickets {
		ids[i] = tickets[i].ID
	}
	rows, err := tc.attachmentRepository.ListByTicketIDs(ids)
	if err != nil || len(rows) == 0 {
		return
	}
	byTicket := make(map[int][]model.TicketAttachment)
	for _, row := range rows {
		att := model.TicketAttachment{
			ID:           row.ID,
			OriginalName: row.OriginalName,
			MimeType:     row.MimeType,
			SizeBytes:    row.SizeBytes,
			URL:          fmt.Sprintf("/api/files/tickets/%d/attachments/%d", row.TicketID, row.ID),
		}
		byTicket[row.TicketID] = append(byTicket[row.TicketID], att)
	}
	for i := range tickets {
		if atts, ok := byTicket[tickets[i].ID]; ok {
			tickets[i].Attachments = atts
		}
	}
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

	tc.broadcastNewTicket(full, user.UserID)
	tc.notifyDiscordNewTicket(full)

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
	isAnonymous := strings.EqualFold(strings.TrimSpace(r.FormValue("is_anonymous")), "true")
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

	body := model.CreateTicket{Title: title, Description: description, TopicID: topicID, IsAnonymous: isAnonymous}
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

	tc.broadcastNewTicket(full, user.UserID)
	tc.notifyDiscordNewTicket(full)

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(full)
}

func (tc *TicketController) DeleteTicket(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	ticketID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || ticketID <= 0 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid ticket id"})
		return
	}

	ticket, err := tc.ticketRepository.FindByID(ticketID)
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

	if ticket.UserID != user.UserID && !user.IsAdmin {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"error": "only the ticket author or an admin can delete"})
		return
	}

	err = tc.ticketRepository.DeleteTicket(ticketID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "ticket deleted successfully"})
}
