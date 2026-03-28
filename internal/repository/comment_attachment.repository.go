package repository

import (
	"github.com/FelippeRibeiro/tickets-hub/internal/model"

	"github.com/jmoiron/sqlx"
)

type CommentAttachmentRepository struct {
	db *sqlx.DB
}

func NewCommentAttachmentRepository(db *sqlx.DB) *CommentAttachmentRepository {
	return &CommentAttachmentRepository{db: db}
}

func (r *CommentAttachmentRepository) Insert(commentID int, originalName, storedPath, mime string, size int64) (int, error) {
	var id int
	err := r.db.QueryRowx(`
		INSERT INTO comment_attachments (comment_id, original_name, stored_path, mime_type, size_bytes)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id`,
		commentID, originalName, storedPath, mime, size).Scan(&id)
	return id, err
}

func (r *CommentAttachmentRepository) ListByCommentIDs(commentIDs []int) ([]model.CommentAttachmentRow, error) {
	if len(commentIDs) == 0 {
		return nil, nil
	}
	query, args, err := sqlx.In(`
		SELECT id, comment_id, original_name, stored_path, mime_type, size_bytes, created_at
		FROM comment_attachments
		WHERE comment_id IN (?)
		ORDER BY comment_id ASC, id ASC`, commentIDs)
	if err != nil {
		return nil, err
	}
	query = r.db.Rebind(query)
	var rows []model.CommentAttachmentRow
	err = r.db.Select(&rows, query, args...)
	if err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *CommentAttachmentRepository) FindByID(id int) (*model.CommentAttachmentRow, error) {
	var row model.CommentAttachmentRow
	err := r.db.Get(&row, `
		SELECT id, comment_id, original_name, stored_path, mime_type, size_bytes, created_at
		FROM comment_attachments WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	return &row, nil
}
