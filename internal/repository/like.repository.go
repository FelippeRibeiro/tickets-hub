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

// ListTicketsLikedByUser returns tickets the user liked, ordered by like time (newest first).
func (lr *LikeRepository) ListTicketsLikedByUser(viewerUserID int, limit int, offset int) ([]model.TicketWithUserName, bool, error) {
	tickets := []model.TicketWithUserName{}
	err := lr.db.Select(&tickets, `
		SELECT
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
			COALESCE((SELECT COUNT(*) FROM ticket_likes tl2 WHERE tl2.ticket_id = t.id), 0) AS likes_count,
			COALESCE((SELECT COUNT(*) FROM comments c WHERE c.ticket_id = t.id), 0) AS comments_count,
			true AS liked
		FROM ticket_likes tl
		INNER JOIN tickets t ON t.id = tl.ticket_id
		INNER JOIN topics tp ON tp.id = t.topic_id
		LEFT JOIN users u ON t.user_id = u.id
		WHERE tl.user_id = $1
		ORDER BY tl.created_at DESC
		LIMIT $2 OFFSET $3`, viewerUserID, limit+1, offset)
	if err != nil {
		return nil, false, err
	}
	hasMore := len(tickets) > limit
	if hasMore {
		tickets = tickets[:limit]
	}
	return tickets, hasMore, nil
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
