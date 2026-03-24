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

func (tr *TicketRepository) FindByID(id int) (*model.TicketWithUserName, error) {
	var t model.TicketWithUserName
	err := tr.db.Get(&t, `SELECT 
		t.*,
		u.name AS user_name,
		COALESCE((SELECT COUNT(*) FROM ticket_likes tl WHERE tl.ticket_id = t.id), 0) AS likes_count,
		COALESCE((SELECT COUNT(*) FROM comments c WHERE c.ticket_id = t.id), 0) AS comments_count
		FROM tickets t 
		INNER JOIN users u on t.user_id = u.id 
		WHERE t.id = $1`, id)
	if err != nil {
		return nil, err
	}
	return &t, nil
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

func (tr *TicketRepository) List(topicID *int) ([]model.TicketWithUserName, error) {
	tickets := []model.TicketWithUserName{}
	var err error
	if topicID != nil {
		err = tr.db.Select(&tickets, `SELECT 
			t.*,
			u.name AS user_name,
			COALESCE((SELECT COUNT(*) FROM ticket_likes tl WHERE tl.ticket_id = t.id), 0) AS likes_count,
			COALESCE((SELECT COUNT(*) FROM comments c WHERE c.ticket_id = t.id), 0) AS comments_count
			FROM tickets t 
			INNER JOIN users u on t.user_id = u.id 
			WHERE topic_id = $1 
			ORDER BY created_at DESC`, *topicID)
	} else {
		err = tr.db.Select(&tickets, `SELECT 
			t.*,
			u.name AS user_name,
			COALESCE((SELECT COUNT(*) FROM ticket_likes tl WHERE tl.ticket_id = t.id), 0) AS likes_count,
			COALESCE((SELECT COUNT(*) FROM comments c WHERE c.ticket_id = t.id), 0) AS comments_count
			FROM tickets t 
			INNER JOIN users u on t.user_id = u.id 
			ORDER BY created_at DESC`)
	}
	return tickets, err
}
