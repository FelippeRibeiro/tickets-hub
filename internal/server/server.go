package server

import (
	"encoding/json"
	"fmt"
	"net/http"

	"githubs.com/FelippeRibeiro/tickets-hub/internal/database"
	"githubs.com/FelippeRibeiro/tickets-hub/internal/repository"
	"githubs.com/FelippeRibeiro/tickets-hub/internal/server/controller"
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
	userController := controller.NewUserController(userRepository)
	userController.SetupRoutes(server)

	fmt.Println("Listening on port 8080")
	http.ListenAndServe(":8080", server)

}
