package repository

import (
	"github.com/FelippeRibeiro/tickets-hub/internal/model"

	"github.com/jmoiron/sqlx"
)

type TicketRepository struct {
	db *sqlx.DB
}

func NewTicketRepository(db *sqlx.DB) *TicketRepository {
	return &TicketRepository{db: db}
}

func (tr *TicketRepository) Create(userID int, ticket *model.CreateTicket) (*model.Ticket, error) {
	var out model.Ticket
	err := tr.db.QueryRowx(`
		INSERT INTO tickets (title, description, status, user_id, topic_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, title, description, status, user_id, topic_id, created_at`,
		ticket.Title, ticket.Description, "created", userID, ticket.TopicID,
	).StructScan(&out)
	return &out, err
}


func (tr *TicketRepository) List(topicID *int) ([]model.Ticket, error) {
	tickets := []model.Ticket{}
	var err error
	if topicID != nil {
		err = tr.db.Select(&tickets, `SELECT * FROM tickets WHERE topic_id = $1 ORDER BY created_at DESC`, *topicID)
	} else {
		err = tr.db.Select(&tickets, `SELECT * FROM tickets ORDER BY created_at DESC`)
	}
	return tickets, err
}
