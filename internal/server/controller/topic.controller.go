package controller

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/FelippeRibeiro/tickets-hub/internal/repository"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/middlewares"
)

type TopicController struct {
	topicRepository *repository.TopicRepository
}

func (uc *TopicController) SetupRoutes(server *http.ServeMux) {
	server.HandleFunc("GET /api/topics", uc.GetAllTopics)
	server.Handle("POST /api/topics", middlewares.AuthMiddleware(http.HandlerFunc(uc.CreateTopic), true))
	server.Handle("DELETE /api/topics/{id}", middlewares.AuthMiddleware(http.HandlerFunc(uc.DeleteTopic), true))

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

func (uc *TopicController) DeleteTopic(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || id <= 0 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid topic id"})
		return
	}

	_, err = uc.topicRepository.FindByID(id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{"error": "topic not found"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	count, err := uc.topicRepository.CountTicketsByTopicID(id)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	if count > 0 && r.URL.Query().Get("force") != "true" {
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]any{
			"error":         "topic has linked tickets",
			"tickets_count": count,
			"requires_force": true,
		})
		return
	}

	if err := uc.topicRepository.DeleteByID(id); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{
		"message": "topic deleted",
		"id":      id,
	})
}
