--  init/db/00-setup.sql
--  Creating user and database for Hasura metadata
CREATE USER hasura WITH PASSWORD 'postgres';
CREATE DATABASE hasura_metadata;
GRANT ALL PRIVILEGES ON DATABASE hasura_metadata TO hasura;

--  Creating user and database for Keycloak
CREATE USER keycloak WITH PASSWORD 'password';
CREATE DATABASE keycloak_db;
GRANT ALL PRIVILEGES ON DATABASE keycloak_db TO keycloak;