package middlewares

import (
	"context"
	"net/http"

	"github.com/FelippeRibeiro/tickets-hub/internal/repository"
	"github.com/FelippeRibeiro/tickets-hub/pkg/utils"
	"github.com/jmoiron/sqlx"
)

var DB *sqlx.DB
var userRepository *repository.UserRepository
func SetDB(db *sqlx.DB) {
	DB = db
	userRepository = repository.NewUserRepository(db)
}


func AuthMiddleware(next http.Handler, isAdmin bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, err := r.Cookie("token")
		if err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		payload, err := utils.ValidateJWTToken(token.Value)
		if err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		user, _ := userRepository.FindByID(payload.UserID)
		if user == nil {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		
		if isAdmin && user.IsAdmin == false {
			w.WriteHeader(http.StatusForbidden)
			return
		}

		ctx := context.WithValue(r.Context(), "user", payload)
		r = r.WithContext(ctx)
		next.ServeHTTP(w, r)
	})
}
