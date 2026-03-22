package controller

import (
	"encoding/json"
	"net/http"

	"githubs.com/FelippeRibeiro/tickets-hub/internal/model"
	"githubs.com/FelippeRibeiro/tickets-hub/internal/repository"
)

type UserController struct {
	userRepository *repository.UserRepository
}

func (uc *UserController) SetupRoutes(server *http.ServeMux) {
	server.HandleFunc("GET /api/users", uc.GetAllUsers)
	server.HandleFunc("POST /api/users", uc.CreateUser)

}

func NewUserController(userRepository *repository.UserRepository) *UserController {
	return &UserController{
		userRepository: userRepository,
	}
}

func (uc *UserController) GetAllUsers(w http.ResponseWriter, r *http.Request) {
	users, err := uc.userRepository.FindAll()
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(users)
}

func (uc *UserController) CreateUser(w http.ResponseWriter, r *http.Request) {
	var user model.CreateUser
	json.NewDecoder(r.Body).Decode(&user)

	w.Header().Set("Content-Type", "application/json")
	//Validate user fields
	if user.Name == "" || user.Email == "" || user.Password == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "name or email or password is empty"})
		return
	}
	//Hash password
	err := uc.userRepository.Create(&user)
	if err != nil {
		//Validate errors and throw custom errors
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(user)
}
