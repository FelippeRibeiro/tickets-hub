package repository

import (
	"github.com/FelippeRibeiro/tickets-hub/internal/model"

	"github.com/jmoiron/sqlx"
)

type AttachmentRepository struct {
	db *sqlx.DB
}

func NewAttachmentRepository(db *sqlx.DB) *AttachmentRepository {
	return &AttachmentRepository{db: db}
}

func (r *AttachmentRepository) Insert(ticketID int, originalName, storedPath, mime string, size int64) (int, error) {
	var id int
	err := r.db.QueryRowx(`
		INSERT INTO ticket_attachments (ticket_id, original_name, stored_path, mime_type, size_bytes)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id`,
		ticketID, originalName, storedPath, mime, size).Scan(&id)
	return id, err
}

func (r *AttachmentRepository) ListByTicketID(ticketID int) ([]model.TicketAttachmentRow, error) {
	var rows []model.TicketAttachmentRow
	err := r.db.Select(&rows, `
		SELECT id, ticket_id, original_name, stored_path, mime_type, size_bytes, created_at
		FROM ticket_attachments
		WHERE ticket_id = $1
		ORDER BY id ASC`, ticketID)
	if err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *AttachmentRepository) FindByID(id int) (*model.TicketAttachmentRow, error) {
	var row model.TicketAttachmentRow
	err := r.db.Get(&row, `
		SELECT id, ticket_id, original_name, stored_path, mime_type, size_bytes, created_at
		FROM ticket_attachments WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	return &row, nil
}
