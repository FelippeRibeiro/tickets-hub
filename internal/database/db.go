package database

import (
	"fmt"
	"os"

	_ "github.com/jackc/pgx/stdlib"
	"github.com/jmoiron/sqlx"
)

var DB *sqlx.DB = nil
func NewDB() (*sqlx.DB, error) {

	DB_USER := os.Getenv("DB_USER")
	DB_PASS := os.Getenv("DB_PASS")
	DB_HOST := os.Getenv("DB_HOST")
	DB_DATABASE := os.Getenv("DB_DATABASE")
	if DB_USER == "" || DB_PASS == "" || DB_HOST == "" {
		panic("DB_USER, DB_PASS, DB_HOST some environment variables not set")
	}

	db, err := sqlx.Connect("pgx", fmt.Sprintf("user=%s dbname=%s host=%s password=%s sslmode=disable", DB_USER, DB_DATABASE, DB_HOST, DB_PASS))
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(30)
	db.SetMaxIdleConns(10)
	DB = db
	return db, nil
}

func GetDB() *sqlx.DB {
	if DB == nil {
			panic("database not initialized")	
	}
	return DB
}
