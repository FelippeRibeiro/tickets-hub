package model

import (
	"time"
)

type Ticket struct {
	ID          int    `json:"id" db:"id"`
	Title       string `json:"title" db:"title"`
	Description string `json:"description" db:"description"`
	IsAnonymous bool `json:"is_anonymous" db:"is_anonymous"`
	Status string `json:"status" db:"status"`

	UserID  int `json:"user_id" db:"user_id"`
	TopicID int `json:"topic_id" db:"topic_id"`

	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type CreateTicket struct {
	Title       string `json:"title" db:"title"`
	Description string `json:"description" db:"description"`
	TopicID     int    `json:"topic_id" db:"topic_id"`
	IsAnonymous bool `json:"is_anonymous" db:"is_anonymous"`
}

type TicketWithUserName struct {
	ID          int    `json:"id" db:"id"`
	Title       string `json:"title" db:"title"`
	Description string `json:"description" db:"description"`
	IsAnonymous bool `json:"is_anonymous" db:"is_anonymous"`
	Status string `json:"status" db:"status"`

	UserID   int    `json:"user_id" db:"user_id"`
	UserName string `json:"user_name" db:"user_name"`
	UserHasAvatar bool `json:"user_has_avatar" db:"user_has_avatar"`
	TopicID  int    `json:"topic_id" db:"topic_id"`
	TopicName string `json:"topic_name" db:"topic_name"`

	LikesCount    int `json:"likes_count" db:"likes_count"`
	CommentsCount int `json:"comments_count" db:"comments_count"`
	Liked         bool `json:"liked" db:"liked"`
	IsOwner       bool `json:"is_owner" db:"-"`

	Attachments []TicketAttachment `json:"attachments,omitempty" db:"-"`

	CreatedAt time.Time `json:"created_at" db:"created_at"`
}
