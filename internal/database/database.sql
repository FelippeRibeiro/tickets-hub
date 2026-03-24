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

    user_id INT,
    topic_id INT NOT NULL,

    CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_topic
        FOREIGN KEY (topic_id)
        REFERENCES topics(id)
        ON DELETE CASCADE
);

ALTER TABLE  users ADD CONSTRAINT check_name CHECK ( name != '' );
ALTER TABLE  users ADD CONSTRAINT check_email CHECK ( email != '' );

INSERT INTO topics (name) VALUES ('Outros');

CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    user_id INT,
    ticket_id INT NOT NULL,

    CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_ticket
        FOREIGN KEY (ticket_id)
        REFERENCES tickets(id)
        ON DELETE CASCADE

);

CREATE TABLE IF NOT EXISTS ticket_likes (
    user_id INT NOT NULL,
    ticket_id INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),


    PRIMARY KEY (user_id, ticket_id),

    CONSTRAINT fk_user_like
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ticket_like
        FOREIGN KEY (ticket_id)
        REFERENCES tickets(id)
        ON DELETE CASCADE
);


-- DELETE FROM users WHERE name = '';
-- DELETE FROM users WHERE email = '';
-- Testes
-- INSERT INTO users (name, email, is_admin, password) VALUES ('Felipe Ribeiro','felipper433@gmail.com',true,123456);


-- SELECT  t.*,u.name as user_name,tp.name as topic_name FROM tickets t
--     INNER JOIN users u on t.user_id = u.id
--     INNER JOIN topics tp on tp.id = topic_id
--     ORDER BY created_at DESC;