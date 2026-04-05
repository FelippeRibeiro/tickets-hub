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
	"github.com/FelippeRibeiro/tickets-hub/internal/server/middlewares"
	"github.com/FelippeRibeiro/tickets-hub/internal/server/realtime"
)

func Server() {
	db, err := database.NewDB()
	if err != nil {
		panic(err)
	}
	defer db.Close()
	middlewares.SetDB(db)

	uploadRoot := os.Getenv("UPLOAD_DIR")
	if uploadRoot == "" {
		uploadRoot = "./data/uploads"
	}
	if err := os.MkdirAll(uploadRoot, 0o755); err != nil {
		panic(err)
	}

	server := http.NewServeMux()

	server.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	})

	userRepository := repository.NewUserRepository(db)
	topicRepository := repository.NewTopicRepository(db)
	ticketRepository := repository.NewTicketRepository(db)
	commentRepository := repository.NewCommentRepository(db)
	commentLikeRepository := repository.NewCommentLikeRepository(db)
	likeRepository := repository.NewLikeRepository(db)
	attachmentRepository := repository.NewAttachmentRepository(db)
	commentAttachmentRepository := repository.NewCommentAttachmentRepository(db)
	notificationRepository := repository.NewNotificationRepository(db)
	hub := realtime.NewHub()

	userController := controller.NewUserController(userRepository)
	topicController := controller.NewTopicController(topicRepository)
	ticketController := controller.NewTicketController(ticketRepository, topicRepository, attachmentRepository, uploadRoot, hub)
	commentController := controller.NewCommentController(commentRepository, ticketRepository, commentAttachmentRepository, notificationRepository, hub, uploadRoot)
	commentLikeController := controller.NewCommentLikeController(commentLikeRepository, commentRepository, notificationRepository, hub)
	likeController := controller.NewLikeController(likeRepository, ticketRepository, notificationRepository, hub)
	attachmentController := controller.NewAttachmentController(ticketRepository, attachmentRepository, commentAttachmentRepository, uploadRoot)
	notificationController := controller.NewNotificationController(notificationRepository, hub)
	linkPreviewController := controller.NewLinkPreviewController()

	topicController.SetupRoutes(server)
	userController.SetupRoutes(server)
	ticketController.SetupRoutes(server)
	attachmentController.SetupRoutes(server)
	commentController.SetupRoutes(server)
	commentLikeController.SetupRoutes(server)
	likeController.SetupRoutes(server)
	notificationController.SetupRoutes(server)
	linkPreviewController.SetupRoutes(server)

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

	fmt.Println("Listening on port 8080")
	if err := http.ListenAndServe(":8080", server); err != nil {
		panic(err)
	}

}
