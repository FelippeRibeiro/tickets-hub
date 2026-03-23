package middlewares

import (
	"context"
	"fmt"
	"net/http"

	"github.com/FelippeRibeiro/tickets-hub/pkg/utils"
)

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Println("AuthMiddleware")
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

		ctx := context.WithValue(r.Context(), "user", payload)
		r = r.WithContext(ctx)
		next.ServeHTTP(w, r)
	})
}
