package model

type User struct {
	Id       int    `json:"id" db:"id"`
	Name     string `json:"name" db:"name"`
	Email    string `json:"email" db:"email"`
	IsAdmin  bool   `json:"is_admin" db:"is_admin"`
	Password string `json:"password" db:"password"`
}
