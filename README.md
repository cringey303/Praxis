# Praxis

A students-first social network where students discover and collaborate on projects; creating real work rather than focusing on connections.

## Quickstart (Luke this for u)
Get Praxis ready to develop and run locally.

### 1. Prerequisites
- Docker Desktop (Must be running for the database)
- Rust (`rustup update`)
- Node.js & npm

### 2. Start Database
The database runs in a Docker container.

In the root folder:
```bash
docker compose up -d
```

### 3. Start Backend (API)
The Rust server runs on port 8080.

Go into the backend
```bash
cd apps/api
```

create .env if missing
```bash
echo "DATABASE_URL=postgres://postgres:password@localhost:5432/praxis_db" > .env
```

run the server
```bash
cargo run
```

### 4. Start Frontend (Web)
The Next.js app runs on port 3000.

Open a new terminal tab
```bash
cd apps/web
npm install
npm run dev
```

### 5. Testing
Praxis should be ready and running.

Navigate to
[http://localhost:3000](http://localhost:3000)
and you should see the Praxis homepage.

# Architecture

This is a Monorepo containing:

`apps/api`: Backend (Rust / Axum / SQLx).

`src/main.rs`: Entry point & Router.

`src/auth.rs`: User signup & login logic.

`migrations/`: SQL files for the database schema.

`apps/web`: The Frontend (Next.js / TypeScript / Tailwind).

`src/app/`: The pages and routes.

# Useful Commands

Reset Database: `docker compose down -v` (Deletes all data)

Run Migrations: `cd apps/api && sqlx migrate run`

Create Migration: `cd apps/api && sqlx migrate add name_of_change`


# Current Status
```
[x] Database Running (Postgres)

[x] Backend Hello World

[x] Frontend Fetching Data

[x] Backend Auth: POST /auth/signup is implemented.

[ ] Frontend Auth: Need to build the Sign Up form in apps/web.
```

# TO-DO
```
a lot 😢
```
