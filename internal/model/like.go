package model

type TicketLikeSummary struct {
	Count int  `json:"count" db:"count"`
	Liked bool `json:"liked" db:"liked"`
}
