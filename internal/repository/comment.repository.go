package repository

import (
	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/jmoiron/sqlx"
)

type CommentRepository struct {
	db *sqlx.DB
}

func NewCommentRepository(db *sqlx.DB) *CommentRepository { return &CommentRepository{db: db} }

func (cr *CommentRepository) Create(userID int, comment *model.CreateComment) error {
	_, err := cr.db.Exec(`INSERT INTO comments (comment,user_id,ticket_id) VALUES ($1,$2,$3)`, comment.Comment, userID, comment.TicketId)
	if err != nil {
		return err
	}
	return nil
}

func (cr *CommentRepository) Get(userID int, ticketID string) ([]model.CommentWithUserName, error) {
	out := []model.CommentWithUserName{}
	err := cr.db.Select(&out, `SELECT *,u.name as user_name FROM comments c
         INNER JOIN users u ON c.user_id = u.id
         WHERE user_id=$1 AND ticket_id=$2`, userID, ticketID)
	return out, err
}
