package repository

import (
	"database/sql"

	"github.com/FelippeRibeiro/tickets-hub/internal/model"

	"github.com/jmoiron/sqlx"
)

const userSelectableColumns = `id, name, email, is_admin, password, (avatar_data IS NOT NULL) AS has_avatar`

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
	err := ur.db.Select(&users, "SELECT "+userSelectableColumns+" FROM users;")
	if err != nil {
		return nil, err
	}
	return users, nil
}

func (ur *UserRepository) FindByID(id int) (*model.User, error) {
	user := model.User{}
	err := ur.db.Get(&user, "SELECT "+userSelectableColumns+" FROM users WHERE id=$1;", id)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (ur *UserRepository) FindByName(name string) (*model.User, error) {
	user := model.User{}
	err := ur.db.Get(&user, "SELECT "+userSelectableColumns+" FROM users WHERE name=$1;", name)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (ur *UserRepository) FindByEmail(email string) (model.User, error) {
	user := model.User{}
	err := ur.db.Get(&user, "SELECT "+userSelectableColumns+" FROM users WHERE email= $1;", email)
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

func (ur *UserRepository) UpdateAvatar(userID int, mime string, data []byte) error {
	_, err := ur.db.Exec(
		`UPDATE users SET avatar_mime = $1, avatar_data = $2 WHERE id = $3`,
		mime, data, userID,
	)
	return err
}

func (ur *UserRepository) ClearAvatar(userID int) error {
	_, err := ur.db.Exec(
		`UPDATE users SET avatar_mime = NULL, avatar_data = NULL WHERE id = $1`,
		userID,
	)
	return err
}

// GetAvatar devolve mime e bytes; sql.ErrNoRows se não existir utilizador ou avatar vazio.
func (ur *UserRepository) GetAvatar(userID int) (mime string, data []byte, err error) {
	var m sql.NullString
	var b []byte
	err = ur.db.QueryRow(
		`SELECT avatar_mime, avatar_data FROM users WHERE id = $1`,
		userID,
	).Scan(&m, &b)
	if err != nil {
		return "", nil, err
	}
	if !m.Valid || len(b) == 0 {
		return "", nil, sql.ErrNoRows
	}
	return m.String, b, nil
}

func (ur *UserRepository) UpdateName(userID int, name string) error {
	_, err := ur.db.Exec(
		`UPDATE users SET name = $1 WHERE id = $2`,
		name, userID,
	)
	return err
}