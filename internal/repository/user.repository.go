package repository

import (
	"github.com/FelippeRibeiro/tickets-hub/internal/model"

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

func (ur *UserRepository) FindAll() ([]model.User, error) {
	users := []model.User{}
	err := ur.db.Select(&users, "SELECT * FROM users;")
	if err != nil {
		return nil, err
	}
	return users, nil
}

func (ur *UserRepository) FindByID(id int) (*model.User, error) {
	user := model.User{}
	err := ur.db.Get(&user, "SELECT * FROM users WHERE id=$1;", id)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (ur *UserRepository) FindByName(name string) (*model.User, error) {
	user := model.User{}
	err := ur.db.Get(&user, "SELECT * FROM users WHERE name=$1;", name)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (ur *UserRepository) FindByEmail(email string) (model.User, error) {
	user := model.User{}
	err := ur.db.Get(&user, "SELECT * FROM users WHERE email= $1;", email)
	if err != nil {
		return model.User{}, err
	}
	return user, nil
}

func (ur *UserRepository) Create(user *model.CreateUser) error {
	_, err := ur.db.NamedExec("INSERT INTO users (name,email,is_admin,password) VALUES "+
		"(:name,:email,false,:password)", user)
	if err != nil {
		return err
	}
	return nil
}
