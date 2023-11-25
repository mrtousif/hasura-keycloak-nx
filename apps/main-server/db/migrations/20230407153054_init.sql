-- migrate:up
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;

CREATE OR REPLACE FUNCTION update_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   IF row(NEW.*) IS DISTINCT FROM row(OLD.*) THEN
      NEW.updated_at = now(); 
      RETURN NEW;
   ELSE
      RETURN OLD;
   END IF;
END;
$$ language 'plpgsql';


CREATE TABLE users (
  id uuid DEFAULT gen_random_uuid(),
  auth_id uuid UNIQUE NOT NULL,
  email CITEXT UNIQUE NOT NULL,
  phone varchar,
  name varchar NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT users_id_pk PRIMARY KEY (id)
);

CREATE TABLE posts (
  id uuid DEFAULT gen_random_uuid(),
  title varchar NOT NULL constraint title_length check (char_length(title) <= 100),
  content text,
  published boolean DEFAULT FALSE,
  author uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT videos_id_pk PRIMARY KEY (id),
  CONSTRAINT author_id_fk FOREIGN KEY (author) REFERENCES users(id) ON UPDATE CASCADE
);

CREATE TRIGGER set_updated_at
BEFORE
UPDATE ON users
FOR EACH ROW
EXECUTE PROCEDURE update_at_timestamp();

CREATE TRIGGER set_updated_at
BEFORE
UPDATE ON posts
FOR EACH ROW
EXECUTE PROCEDURE update_at_timestamp();

-- migrate:down
DROP TABLE posts;
DROP TABLE users;

DROP FUNCTION update_at_timestamp;
