package repository

import (
	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/jmoiron/sqlx"
)

type CommentRepository struct {
	db *sqlx.DB
}

func NewCommentRepository(db *sqlx.DB) *CommentRepository { return &CommentRepository{db: db} }

func (cr *CommentRepository) Create(userID int, comment *model.CreateComment) (*model.CommentWithUserName, error) {
	var out model.CommentWithUserName
	err := cr.db.Get(&out, `
		INSERT INTO comments (comment, user_id, ticket_id) 
		VALUES ($1, $2, $3)
		RETURNING 
			id,
			comment,
			created_at,
			user_id,
			ticket_id,
			(SELECT name FROM users WHERE id = $2) AS user_name,
			(SELECT (COALESCE(octet_length(avatar_data), 0) > 0) FROM users WHERE id = $2) AS user_has_avatar
	`, comment.Comment, userID, comment.TicketId)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (cr *CommentRepository) ListByTicket(ticketID int, limit int, offset int) ([]model.CommentWithUserName, bool, error) {
	out := []model.CommentWithUserName{}
	err := cr.db.Select(&out, `SELECT c.id, c.comment, c.created_at, 
	 COALESCE(c.user_id, 0) as user_id, c.ticket_id, 
	 COALESCE(u.name, 'Usuário não encontrado') as user_name,
	 (COALESCE(octet_length(u.avatar_data), 0) > 0) AS user_has_avatar
		FROM comments c
		LEFT JOIN users u ON c.user_id = u.id
		WHERE c.ticket_id=$1
		ORDER BY c.created_at ASC
		LIMIT $2 OFFSET $3`, ticketID, limit+1, offset)
	if err != nil {
		return nil, false, err
	}
	hasMore := len(out) > limit
	if hasMore {
		out = out[:limit]
	}
	return out, hasMore, nil
}
