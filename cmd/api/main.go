package main

import (
	"log"

	"github.com/joho/godotenv"
	"githubs.com/FelippeRibeiro/tickets-hub/internal/server"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Fatal("Error loading .env file")
	}

	server.Server()
}
