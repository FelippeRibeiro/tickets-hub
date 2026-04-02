package repository

import (
	"strconv"

	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/jmoiron/sqlx"
)

type CommentRepository struct {
	db *sqlx.DB
}

func NewCommentRepository(db *sqlx.DB) *CommentRepository { return &CommentRepository{db: db} }

func (cr *CommentRepository) FindByID(commentID int) (*model.CommentWithUserName, error) {
	var out model.CommentWithUserName
	err := cr.db.Get(&out, `SELECT c.id, c.comment, c.created_at,
		COALESCE(c.user_id, 0) as user_id, c.ticket_id, c.is_anonymous,
		COALESCE(u.name, 'Usuário não encontrado') as user_name,
		(COALESCE(octet_length(u.avatar_data), 0) > 0) AS user_has_avatar
		FROM comments c
		LEFT JOIN users u ON c.user_id = u.id
		WHERE c.id = $1`, commentID)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (cr *CommentRepository) Create(userID int, comment *model.CreateComment) (*model.CommentWithUserName, error) {
	var out model.CommentWithUserName
	err := cr.db.Get(&out, `
		INSERT INTO comments (comment, user_id, ticket_id, is_anonymous) 
		VALUES ($1, $2, $3, $4)
		RETURNING 
			id,
			comment,
			created_at,
			user_id,
			ticket_id,
			is_anonymous,
			(SELECT name FROM users WHERE id = $2) AS user_name,
			(SELECT (COALESCE(octet_length(avatar_data), 0) > 0) FROM users WHERE id = $2) AS user_has_avatar
	`, comment.Comment, userID, comment.TicketId, comment.IsAnonymous)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (cr *CommentRepository) ListByTicket(ticketID int, limit int, offset int) ([]model.CommentWithUserName, bool, error) {
	out := []model.CommentWithUserName{}
	err := cr.db.Select(&out, `SELECT c.id, c.comment, c.created_at, 
	 COALESCE(c.user_id, 0) as user_id, c.ticket_id, c.is_anonymous,
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

func (cr *CommentRepository) DeleteByID(commentID int) error {
	_, err := cr.db.Exec(`DELETE FROM comments WHERE id = $1`, commentID)
	return err
}

func (cr *CommentRepository) ListPriorParticipantUserIDs(ticketID int, beforeCommentID int, excludeUserIDs []int) ([]int, error) {
	userIDs := []int{}
	query := `
		SELECT DISTINCT c.user_id
		FROM comments c
		WHERE c.ticket_id = $1
			AND c.id < $2
			AND c.user_id IS NOT NULL
	`

	args := []any{ticketID, beforeCommentID}
	for i, userID := range excludeUserIDs {
		query += ` AND c.user_id != $` + strconv.Itoa(i+3)
		args = append(args, userID)
	}

	err := cr.db.Select(&userIDs, query, args...)
	if err != nil {
		return nil, err
	}
	return userIDs, nil
}
