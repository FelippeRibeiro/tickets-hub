package controller

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/FelippeRibeiro/tickets-hub/internal/repository"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/middlewares"
	"github.com/FelippeRibeiro/tickets-hub/pkg/utils"
	"golang.org/x/crypto/bcrypt"
)

// maxAvatarBytes limite de tamanho da foto de perfil guardada na base de dados.
const maxAvatarBytes = 2 << 20 // 2 MiB

// authCookieMaxAge é o Max-Age em segundos. Não existe “infinito” em cookies HTTP;
// um valor alto mantém o token até o utilizador fazer logout ou limpar dados do site.
const authCookieMaxAge = 10 * 365 * 24 * 60 * 60 // 10 anos

type UserController struct {
	userRepository *repository.UserRepository
}

func NewUserController(userRepository *repository.UserRepository) *UserController {
	return &UserController{
		userRepository: userRepository,
	}
}

func (uc *UserController) SetupRoutes(server *http.ServeMux) {
	server.Handle("GET /api/users", middlewares.AuthMiddleware(http.HandlerFunc(uc.GetAllUsers), true))
	server.Handle("GET /api/me", middlewares.AuthMiddleware(http.HandlerFunc(uc.GetAuthUser), false))
	server.Handle("POST /api/me/avatar", middlewares.AuthMiddleware(http.HandlerFunc(uc.UploadAvatar), false))
	server.Handle("DELETE /api/me/avatar", middlewares.AuthMiddleware(http.HandlerFunc(uc.DeleteAvatar), false))
	server.Handle("PUT /api/me/name", middlewares.AuthMiddleware(http.HandlerFunc(uc.ChangeName), false))
	server.HandleFunc("GET /api/users/{id}/avatar", uc.ServeAvatar)
	server.HandleFunc("POST /api/users", uc.CreateUser)
	server.HandleFunc("POST /api/login", uc.Login)
	server.HandleFunc("POST /api/logout", uc.Logout)
}

func (uc *UserController) Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	w.WriteHeader(http.StatusNoContent)
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

func (uc *UserController) GetAuthUser(w http.ResponseWriter, r *http.Request) {
	user, ok := (r.Context().Value("user")).(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	userSearch, err := uc.userRepository.FindByID(user.UserID)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(userSearch)
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

	userSearch, err := uc.userRepository.FindByEmail(user.Email)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	payload, err := utils.GenerateJWTToken(&userSearch)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    payload,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   authCookieMaxAge,
	})

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "user created successfully",
		"token":   payload,
	})
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

	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    payload,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   authCookieMaxAge,
	})
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"token": payload})

}

func isAvatarImageMime(mime string) bool {
	mime = strings.TrimSpace(strings.ToLower(mime))
	if i := strings.Index(mime, ";"); i >= 0 {
		mime = mime[:i]
	}
	switch mime {
	case "image/jpeg", "image/png", "image/gif", "image/webp":
		return true
	default:
		return false
	}
}

func (uc *UserController) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxAvatarBytes+1)
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			w.WriteHeader(http.StatusRequestEntityTooLarge)
			json.NewEncoder(w).Encode(map[string]string{"error": "imagem demasiado grande (máx. 2 MB)"})
			return
		}
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "formulário inválido"})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "campo de ficheiro \"file\" em falta"})
		return
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, maxAvatarBytes+1))
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	if len(data) == 0 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "ficheiro vazio"})
		return
	}
	if len(data) > maxAvatarBytes {
		w.WriteHeader(http.StatusRequestEntityTooLarge)
		json.NewEncoder(w).Encode(map[string]string{"error": "imagem demasiado grande (máx. 2 MB)"})
		return
	}

	mime := http.DetectContentType(data)
	if header.Header.Get("Content-Type") != "" {
		decl := strings.TrimSpace(strings.ToLower(header.Header.Get("Content-Type")))
		if i := strings.Index(decl, ";"); i >= 0 {
			decl = decl[:i]
		}
		if strings.HasPrefix(decl, "image/") {
			mime = decl
		}
	}
	if !isAvatarImageMime(mime) {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "apenas imagens JPEG, PNG, GIF ou WebP"})
		return
	}

	if err := uc.userRepository.UpdateAvatar(user.UserID, mime, data); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{"has_avatar": true})
}

func (uc *UserController) DeleteAvatar(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	if err := uc.userRepository.ClearAvatar(user.UserID); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{"has_avatar": false})
}

func (uc *UserController) ServeAvatar(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.NotFound(w, r)
		return
	}

	mime, data, err := uc.userRepository.GetAvatar(id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", mime)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "private, no-cache")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (uc *UserController) ChangeName(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	user, ok := r.Context().Value("user").(*utils.Claims)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	userId := user.UserID;
	type ChangeName struct {
		Name string `json:"name"`
	}
	var newName ChangeName = ChangeName{}
	err := json.NewDecoder(r.Body).Decode(&newName)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	newName.Name = strings.TrimSpace(newName.Name)
	if newName.Name == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "name is empty"})
		return
	}
	if len(newName.Name) > 100 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "name is too long"})
		return
	}
	if len(newName.Name) < 3 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "name is too short"})
		return
	}

	err = uc.userRepository.UpdateName(userId, newName.Name)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "name changed successfully"})


}

