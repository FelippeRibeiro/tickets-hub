package model

type Topic struct {
	ID   int    `json:"id" db:"id"`
	Name string `json:"name" db:"name"`
}
