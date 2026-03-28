package model

import "time"

// TicketAttachment é o payload JSON para listagem/download (sem caminho interno).
type TicketAttachment struct {
	ID           int    `json:"id"`
	OriginalName string `json:"original_name"`
	MimeType     string `json:"mime_type"`
	SizeBytes    int64  `json:"size_bytes"`
	URL          string `json:"url"`
}

// TicketAttachmentRow representa uma linha em ticket_attachments.
type TicketAttachmentRow struct {
	ID           int       `json:"id" db:"id"`
	TicketID     int       `json:"ticket_id" db:"ticket_id"`
	OriginalName string    `json:"original_name" db:"original_name"`
	StoredPath   string    `json:"stored_path" db:"stored_path"`
	MimeType     string    `json:"mime_type" db:"mime_type"`
	SizeBytes    int64     `json:"size_bytes" db:"size_bytes"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}
