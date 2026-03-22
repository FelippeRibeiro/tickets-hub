package model

type User struct {
	Id       int    `json:"-" db:"id"`
	Name     string `json:"name" db:"name"`
	Email    string `json:"email" db:"email"`
	IsAdmin  bool   `json:"is_admin" db:"is_admin"`
	Password string `json:"-" db:"password"`
}

type CreateUser struct {
	Name     string `json:"name,omitempty" db:"name"`
	Email    string `json:"email,omitempty" db:"email"`
	IsAdmin  bool   `json:"is_admin,omitempty" db:"is_admin"`
	Password string `json:"password" db:"password"`
}
