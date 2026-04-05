package repository

import (
	"database/sql"
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
		c.parent_comment_id,
		COALESCE(u.name, 'Usuário não encontrado') as user_name,
		(COALESCE(octet_length(u.avatar_data), 0) > 0) AS user_has_avatar,
		0 AS likes_count,
		false AS liked,
		'' AS parent_user_name
		FROM comments c
		LEFT JOIN users u ON c.user_id = u.id
		WHERE c.id = $1`, commentID)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (cr *CommentRepository) Create(userID int, comment *model.CreateComment) (*model.CommentWithUserName, error) {
	var parent interface{}
	if comment.ParentCommentID != nil {
		parent = *comment.ParentCommentID
	} else {
		parent = nil
	}

	var out model.CommentWithUserName
	err := cr.db.Get(&out, `
		WITH ins AS (
			INSERT INTO comments (comment, user_id, ticket_id, is_anonymous, parent_comment_id)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, comment, created_at, user_id, ticket_id, is_anonymous, parent_comment_id
		)
		SELECT
			ins.id,
			ins.comment,
			ins.created_at,
			COALESCE(ins.user_id, 0) AS user_id,
			ins.ticket_id,
			ins.is_anonymous,
			ins.parent_comment_id,
			COALESCE(u.name, 'Usuário não encontrado') AS user_name,
			(COALESCE(octet_length(u.avatar_data), 0) > 0) AS user_has_avatar,
			0 AS likes_count,
			false AS liked,
			CASE
				WHEN ins.parent_comment_id IS NULL THEN ''
				WHEN p.is_anonymous THEN 'Usuário anônimo'
				ELSE COALESCE(pu.name, '')
			END AS parent_user_name
		FROM ins
		LEFT JOIN users u ON ins.user_id = u.id
		LEFT JOIN comments p ON p.id = ins.parent_comment_id
		LEFT JOIN users pu ON p.user_id = pu.id AND COALESCE(p.is_anonymous, FALSE) = FALSE
	`, comment.Comment, userID, comment.TicketId, comment.IsAnonymous, parent)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (cr *CommentRepository) ListByTicket(ticketID int, limit int, offset int, viewerUserID int) ([]model.CommentWithUserName, bool, error) {
	out := []model.CommentWithUserName{}
	err := cr.db.Select(&out, `SELECT c.id, c.comment, c.created_at, 
	 COALESCE(c.user_id, 0) as user_id, c.ticket_id, c.is_anonymous,
	 c.parent_comment_id,
	 COALESCE(u.name, 'Usuário não encontrado') as user_name,
	 (COALESCE(octet_length(u.avatar_data), 0) > 0) AS user_has_avatar,
	 COALESCE((SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id), 0) AS likes_count,
	 ($4 > 0 AND EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = $4)) AS liked,
	 CASE
	   WHEN c.parent_comment_id IS NULL THEN ''
	   WHEN parent.is_anonymous THEN 'Usuário anônimo'
	   ELSE COALESCE(pu.name, '')
	 END AS parent_user_name
		FROM comments c
		LEFT JOIN users u ON c.user_id = u.id
		LEFT JOIN comments parent ON parent.id = c.parent_comment_id
		LEFT JOIN users pu ON parent.user_id = pu.id AND COALESCE(parent.is_anonymous, FALSE) = FALSE
		WHERE c.ticket_id=$1
		ORDER BY c.created_at ASC
		LIMIT $2 OFFSET $3`, ticketID, limit+1, offset, viewerUserID)
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

// TicketIDForComment returns the ticket id for a comment (for validation).
func (cr *CommentRepository) TicketIDForComment(commentID int) (int, error) {
	var tid int
	err := cr.db.Get(&tid, `SELECT ticket_id FROM comments WHERE id = $1`, commentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, err
		}
		return 0, err
	}
	return tid, nil
}
