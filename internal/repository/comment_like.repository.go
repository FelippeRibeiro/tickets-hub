package repository

import (
	"database/sql"
	"errors"

	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/jmoiron/sqlx"
)

type CommentLikeRepository struct {
	db *sqlx.DB
}

func NewCommentLikeRepository(db *sqlx.DB) *CommentLikeRepository {
	return &CommentLikeRepository{db: db}
}

// Create inserts a like and reports whether a new row was inserted (false if already liked).
func (r *CommentLikeRepository) Create(userID, commentID int) (inserted bool, err error) {
	var cid int
	err = r.db.QueryRow(`
		INSERT INTO comment_likes (user_id, comment_id)
		VALUES ($1, $2)
		ON CONFLICT (user_id, comment_id) DO NOTHING
		RETURNING comment_id
	`, userID, commentID).Scan(&cid)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (r *CommentLikeRepository) Delete(userID, commentID int) error {
	_, err := r.db.Exec(`
		DELETE FROM comment_likes
		WHERE user_id = $1 AND comment_id = $2
	`, userID, commentID)
	return err
}

func (r *CommentLikeRepository) Summary(viewerUserID, commentID int) (*model.CommentLikeSummary, error) {
	out := model.CommentLikeSummary{}
	err := r.db.Get(&out, `
		SELECT
			COALESCE((SELECT COUNT(*) FROM comment_likes WHERE comment_id = $1), 0) AS count,
			EXISTS(
				SELECT 1 FROM comment_likes
				WHERE comment_id = $1 AND user_id = $2 AND $2 > 0
			) AS liked
	`, commentID, viewerUserID)
	if err != nil {
		return nil, err
	}
	return &out, nil
}
