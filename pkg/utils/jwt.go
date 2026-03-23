package utils

import (
	"os"
	"time"

	"github.com/FelippeRibeiro/tickets-hub/internal/model"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID int    `json:"user"`
	Email  string `json:"email"`
	Name   string `json:"name"`
	jwt.RegisteredClaims
}

func GenerateJWTToken(userSearch *model.User) (string, error) {
	claims := Claims{
		UserID: userSearch.Id,
		Email:  userSearch.Email,
		Name:   userSearch.Name,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(3 * time.Hour)), // exp
			IssuedAt:  jwt.NewNumericDate(time.Now()),                    // iat
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(os.Getenv("ACCESS_SECRET")))
}
