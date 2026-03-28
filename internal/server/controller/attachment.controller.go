package controller

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/FelippeRibeiro/tickets-hub/internal/repository"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/middlewares"
	"github.com/FelippeRibeiro/tickets-hub/pkg/utils"
)

const maxAttachmentBytes = 1 << 30 // 1 GiB

type AttachmentController struct {
	ticketRepo      *repository.TicketRepository
	attachmentRepo  *repository.AttachmentRepository
	uploadRoot      string
}

func NewAttachmentController(
	ticketRepo *repository.TicketRepository,
	attachmentRepo *repository.AttachmentRepository,
	uploadRoot string,
) *AttachmentController {
	return &AttachmentController{
		ticketRepo:     ticketRepo,
		attachmentRepo: attachmentRepo,
		uploadRoot:     uploadRoot,
	}
}

func (ac *AttachmentController) SetupRoutes(server *http.ServeMux) {
	server.Handle("POST /api/tickets/{id}/attachments", middlewares.AuthMiddleware(http.HandlerFunc(ac.Upload), false))
	server.Handle("GET /api/files/tickets/{ticket_id}/attachments/{attachment_id}", http.HandlerFunc(ac.ServeFile))
}

func allowedMime(mime string) bool {
	mime = strings.TrimSpace(strings.ToLower(mime))
	if mime == "" {
		return false
	}
	return strings.HasPrefix(mime, "image/") || strings.HasPrefix(mime, "video/")
}

func (ac *AttachmentController) Upload(w http.ResponseWriter, r *http.Request) {
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

	ticket, err := ac.ticketRepo.FindByID(ticketID)
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
		json.NewEncoder(w).Encode(map[string]string{"error": "only the ticket author or an admin can upload"})
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxAttachmentBytes+1)
	if err := r.ParseMultipartForm(64 << 20); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			w.WriteHeader(http.StatusRequestEntityTooLarge)
			json.NewEncoder(w).Encode(map[string]string{"error": "file too large (max 1GB)"})
			return
		}
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid multipart form"})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "missing file field \"file\""})
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext == "" {
		ext = ".bin"
	}

	token := make([]byte, 16)
	if _, err := rand.Read(token); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	storedName := hex.EncodeToString(token) + ext
	relPath := filepath.Join("tickets", strconv.Itoa(ticketID), storedName)
	absDir := filepath.Join(ac.uploadRoot, "tickets", strconv.Itoa(ticketID))
	if err := os.MkdirAll(absDir, 0o755); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	absFile := filepath.Join(absDir, storedName)

	dst, err := os.Create(absFile)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	written, err := io.Copy(dst, io.LimitReader(file, maxAttachmentBytes+1))
	if cerr := dst.Close(); cerr != nil && err == nil {
		err = cerr
	}
	if err != nil {
		_ = os.Remove(absFile)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	if written > maxAttachmentBytes {
		_ = os.Remove(absFile)
		w.WriteHeader(http.StatusRequestEntityTooLarge)
		json.NewEncoder(w).Encode(map[string]string{"error": "file too large (max 1GB)"})
		return
	}

	readBuf := make([]byte, 512)
	fh, err := os.Open(absFile)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	n, _ := fh.Read(readBuf)
	_ = fh.Close()
	mime := http.DetectContentType(readBuf[:n])
	if header.Header.Get("Content-Type") != "" {
		declared := strings.TrimSpace(strings.ToLower(header.Header.Get("Content-Type")))
		if i := strings.Index(declared, ";"); i >= 0 {
			declared = declared[:i]
		}
		if strings.HasPrefix(declared, "image/") || strings.HasPrefix(declared, "video/") {
			mime = declared
		}
	}
	if !allowedMime(mime) {
		_ = os.Remove(absFile)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "only image and video files are allowed"})
		return
	}

	attID, err := ac.attachmentRepo.Insert(ticketID, header.Filename, filepath.ToSlash(relPath), mime, written)
	if err != nil {
		_ = os.Remove(absFile)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	out := model.TicketAttachment{
		ID:           attID,
		OriginalName: header.Filename,
		MimeType:     mime,
		SizeBytes:    written,
		URL:          fmt.Sprintf("/api/files/tickets/%d/attachments/%d", ticketID, attID),
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(out)
}

func (ac *AttachmentController) ServeFile(w http.ResponseWriter, r *http.Request) {
	ticketID, err := strconv.Atoi(r.PathValue("ticket_id"))
	if err != nil || ticketID <= 0 {
		http.NotFound(w, r)
		return
	}
	attachmentID, err := strconv.Atoi(r.PathValue("attachment_id"))
	if err != nil || attachmentID <= 0 {
		http.NotFound(w, r)
		return
	}

	row, err := ac.attachmentRepo.FindByID(attachmentID)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if row.TicketID != ticketID {
		http.NotFound(w, r)
		return
	}

	full := filepath.Join(ac.uploadRoot, filepath.FromSlash(row.StoredPath))
	full = filepath.Clean(full)
	root := filepath.Clean(ac.uploadRoot)
	rel, relErr := filepath.Rel(root, full)
	if relErr != nil || strings.HasPrefix(rel, "..") {
		http.NotFound(w, r)
		return
	}

	f, err := os.Open(full)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()

	st, err := f.Stat()
	if err != nil {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", row.MimeType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, row.OriginalName, st.ModTime(), f)
}
