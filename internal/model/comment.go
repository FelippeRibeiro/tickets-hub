package model

import "time"

type Comment struct {
	CommentId int       `json:"id" db:"id"`
	Comment   string    `json:"comment" db:"comment"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UserId    int       `json:"user_id" db:"user_id"`
	TicketId  int       `json:"ticket_id" db:"ticket_id"`
}

type CommentWithUserName struct {
	CommentId int       `json:"id" db:"id"`
	Comment   string    `json:"comment" db:"comment"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UserId    int       `json:"user_id" db:"user_id"`
	TicketId  int       `json:"ticket_id" db:"ticket_id"`
	UserName  string    `json:"user_name" db:"user_name"`

	Attachments []TicketAttachment `json:"attachments,omitempty" db:"-"`
}

type CreateComment struct {
	Comment  string `json:"comment" db:"comment"`
	TicketId int    `json:"ticket_id" db:"ticket_id"`
}
