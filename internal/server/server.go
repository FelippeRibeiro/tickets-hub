package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

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

	staticDir := "./frontend/dist"
	server.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(staticDir, r.URL.Path)
		fi, err := os.Stat(path)

		if os.IsNotExist(err) || fi.IsDir() {
			http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
			return
		}
		http.FileServer(http.Dir(staticDir)).ServeHTTP(w, r)
	})

	server.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	})

	userRepository := repository.NewUserRepository(db)
	topicRepository := repository.NewTopicRepository(db)
	ticketRepository := repository.NewTicketRepository(db)
	commentRepository := repository.NewCommentRepository(db)

	userController := controller.NewUserController(userRepository)
	topicController := controller.NewTopicController(topicRepository)
	ticketController := controller.NewTicketController(ticketRepository, topicRepository)
	commentController := controller.NewCommentController(commentRepository, ticketRepository)

	topicController.SetupRoutes(server)
	userController.SetupRoutes(server)
	ticketController.SetupRoutes(server)
	commentController.SetupRoutes(server)

	fmt.Println("Listening on port 8080")
	if err := http.ListenAndServe(":8080", server); err != nil {
		panic(err)
	}

}
