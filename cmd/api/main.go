package main

import (
	"log"

	"github.com/FelippeRibeiro/tickets-hub/internal/server"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Fatal("Error loading .env file")
	}

	server.Server()
}
