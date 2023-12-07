# Integrating Hasura and Keycloak with RBAC

---

[Hasura](https://hasura.io/) is an open-source real-time GraphQL API server with a strong authorization layer on your database. You can subscribe to database events via webhooks. It can combine multiple API servers into one unified graphQL API. Hasura is a great tool to build any CRUD GraphQL API. Hasura does not have any authentication mechanisms; e.g., you need an auth server to handle sign-up and sign-in.

[Keycloak](https://www.keycloak.org/) is an OpenID-compliant auth server.

Hasura will validate the JWT token passed in header. The JWT token will have necessary information to handle the authorization in Hasura. Hasura can’t perform the OAuth flow. For that we’ll need an app server to handle it. App server will initiate the Sign-up or sign-in process and pass the auth tokens to client. Client app will need to send the access token in header to Hasura to get access to the protected data.

In this tutorial, we’ll learn how to integrate Hasura and Keycloak with RBAC.

The code is available on Github

[GitHub - hasura-keycloak-nx](https://github.com/mrtousif/hasura-keycloak-nx)

## Setup

Let’s create a docker compose yaml file and paste the following code. You can also clone the repo, which contains all the code you need.

```yaml
#docker-compose.yml
version: '3'

volumes:
  postgres_data:
    driver: local

services:
  postgres:
    container_name: postgres
    image: postgres:15-alpine
    restart: unless-stopped
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init/db:/docker-entrypoint-initdb.d/
    command: postgres -c wal_level=logical
    ports:
      - '5433:5432'
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}

  hasura:
    container_name: hasura
    image: hasura/graphql-engine:v2.29.0
    restart: unless-stopped
    depends_on:
      - postgres
    #   - keycloak
    ports:
      - '6080:8080'
    volumes:
      - ./hasura/metadata:/hasura-metadata
    environment:
      ## postgres database to store Hasura metadata
      HASURA_GRAPHQL_METADATA_DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/hasura_metadata
      HASURA_GRAPHQL_DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      HASURA_GRAPHQL_LOG_LEVEL: warn
      ## enable the console served by server
      HASURA_GRAPHQL_ENABLE_CONSOLE: 'true' # set to "false" to disable console
      ## enable debugging mode. It is recommended to disable this in production
      HASURA_GRAPHQL_DEV_MODE: 'true'
      HASURA_GRAPHQL_ENABLED_LOG_TYPES: startup, http-log, webhook-log, websocket-log, query-log
      ## enable jwt secret when keycloak realm is ready
      # HASURA_GRAPHQL_JWT_SECRET: '{ "type": "RS256", "jwk_url": "http://keycloak:8080/realms/development/protocol/openid-connect/certs" }'
      HASURA_GRAPHQL_ADMIN_SECRET: ${HASURA_GRAPHQL_ADMIN_SECRET}
      HASURA_GRAPHQL_UNAUTHORIZED_ROLE: anonymous
      HASURA_GRAPHQL_ENABLE_REMOTE_SCHEMA_PERMISSIONS: 'true'
      HASURA_GRAPHQL_MIGRATIONS_SERVER_TIMEOUT: 30
  # To view tables in Postgres
  # pgweb:
  #   container_name: pgweb
  #   image: sosedoff/pgweb:latest
  #   restart: unless-stopped
  #   ports:
  #     - '8081:8081'
  #   environment:
  #     - DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?sslmode=disable
  #   depends_on:
  #     - postgres
  keycloak:
    container_name: keycloak
    image: quay.io/keycloak/keycloak:22.0.5
    command: ['start-dev']
    # Uncomment following if you want to import realm configuration on start up
    # command: ['start-dev', '--import-realm']
    environment:
      ## https://www.keycloak.org/server/all-config
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: password123
      KC_DB: postgres
      KC_DB_PASSWORD: postgres_pass
      KC_DB_USERNAME: postgres
      KC_DB_SCHEMA: public
      KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak_db
      KC_HOSTNAME: localhost
    ports:
      - 8090:8080
    depends_on:
      - postgres
    # Uncomment following if you want to import realm configuration on start up
    # volumes:
    #   - ./realm-export.json:/opt/keycloak/data/import/realm.json:ro
```

Let’s create an env file

```yaml
# .env.local
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_pass
POSTGRES_DB=my_app_db
HASURA_GRAPHQL_ADMIN_SECRET=secret
```

Let's create a SQL file for the initial Postgres configuration.

```sql
--  init/db/00-setup.sql
--  Creating user and database for Hasura metadata
CREATE USER hasura WITH PASSWORD 'postgres';
CREATE DATABASE hasura_metadata;
GRANT ALL PRIVILEGES ON DATABASE hasura_metadata TO hasura;

--  Creating user and database for Keycloak
CREATE USER keycloak WITH PASSWORD 'password';
CREATE DATABASE keycloak_db;
GRANT ALL PRIVILEGES ON DATABASE keycloak_db TO keycloak;
```

Lets start up the containers by running

```bash
docker-compose --env-file ./.env.development up
```

It will take some time for the initial start up

### Setup Hasura client in Keycloak

Open up the Keycloak admin console at [localhost:8090](http://localhost:8090)

Admin credential: admin / password123

Create a realm. Let’s name it `development`. You should not use the `master` realm, which is for managing Keycloak itself. Once you’ve created a realm, let’s set up hasura client in Keycloak.

![01.png](./screenshots/01.png)

Navigate to the **Clients** page and click on **Create client.**

Enter the client name (e.g. hasura) in **Client ID** field and click next

![02.png](./screenshots/02.png)

On the next page, enable **Client authentication** and click **Next**. You can also choose to enable implicit flow for easier authentication handling. You can modify this later

![03.png](./screenshots/03.png)

Provide a valid redirect URI and a post-logout URI and **Save**. I’ve entered the URL of our NestJS app running on [localhost:7000](http://localhost:7000).

![04.png](./screenshots/04.png)

### User Roles in Keycloak

Keycloak has two type of roles:

- Realm roles: All the clients share them
- Client roles: They are available only to the client for whom it was created

In this case, we will create client roles.

Navigate to the **Roles** tab of hasura client and click **Create Role** then create two roles: `user` and `admin`

![05.png](./screenshots/05.png)

### \***\*Create Mappers for Hasura JWT Claims\*\***

When Keycloak generates the JWT, the custom claims in the JWT **must contain the following** in a custom `https://hasura.io/jwt/claims` namespace

1. A `x-hasura-allowed-roles` field. A list of allowed roles for the user
2. A `x-hasura-default-role` field. The role that will be used when the optional `x-hasura-role` *header* is not passed.
3. Add any other optional `x-hasura-*` claim fields (required as per your defined permissions) to the custom namespace

Navigate to Clients → hasura → Client Scopes and click `hasura-dedicated`

![06.png](./screenshots/06.png)

Click on **Configure a new mapper** and select **User Property.**

Add the following values and save

| Name             | x-hasura-user-id                                 |
| ---------------- | ------------------------------------------------ |
| Property         | id                                               |
| Token Claim Name | `https://hasura\.io/jwt/claims.x-hasura-user-id` |

![07.png](./screenshots/07.png)

Add mapper for **User Attribute**

Add the followings and save.

| Name             | x-hasura-default-role                                 |
| ---------------- | ----------------------------------------------------- |
| User Attribute   | x-hasura-default-role                                 |
| Token Claim Name | `https://hasura\.io/jwt/claims.x-hasura-default-role` |
| Claim value      | user                                                  |

![08.png](./screenshots/08.png)

Add mapper for **User Client Role**

Add the followings and save.

| Name             | x-hasura-allowed-roles                                 |
| ---------------- | ------------------------------------------------------ |
| Client ID        | hasura                                                 |
| Token Claim Name | `https://hasura\.io/jwt/claims.x-hasura-allowed-roles` |

![09.png](./screenshots/09.png)

**Create groups**

Navigate to **Groups** tab and create two groups Admins & Users

![10.png](./screenshots/10.png)

**Add attributes to the Groups**

Group: Users

| Key                   | Value |
| --------------------- | ----- |
| x-hasura-default-role | user  |

Group: Admins

| Key                   | Value |
| --------------------- | ----- |
| x-hasura-default-role | admin |

![11.png](./screenshots/11.png)

**Assign Roles**

We need to assign the role we created at the beginning. Every member of this group will have that role

Group: **Users**

Click on Role mapping → Assign role → Filter by clients → `hasura user` → Assign

Group: **Admins**

Click on Role mapping → Assign role → Filter by clients → `hasura admin` → Assign

![12.png](./screenshots/12.png)

**Create user**

Navigate to the Users tab and create two users. One is an admin user, and another is a regular user.

Join the group `Admins` when creating an admin user and `Users` when creating regular user.

![13.png](./screenshots/13.png)

After user creation, set their password. You can do this by navigating to the **Credentials** tab of that user. You may turn off the **Temporary** option.

To make things easy to test, let’s increase the access token lifespan.

Navigate to **Relam settings** → Tokens → Access Token Lifespan → Enter 10 Hours → Save

![14.png](./screenshots/14.png)

Now set the `HASURA_GRAPHQL_JWT_SECRET` environment variable in the docker compose file for hasura with this

`'{ "type": "RS256", "jwk_url": "http://keycloak:8080/realms/development/protocol/openid-connect/certs" }'`

Hasura will get the public certificate from Keycloak.

## **Setup app login**

If you haven’t already, let's clone the repo and cd into `apps/backend_server` in your terminal.

[GitHub - tousifws/hasura-keycloak](https://github.com/tousifws/hasura-keycloak)

We’ll integrate keycloak with our NodeJS server to initiate the login. Lets grab the **Client secret** by navigating to **Clients** → **hasura** → **Credentials**

![15.png](./screenshots/15.png)

Set the copied client secret to `OPENID_CLIENT_REGISTRATION_LOGIN_CLIENT_SECRET` environment variable present in `.env.development.local`

Next, do `npx nx run main-server:dev`. It’ll start the NodeJS server using the beautiful NestJS framework. It’ll do the oAuth dance.

Open up [http://localhost:7000/auth/login](http://localhost:7000/auth/login) in your browser; it’ll redirect you to the Keycloak login page. Here you’ll need to enter the credentials of the users you created earlier.

Next, open up [http://localhost:7000/auth/user](http://localhost:7000/auth/user) You’ll get user information and associated tokens. You can use the access token in Hasura. Here’s a demo

{% embed https://youtu.be/l4lrjCC0Qes %}

## Acknowledgement

- [https://github.com/janhapke/hasura-keycloak](https://github.com/janhapke/hasura-keycloak)
- [https://youtu.be/h2SLNwAEQVE](https://youtu.be/h2SLNwAEQVE)
