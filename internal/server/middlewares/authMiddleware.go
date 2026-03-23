package middlewares

import (
	"context"
	"net/http"

	"github.com/FelippeRibeiro/tickets-hub/pkg/utils"
)

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
		if isAdmin && payload.IsAdmin == false {
			w.WriteHeader(http.StatusForbidden)
			return
		}

		ctx := context.WithValue(r.Context(), "user", payload)
		r = r.WithContext(ctx)
		next.ServeHTTP(w, r)
	})
}
