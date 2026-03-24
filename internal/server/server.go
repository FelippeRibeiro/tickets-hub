package server

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/FelippeRibeiro/tickets-hub/internal/database"
	"github.com/FelippeRibeiro/tickets-hub/internal/repository"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/controller"
)

func Server() {
	db, err := database.NewDB()
	if err != nil {
		panic(err)
	}
	defer db.Close()
	server := http.NewServeMux()
	//server.Handle("/", http.FileServer(http.Dir(".")))

	server.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	})

	userRepository := repository.NewUserRepository(db)
	topicRepository := repository.NewTopicRepository(db)
	ticketRepository := repository.NewTicketRepository(db)

	userController := controller.NewUserController(userRepository)
	topicController := controller.NewTopicController(topicRepository)
	ticketController := controller.NewTicketController(ticketRepository, topicRepository)

	topicController.SetupRoutes(server)
	userController.SetupRoutes(server)
	ticketController.SetupRoutes(server)

	fmt.Println("Listening on port 8080")
	http.ListenAndServe(":8080", server)

}
