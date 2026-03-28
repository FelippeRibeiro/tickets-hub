package model

import "time"

// CommentAttachmentRow linha em comment_attachments.
type CommentAttachmentRow struct {
	ID           int       `json:"id" db:"id"`
	CommentID    int       `json:"comment_id" db:"comment_id"`
	OriginalName string    `json:"original_name" db:"original_name"`
	StoredPath   string    `json:"stored_path" db:"stored_path"`
	MimeType     string    `json:"mime_type" db:"mime_type"`
	SizeBytes    int64     `json:"size_bytes" db:"size_bytes"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}
