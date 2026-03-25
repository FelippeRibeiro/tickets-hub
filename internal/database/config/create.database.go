package main

import (
	"fmt"
	"log"
	"os"

	"github.com/FelippeRibeiro/tickets-hub/internal/database"
	"github.com/joho/godotenv"
)

func main()  {
	if err := godotenv.Load(); err != nil {
		log.Fatal("Error loading .env file")
	}
	db, err := database.NewDB()

	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}


	content, err := os.ReadFile(
		"./internal/database/database.sql",
	)
	if err != nil {
		log.Fatalf("Failed to read database.sql file: %v", err)
	}

	_, err = db.Exec(string(content))
	if err != nil {
		log.Fatalf("Failed to execute database.sql file: %v", err)
	}

	fmt.Println("Database created successfully")
	

	defer db.Close()


	
}