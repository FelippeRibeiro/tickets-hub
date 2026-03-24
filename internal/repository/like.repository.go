package repository

import (
	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/jmoiron/sqlx"
)

type LikeRepository struct {
	db *sqlx.DB
}

func NewLikeRepository(db *sqlx.DB) *LikeRepository {
	return &LikeRepository{db: db}
}

func (lr *LikeRepository) Create(userID, ticketID int) error {
	_, err := lr.db.Exec(`
		INSERT INTO ticket_likes (user_id, ticket_id)
		VALUES ($1, $2)
		ON CONFLICT (user_id, ticket_id) DO NOTHING
	`, userID, ticketID)
	return err
}

func (lr *LikeRepository) Delete(userID, ticketID int) error {
	_, err := lr.db.Exec(`
		DELETE FROM ticket_likes
		WHERE user_id = $1 AND ticket_id = $2
	`, userID, ticketID)
	return err
}

func (lr *LikeRepository) Summary(userID, ticketID int) (*model.TicketLikeSummary, error) {
	out := model.TicketLikeSummary{}
	err := lr.db.Get(&out, `
		SELECT
			COALESCE((SELECT COUNT(*) FROM ticket_likes WHERE ticket_id = $1), 0) AS count,
			EXISTS(
				SELECT 1
				FROM ticket_likes
				WHERE ticket_id = $1 AND user_id = $2
			) AS liked
	`, ticketID, userID)
	if err != nil {
		return nil, err
	}
	return &out, nil
}
