-- Cover image found through the book search (Google Books). The image itself stays on Google's
-- servers; only its URL is kept. NULL means no cover, and the frontend draws one from the title.
ALTER TABLE books ADD COLUMN cover_url VARCHAR(500);
