package model

import "time"

type Ticket struct {
	ID          int    `json:"id" db:"id"`
	Title       string `json:"title" db:"title"`
	Description string `json:"description" db:"description"`

	Status string `json:"status" db:"status"`

	UserID  int `json:"user_id" db:"user_id"`
	TopicID int `json:"topic_id" db:"topic_id"`

	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type CreateTicket struct {
	Title       string `json:"title" db:"title"`
	Description string `json:"description" db:"description"`
	TopicID     int    `json:"topic_id" db:"topic_id"`
}

type TicketWithUserName struct {
	ID          int    `json:"id" db:"id"`
	Title       string `json:"title" db:"title"`
	Description string `json:"description" db:"description"`

	Status string `json:"status" db:"status"`

	UserID   int    `json:"user_id" db:"user_id"`
	UserName string `json:"user_name" db:"user_name"`
	TopicID  int    `json:"topic_id" db:"topic_id"`

	CreatedAt time.Time `json:"created_at" db:"created_at"`
}
