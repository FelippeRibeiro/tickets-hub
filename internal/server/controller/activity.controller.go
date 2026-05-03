package controller

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/FelippeRibeiro/tickets-hub/internal/repository"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/middlewares"
	"github.com/FelippeRibeiro/tickets-hub/pkg/utils"
)

type ActivityController struct {
	ticketRepository            *repository.TicketRepository
	topicRepository             *repository.TopicRepository
	commentRepository           *repository.CommentRepository
	commentAttachmentRepository *repository.CommentAttachmentRepository
	likeRepository              *repository.LikeRepository
	attachmentRepository        *repository.AttachmentRepository
}

func NewActivityController(
	ticketRepository *repository.TicketRepository,
	topicRepository *repository.TopicRepository,
	commentRepository *repository.CommentRepository,
	commentAttachmentRepository *repository.CommentAttachmentRepository,
	likeRepository *repository.LikeRepository,
	attachmentRepository *repository.AttachmentRepository,
) *ActivityController {
	return &ActivityController{
		ticketRepository:            ticketRepository,
		topicRepository:             topicRepository,
		commentRepository:           commentRepository,
		commentAttachmentRepository: commentAttachmentRepository,
		likeRepository:              likeRepository,
		attachmentRepository:        attachmentRepository,
	}
}

func (ac *ActivityController) SetupRoutes(server *http.ServeMux) {
	server.Handle("GET /api/me/tickets", middlewares.AuthMiddleware(http.HandlerFunc(ac.ListMyTickets), false))
	server.Handle("GET /api/me/comments", middlewares.AuthMiddleware(http.HandlerFunc(ac.ListMyComments), false))
	server.Handle("GET /api/me/likes", middlewares.AuthMiddleware(http.HandlerFunc(ac.ListMyLikes), false))
}

func (ac *ActivityController) ListMyTickets(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	userID := &user.UserID

	var topicID *int
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
		_, err = ac.topicRepository.FindByID(id)
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

	tickets, err := ac.ticketRepository.List(topicID, userID, true, searchQ)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	enrichTicketListWithAttachments(ac.attachmentRepository, tickets)

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

func parseLimitOffsetMe(w http.ResponseWriter, r *http.Request, defaultLimit int) (limit int, offset int, ok bool) {
	limit = defaultLimit
	offset = 0
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 || parsed > 100 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid limit"})
			return 0, 0, false
		}
		limit = parsed
	}
	if raw := r.URL.Query().Get("offset"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 0 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid offset"})
			return 0, 0, false
		}
		offset = parsed
	}
	return limit, offset, true
}

func enrichActivityCommentAttachments(repo *repository.CommentAttachmentRepository, comments []model.CommentWithTicketContext) {
	if repo == nil || len(comments) == 0 {
		return
	}
	ids := make([]int, len(comments))
	for i := range comments {
		ids[i] = comments[i].CommentId
	}
	rows, err := repo.ListByCommentIDs(ids)
	if err != nil || len(rows) == 0 {
		return
	}
	byComment := make(map[int][]model.TicketAttachment)
	for _, row := range rows {
		att := model.TicketAttachment{
			ID:           row.ID,
			OriginalName: row.OriginalName,
			MimeType:     row.MimeType,
			SizeBytes:    row.SizeBytes,
			URL:          fmt.Sprintf("/api/files/comments/%d/attachments/%d", row.CommentID, row.ID),
		}
		byComment[row.CommentID] = append(byComment[row.CommentID], att)
	}
	for i := range comments {
		if atts, ok := byComment[comments[i].CommentId]; ok {
			comments[i].Attachments = atts
		}
	}
}

func anonymizeActivityComment(c *model.CommentWithTicketContext) {
	if c == nil || !c.IsAnonymous {
		return
	}
	c.UserName = "Usuário anônimo"
	c.UserHasAvatar = false
	c.UserId = 0
}

func (ac *ActivityController) ListMyComments(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	limit, offset, parseOk := parseLimitOffsetMe(w, r, 20)
	if !parseOk {
		return
	}

	comments, hasMore, err := ac.commentRepository.ListByAuthor(user.UserID, limit, offset, user.UserID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	enrichActivityCommentAttachments(ac.commentAttachmentRepository, comments)
	for i := range comments {
		comments[i].IsOwner = comments[i].UserId == user.UserID || user.IsAdmin
		anonymizeActivityComment(&comments[i])
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{
		"items":       comments,
		"limit":       limit,
		"offset":      offset,
		"next_offset": offset + len(comments),
		"has_more":    hasMore,
	})
}

func (ac *ActivityController) ListMyLikes(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	limit, offset, parseOk := parseLimitOffsetMe(w, r, 20)
	if !parseOk {
		return
	}

	tickets, hasMore, err := ac.likeRepository.ListTicketsLikedByUser(user.UserID, limit, offset)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	enrichTicketListWithAttachments(ac.attachmentRepository, tickets)

	for i := range tickets {
		tickets[i].IsOwner = tickets[i].UserID == user.UserID || user.IsAdmin
		if tickets[i].IsAnonymous {
			tickets[i].UserName = "Usuário anônimo"
			tickets[i].UserHasAvatar = false
			tickets[i].UserID = 0
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{
		"items":       tickets,
		"limit":       limit,
		"offset":      offset,
		"next_offset": offset + len(tickets),
		"has_more":    hasMore,
	})
}
