package model

type Topic struct {
	ID           int    `json:"id" db:"id"`
	Name         string `json:"name" db:"name"`
	TicketsCount int    `json:"tickets_count" db:"tickets_count"`
}

type CreateTopic struct {
	Name string `json:"name" db:"name"`
}
