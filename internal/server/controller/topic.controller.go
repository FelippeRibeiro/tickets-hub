package controller

import (
	"encoding/json"
	"net/http"

	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/FelippeRibeiro/tickets-hub/internal/repository"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/middlewares"
)

type TopicController struct {
	topicRepository *repository.TopicRepository
}

func (uc *TopicController) SetupRoutes(server *http.ServeMux) {
	server.HandleFunc("GET /api/topics", uc.GetAllTopics)
	server.Handle("POST /api/topics", middlewares.AuthMiddleware(http.HandlerFunc(uc.GetAllTopics), true))

}

func NewTopicController(topicRepository *repository.TopicRepository) *TopicController {
	return &TopicController{
		topicRepository: topicRepository,
	}
}

func (uc *TopicController) GetAllTopics(w http.ResponseWriter, r *http.Request) {
	topics, err := uc.topicRepository.FindAll()
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(topics)
}

func (uc *TopicController) CreateTopic(w http.ResponseWriter, r *http.Request) {
	var topic model.CreateTopic
	json.NewDecoder(r.Body).Decode(&topic)

	w.Header().Set("Content-Type", "application/json")

	if topic.Name == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "name is empty"})
		return
	}

	//Creating topic
	err := uc.topicRepository.CreateTopic(&topic)
	if err != nil {
		//Validate errors and throw custom errors
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(topic)
}
