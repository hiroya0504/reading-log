-- Users exist in the database from day one even though the MVP only authenticates a single
-- local account over HTTP Basic. Retrofitting a user_id FK onto existing rows later would be a
-- destructive migration, so the ownership column is here from the start. See
-- docs/architecture.md#認証basic差し替え可能な形で.
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    username      VARCHAR(64)  NOT NULL UNIQUE,
    password_hash VARCHAR(72)  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Local development account: dev / dev (BCrypt, strength 10).
-- Never reuse this row outside local development.
INSERT INTO users (username, password_hash) VALUES
    ('dev', '$2y$10$/0SSCAi3O0WLTcPOqOVXtuz7NPBvjInBBgCs3TMhc1qb3kIbxX4e2');

CREATE TABLE books (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    author       VARCHAR(255),
    isbn         VARCHAR(20),
    total_pages  INTEGER,
    current_page INTEGER      NOT NULL DEFAULT 0,
    status       VARCHAR(20)  NOT NULL DEFAULT 'WANT_TO_READ',
    rating       SMALLINT,
    note         TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT books_status_check
        CHECK (status IN ('WANT_TO_READ', 'READING', 'DONE')),
    CONSTRAINT books_rating_check
        CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
    CONSTRAINT books_current_page_check
        CHECK (current_page >= 0),
    CONSTRAINT books_total_pages_check
        CHECK (total_pages IS NULL OR total_pages > 0)
);

-- The list screen always filters by owner and orders by recency.
CREATE INDEX books_user_id_created_at_idx ON books (user_id, created_at DESC);
