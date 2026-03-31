package model

import "time"

type Comment struct {
	CommentId int       `json:"id" db:"id"`
	Comment   string    `json:"comment" db:"comment"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UserId    int       `json:"user_id" db:"user_id"`
	TicketId  int       `json:"ticket_id" db:"ticket_id"`
	IsAnonymous bool    `json:"is_anonymous" db:"is_anonymous"`
}

type CommentWithUserName struct {
	CommentId int       `json:"id" db:"id"`
	Comment   string    `json:"comment" db:"comment"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UserId    int       `json:"user_id" db:"user_id"`
	TicketId  int       `json:"ticket_id" db:"ticket_id"`
	UserName      string    `json:"user_name" db:"user_name"`
	UserHasAvatar bool      `json:"user_has_avatar" db:"user_has_avatar"`
	IsAnonymous bool    `json:"is_anonymous" db:"is_anonymous"`
	IsOwner     bool        `json:"is_owner" db:"-"`
	Attachments []TicketAttachment `json:"attachments,omitempty" db:"-"`
}

type CreateComment struct {
	Comment  string `json:"comment" db:"comment"`
	TicketId int    `json:"ticket_id" db:"ticket_id"`
	IsAnonymous bool    `json:"is_anonymous" db:"is_anonymous"`
}
