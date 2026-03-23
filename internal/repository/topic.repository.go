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
	err := ur.db.Select(&topic, "SELECT * FROM topics;")
	return topic, err
}

func (ur *TopicRepository) FindByID(id int) (*model.Topic, error) {
	topic := model.Topic{}
	err := ur.db.Get(&topic, "SELECT * FROM topics WHERE id=$1;", id)
	return &topic, err
}

func (ur *TopicRepository) FindByName(name string) (*model.Topic, error) {
	topic := model.Topic{}
	err := ur.db.Get(&topic, "SELECT * FROM topics WHERE name=$1;", name)
	return &topic, err
}

func (ur *TopicRepository) CreateTopic(topic *model.CreateTopic) error {
	_, err := ur.db.NamedExec("INSERT INTO topics (name) VALUES "+
		"(:name", topic)
	if err != nil {
		return err
	}
	return nil
}
