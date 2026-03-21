package main

import (
	""
	"encoding/json"
	"fmt"
	"net/http"
)

func main() {
	server := http.NewServeMux()
	//server.Handle("/", http.FileServer(http.Dir(".")))
	server.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Hello World"))
	})

	server.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	})

	fmt.Println("Listening on port 8080")
	http.ListenAndServe(":8080", server)

}
