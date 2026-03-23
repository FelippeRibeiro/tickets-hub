package controller

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/FelippeRibeiro/tickets-hub/internal/repository"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/middlewares"
	"github.com/FelippeRibeiro/tickets-hub/pkg/utils"
	"golang.org/x/crypto/bcrypt"
)

type UserController struct {
	userRepository *repository.UserRepository
}

func (uc *UserController) SetupRoutes(server *http.ServeMux) {
	server.Handle("GET /api/users", middlewares.AuthMiddleware(http.HandlerFunc(uc.GetAllUsers), false))
	server.HandleFunc("POST /api/users", uc.CreateUser)
	server.HandleFunc("POST /api/login", uc.Login)

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
	fmt.Println(user)
	if user.Name == "" || user.Email == "" || user.Password == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "name or email or password is empty"})
		return
	}
	//Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	user.Password = string(passwordHash)

	//Creating user
	err = uc.userRepository.Create(&user)
	if err != nil {
		//Validate errors and throw custom errors
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(user)
}

func (uc *UserController) Login(w http.ResponseWriter, r *http.Request) {
	var user model.LoginUser
	json.NewDecoder(r.Body).Decode(&user)
	w.Header().Set("Content-Type", "application/json")
	if user.Email == "" || user.Password == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "email or password is empty"})
		return
	}
	userSearch, err := uc.userRepository.FindByEmail(user.Email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{"error": "user not found"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(userSearch.Password), []byte(user.Password))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "email or password is wrong"})
		return
	}

	payload, err := utils.GenerateJWTToken(&userSearch)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
	}

	w.Header().Set("Set-Cookie", "token="+payload)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"token": payload})

}
