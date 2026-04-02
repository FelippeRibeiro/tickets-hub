package model

import "time"

type Notification struct {
	ID               int        `json:"id" db:"id"`
	UserID           int        `json:"user_id" db:"user_id"`
	Type             string     `json:"type" db:"type"`
	TicketID         int        `json:"ticket_id" db:"ticket_id"`
	ActorID          *int       `json:"actor_id,omitempty" db:"actor_id"`
	ActorName        string     `json:"actor_name" db:"actor_name"`
	ActorHasAvatar   bool       `json:"actor_has_avatar" db:"actor_has_avatar"`
	ActorIsAnonymous bool       `json:"actor_is_anonymous" db:"actor_is_anonymous"`
	CommentID        *int       `json:"comment_id,omitempty" db:"comment_id"`
	CommentPreview   string     `json:"comment_preview,omitempty" db:"comment_preview"`
	TicketTitle      string     `json:"ticket_title" db:"ticket_title"`
	ReadAt           *time.Time `json:"read_at,omitempty" db:"read_at"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
}
