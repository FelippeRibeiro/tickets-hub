package model

import "time"

type Comment struct {
	CommentId int       `json:"id" db:"id"`
	Comment   string    `json:"comment" db:"comment"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UserId    int       `json:"user_id" db:"user_id"`
	TicketId  int       `json:"ticket_id" db:"ticket_id"`
	IsAnonymous bool    `json:"is_anonymous" db:"is_anonymous"`
}

type CommentWithUserName struct {
	CommentId int       `json:"id" db:"id"`
	Comment   string    `json:"comment" db:"comment"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UserId    int       `json:"user_id" db:"user_id"`
	TicketId  int       `json:"ticket_id" db:"ticket_id"`
	UserName      string    `json:"user_name" db:"user_name"`
	UserHasAvatar bool      `json:"user_has_avatar" db:"user_has_avatar"`
	IsAnonymous bool    `json:"is_anonymous" db:"is_anonymous"`
	ParentCommentID *int  `json:"parent_comment_id,omitempty" db:"parent_comment_id"`
	ParentUserName  string `json:"parent_user_name,omitempty" db:"parent_user_name"`
	LikesCount      int    `json:"likes_count" db:"likes_count"`
	Liked           bool   `json:"liked" db:"liked"`
	IsOwner     bool        `json:"is_owner" db:"-"`
	Attachments []TicketAttachment `json:"attachments,omitempty" db:"-"`
}

type CreateComment struct {
	Comment  string `json:"comment" db:"comment"`
	TicketId int    `json:"ticket_id" db:"ticket_id"`
	IsAnonymous bool    `json:"is_anonymous" db:"is_anonymous"`
	ParentCommentID *int `json:"parent_comment_id,omitempty" db:"parent_comment_id"`
}

// CommentLikeSummary is the like count and whether the viewer liked the comment.
type CommentLikeSummary struct {
	Count int  `json:"count" db:"count"`
	Liked bool `json:"liked" db:"liked"`
}

// CommentWithTicketContext is a comment with ticket/topic labels for the activity feed.
type CommentWithTicketContext struct {
	CommentId       int       `json:"id" db:"id"`
	Comment         string    `json:"comment" db:"comment"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UserId          int       `json:"user_id" db:"user_id"`
	TicketId        int       `json:"ticket_id" db:"ticket_id"`
	UserName        string    `json:"user_name" db:"user_name"`
	UserHasAvatar   bool      `json:"user_has_avatar" db:"user_has_avatar"`
	IsAnonymous     bool      `json:"is_anonymous" db:"is_anonymous"`
	ParentCommentID *int      `json:"parent_comment_id,omitempty" db:"parent_comment_id"`
	ParentUserName  string    `json:"parent_user_name,omitempty" db:"parent_user_name"`
	LikesCount      int       `json:"likes_count" db:"likes_count"`
	Liked           bool      `json:"liked" db:"liked"`
	TicketTitle     string    `json:"ticket_title" db:"ticket_title"`
	TopicName       string    `json:"topic_name" db:"topic_name"`
	IsOwner         bool      `json:"is_owner" db:"-"`
	Attachments     []TicketAttachment `json:"attachments,omitempty" db:"-"`
}
