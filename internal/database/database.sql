CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY ,
    name TEXT  NOT NULL,
    email TEXT NOT NULL UNIQUE,
    is_admin BOOLEAN,
    password TEXT  NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
    id SERIAL PRIMARY KEY ,
    name TEXT
);


-- CREATE TYPE ticketStatus AS ENUM ("created","cancelled");
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY ,
    title TEXT,
    description TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    user_id int,
    topic_id int,

    CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_topic
        FOREIGN KEY (topic_id)
        REFERENCES topics(id)
        ON DELETE SET NULL
);


-- Testes
-- INSERT INTO users (name, email, is_admin, password) VALUES ('Felipe Ribeiro','felipper43@gmail.com',true,123456);