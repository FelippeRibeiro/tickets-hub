package controller

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"mime/multipart"
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

type CommentController struct {
	commentRepository         *repository.CommentRepository
	ticketRepository          *repository.TicketRepository
	commentAttachmentRepository *repository.CommentAttachmentRepository
	uploadRoot                  string
}

func NewCommentController(
	commentRepository *repository.CommentRepository,
	ticketRepository *repository.TicketRepository,
	commentAttachmentRepository *repository.CommentAttachmentRepository,
	uploadRoot string,
) *CommentController {
	return &CommentController{
		commentRepository:           commentRepository,
		ticketRepository:          ticketRepository,
		commentAttachmentRepository: commentAttachmentRepository,
		uploadRoot:                  uploadRoot,
	}
}

func (cc *CommentController) SetupRoutes(server *http.ServeMux) {
	server.Handle("GET /api/tickets/{id}/comments", http.HandlerFunc(cc.ListComments))
	server.Handle("POST /api/tickets/{id}/comments", middlewares.AuthMiddleware(http.HandlerFunc(cc.CreateComment), false))
}

func (cc *CommentController) enrichCommentAttachments(comments []model.CommentWithUserName) {
	if cc.commentAttachmentRepository == nil || len(comments) == 0 {
		return
	}
	ids := make([]int, len(comments))
	for i := range comments {
		ids[i] = comments[i].CommentId
	}
	rows, err := cc.commentAttachmentRepository.ListByCommentIDs(ids)
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

func (cc *CommentController) ListComments(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || id <= 0 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid ticket id"})
		return
	}
	_, err = cc.ticketRepository.FindByID(id)
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
	limit := 10
	offset := 0
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 || parsed > 100 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid limit"})
			return
		}
		limit = parsed
	}
	if raw := r.URL.Query().Get("offset"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 0 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid offset"})
			return
		}
		offset = parsed
	}

	comments, hasMore, err := cc.commentRepository.ListByTicket(id, limit, offset)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	cc.enrichCommentAttachments(comments)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{
		"items":       comments,
		"limit":       limit,
		"offset":      offset,
		"next_offset": offset + len(comments),
		"has_more":    hasMore,
	})
}

func (cc *CommentController) CreateComment(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || id <= 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid ticket id"})
		return
	}

	_, err = cc.ticketRepository.FindByID(id)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		if errors.Is(err, sql.ErrNoRows) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{"error": "ticket not found"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		cc.createCommentMultipart(w, r, user, id)
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
	comment.Comment = strings.TrimSpace(comment.Comment)
	if comment.Comment == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "comment is required"})
		return
	}
	comment.TicketId = id

	created, err := cc.commentRepository.Create(user.UserID, &comment)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

func (cc *CommentController) createCommentMultipart(w http.ResponseWriter, r *http.Request, user *utils.Claims, ticketID int) {
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

	commentText := strings.TrimSpace(r.FormValue("comment"))
	var fileHeaders []*multipart.FileHeader
	if r.MultipartForm != nil {
		fileHeaders = r.MultipartForm.File["files"]
	}

	if commentText == "" && len(fileHeaders) == 0 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "comment or at least one file is required"})
		return
	}

	if cc.commentAttachmentRepository == nil && len(fileHeaders) > 0 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "attachments are not configured"})
		return
	}

	in := model.CreateComment{Comment: commentText, TicketId: ticketID}
	created, err := cc.commentRepository.Create(user.UserID, &in)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	for _, fh := range fileHeaders {
		file, err := fh.Open()
		if err != nil {
			continue
		}
		relPath, mime, written, err := upload.SaveMedia(cc.uploadRoot, "comments", created.CommentId, file, fh)
		_ = file.Close()
		if err != nil {
			continue
		}
		_, err = cc.commentAttachmentRepository.Insert(created.CommentId, fh.Filename, relPath, mime, written)
		if err != nil {
			_ = os.Remove(filepath.Join(cc.uploadRoot, filepath.FromSlash(relPath)))
		}
	}

	if cc.commentAttachmentRepository != nil {
		rows, err := cc.commentAttachmentRepository.ListByCommentIDs([]int{created.CommentId})
		if err == nil && len(rows) > 0 {
			created.Attachments = make([]model.TicketAttachment, 0, len(rows))
			for _, row := range rows {
				created.Attachments = append(created.Attachments, model.TicketAttachment{
					ID:           row.ID,
					OriginalName: row.OriginalName,
					MimeType:     row.MimeType,
					SizeBytes:    row.SizeBytes,
					URL:          fmt.Sprintf("/api/files/comments/%d/attachments/%d", row.CommentID, row.ID),
				})
			}
		}
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}
