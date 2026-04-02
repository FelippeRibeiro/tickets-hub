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
		t.id,
		t.title,
		t.description,
		t.is_anonymous,
		t.status,
		t.created_at,
		tp.name AS topic_name,
		COALESCE(t.user_id, 0) AS user_id,
		COALESCE(t.topic_id, 0) AS topic_id,
		COALESCE(u.name, 'Usuário não encontrado') AS user_name,
		(COALESCE(octet_length(u.avatar_data), 0) > 0) AS user_has_avatar,
		COALESCE((SELECT COUNT(*) FROM ticket_likes tl WHERE tl.ticket_id = t.id), 0) AS likes_count,
		COALESCE((SELECT COUNT(*) FROM comments c WHERE c.ticket_id = t.id), 0) AS comments_count
		FROM tickets t 
		INNER JOIN topics tp on tp.id = t.topic_id
		LEFT JOIN users u on t.user_id = u.id
		WHERE t.id = $1`, id)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (tr *TicketRepository) Create(userID int, ticket *model.CreateTicket) (*model.Ticket, error) {
	var out model.Ticket
	err := tr.db.QueryRowx(`
		INSERT INTO tickets (title, description, status, user_id, topic_id, is_anonymous)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, title, description, status, user_id, topic_id, created_at, is_anonymous`,
		ticket.Title, ticket.Description, "created", userID, ticket.TopicID, ticket.IsAnonymous,
	).StructScan(&out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (tr *TicketRepository) List(topicID *int, userID *int, onlyMine bool) ([]model.TicketWithUserName, error) {
	tickets := []model.TicketWithUserName{}
	baseQuery := `SELECT 
		t.id,
		t.title,
		t.description,
		t.is_anonymous,
		t.status,
		t.created_at,
		tp.name AS topic_name,
		COALESCE(t.user_id, 0) AS user_id,
		COALESCE(t.topic_id, 0) AS topic_id,
		COALESCE(u.name, 'Usuário não encontrado') AS user_name,
		(COALESCE(octet_length(u.avatar_data), 0) > 0) AS user_has_avatar,
		COALESCE((SELECT COUNT(*) FROM ticket_likes tl WHERE tl.ticket_id = t.id), 0) AS likes_count,
		COALESCE((SELECT COUNT(*) FROM comments c WHERE c.ticket_id = t.id), 0) AS comments_count,
		(SELECT COUNT(*) > 0 FROM ticket_likes WHERE user_id = $1 and ticket_id = t.id) AS liked
		FROM tickets t 
		INNER JOIN topics tp on tp.id = t.topic_id
		LEFT JOIN users u on t.user_id = u.id`

	var err error
	switch {
	case onlyMine && topicID != nil:
		err = tr.db.Select(
			&tickets,
			baseQuery+`
			WHERE t.user_id = $2 AND t.topic_id = $3
			ORDER BY created_at DESC`,
			*userID,
			*userID,
			*topicID,
		)
	case onlyMine:
		err = tr.db.Select(
			&tickets,
			baseQuery+`
			WHERE t.user_id = $2
			ORDER BY created_at DESC`,
			*userID,
			*userID,
		)
	case topicID != nil:
		err = tr.db.Select(
			&tickets,
			baseQuery+`
			WHERE t.topic_id = $2
			ORDER BY created_at DESC`,
			*userID,
			*topicID,
		)
	default:
		err = tr.db.Select(
			&tickets,
			baseQuery+`
			ORDER BY created_at DESC`,
			*userID,
		)
	}
	if err != nil {
		return nil, err
	}
	return tickets, nil
}

func (tr *TicketRepository) DeleteTicket(ticketID int) error {
	_, err := tr.db.Exec(`
		DELETE FROM tickets WHERE id = $1`, ticketID)
	if err != nil {
		return err
	}
	return nil
}
