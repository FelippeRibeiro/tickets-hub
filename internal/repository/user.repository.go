package repository

import (
	"githubs.com/FelippeRibeiro/tickets-hub/internal/model"

	"github.com/jmoiron/sqlx"
)

type UserRepository struct {
	db *sqlx.DB
}

func NewUserRepository(db *sqlx.DB) *UserRepository {
	return &UserRepository{
		db: db,
	}
}

func (ur *UserRepository) findAll() (*model.User, error) {
	users := model.User{}
	err := ur.db.Get(&users, "SELECT * FROM users;")
	return &users, err
}
func (ur *UserRepository) findByID(id int64) (*model.User, error) {
	user := model.User{}
	err := ur.db.Get(&user, "SELECT * FROM users WHERE id=?;", id)
	return &user, err
}

func (ur *UserRepository) findByName(name string) (*model.User, error) {
	user := model.User{}
	err := ur.db.Get(&user, "SELECT * FROM users WHERE name=?;", name)
	return &user, err
}
