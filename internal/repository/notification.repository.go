package repository

import (
	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/jmoiron/sqlx"
)

type NotificationRepository struct {
	db *sqlx.DB
}

func NewNotificationRepository(db *sqlx.DB) *NotificationRepository {
	return &NotificationRepository{db: db}
}

func (nr *NotificationRepository) Create(userID int, notificationType string, ticketID int, actorID *int, actorIsAnonymous bool, commentID *int) (*model.Notification, error) {
	var id int
	err := nr.db.Get(&id, `
		INSERT INTO notifications (user_id, type, ticket_id, actor_id, actor_is_anonymous, comment_id)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, userID, notificationType, ticketID, actorID, actorIsAnonymous, commentID)
	if err != nil {
		return nil, err
	}

	return nr.FindByIDForUser(id, userID)
}

func (nr *NotificationRepository) FindByIDForUser(id int, userID int) (*model.Notification, error) {
	var out model.Notification
	err := nr.db.Get(&out, `
		SELECT
			n.id,
			n.user_id,
			n.type,
			n.ticket_id,
			n.actor_id,
			n.actor_is_anonymous,
			n.comment_id,
			n.read_at,
			n.created_at,
			t.title AS ticket_title,
			CASE
				WHEN n.actor_is_anonymous THEN 'Usuário anônimo'
				ELSE COALESCE(u.name, 'Usuário não encontrado')
			END AS actor_name,
			CASE
				WHEN n.actor_is_anonymous THEN FALSE
				ELSE (COALESCE(octet_length(u.avatar_data), 0) > 0)
			END AS actor_has_avatar,
			COALESCE(LEFT(c.comment, 140), '') AS comment_preview
		FROM notifications n
		INNER JOIN tickets t ON t.id = n.ticket_id
		LEFT JOIN users u ON u.id = n.actor_id
		LEFT JOIN comments c ON c.id = n.comment_id
		WHERE n.id = $1 AND n.user_id = $2
	`, id, userID)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (nr *NotificationRepository) ListByUser(userID int, limit int, offset int) ([]model.Notification, error) {
	out := []model.Notification{}
	err := nr.db.Select(&out, `
		SELECT
			n.id,
			n.user_id,
			n.type,
			n.ticket_id,
			n.actor_id,
			n.actor_is_anonymous,
			n.comment_id,
			n.read_at,
			n.created_at,
			t.title AS ticket_title,
			CASE
				WHEN n.actor_is_anonymous THEN 'Usuário anônimo'
				ELSE COALESCE(u.name, 'Usuário não encontrado')
			END AS actor_name,
			CASE
				WHEN n.actor_is_anonymous THEN FALSE
				ELSE (COALESCE(octet_length(u.avatar_data), 0) > 0)
			END AS actor_has_avatar,
			COALESCE(LEFT(c.comment, 140), '') AS comment_preview
		FROM notifications n
		INNER JOIN tickets t ON t.id = n.ticket_id
		LEFT JOIN users u ON u.id = n.actor_id
		LEFT JOIN comments c ON c.id = n.comment_id
		WHERE n.user_id = $1
		ORDER BY n.created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, limit, offset)
	return out, err
}

func (nr *NotificationRepository) UnreadCount(userID int) (int, error) {
	var count int
	err := nr.db.Get(&count, `
		SELECT COUNT(*)
		FROM notifications
		WHERE user_id = $1 AND read_at IS NULL
	`, userID)
	return count, err
}

func (nr *NotificationRepository) MarkRead(id int, userID int) error {
	_, err := nr.db.Exec(`
		UPDATE notifications
		SET read_at = COALESCE(read_at, NOW())
		WHERE id = $1 AND user_id = $2
	`, id, userID)
	return err
}

func (nr *NotificationRepository) MarkAllRead(userID int) error {
	_, err := nr.db.Exec(`
		UPDATE notifications
		SET read_at = NOW()
		WHERE user_id = $1 AND read_at IS NULL
	`, userID)
	return err
}
