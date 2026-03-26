package repository

import (
	"github.com/FelippeRibeiro/tickets-hub/internal/model"

	"github.com/jmoiron/sqlx"
)

type TopicRepository struct {
	db *sqlx.DB
}

func NewTopicRepository(db *sqlx.DB) *TopicRepository {
	return &TopicRepository{
		db: db,
	}
}

func (ur *TopicRepository) FindAll() ([]model.Topic, error) {
	topic := []model.Topic{}
	err := ur.db.Select(&topic, `
		SELECT 
			t.id,
			t.name,
			COALESCE((SELECT COUNT(*) FROM tickets tk WHERE tk.topic_id = t.id), 0) AS tickets_count
		FROM topics t
		ORDER BY t.id ASC;
	`)
	if err != nil {
		return nil, err
	}
	return topic, nil
}

func (ur *TopicRepository) FindByID(id int) (*model.Topic, error) {
	topic := model.Topic{}
	err := ur.db.Get(&topic, "SELECT * FROM topics WHERE id=$1;", id)
	if err != nil {
		return nil, err
	}
	return &topic, err
}

func (ur *TopicRepository) FindByName(name string) (*model.Topic, error) {
	topic := model.Topic{}
	err := ur.db.Get(&topic, "SELECT * FROM topics WHERE name=$1;", name)
	if err != nil {
		return nil, err
	}
	return &topic, err
}

func (ur *TopicRepository) CreateTopic(topic *model.CreateTopic) error {
	_, err := ur.db.NamedExec("INSERT INTO topics (name) VALUES (:name)", topic)
	if err != nil {
		return err
	}
	return nil
}

func (ur *TopicRepository) CountTicketsByTopicID(id int) (int, error) {
	var count int
	err := ur.db.Get(&count, "SELECT COUNT(*) FROM tickets WHERE topic_id = $1;", id)
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (ur *TopicRepository) DeleteByID(id int) error {
	_, err := ur.db.Exec("DELETE FROM topics WHERE id = $1;", id)
	if err != nil {
		return err
	}
	return nil
}
