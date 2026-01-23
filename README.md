# Praxis
(WIP)

A students-first social network where students discover and collaborate on projects; creating real work rather than focusing on connections.

Created by Lucas Root and Luke Coffman.

Here is the 
[figma](https://www.figma.com/design/z9Tf6F6dxn4S84Cd3mWeif/Praxis-Flowchart?node-id=0-1&m=dev&t=drysAnHQDYuItSh1-1)

[stitch with google](https://stitch.withgoogle.com/projects/2144734098224224255)

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

Run migrations
```bash
# Install sqlx-cli if you haven't (takes a minute)
cargo install sqlx-cli

# Run migrations
cd apps/api
sqlx migrate run
```

### 3. Start Backend (API)
The Rust server runs on port 8080.

Go into the backend
```bash
cd apps/api
```

create .env if missing
```bash
echo "DATABASE_URL=postgres://postgres:password@localhost:5432/praxis_db\nGOOGLE_CLIENT_ID=your_client_id_here\nGOOGLE_CLIENT_SECRET=your_client_secret_here\nGOOGLE_REDIRECT_URL=http://localhost:8080/auth/google/callback\nFRONTEND_URL=http://localhost:3000" > .env
```

replace placeholders (get keys from Lucas or setup your own in Google Cloud Console)
```bash
# apps/api/.env
DATABASE_URL=postgres://postgres:password@localhost:5432/praxis_db
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URL=http://localhost:8080/auth/google/callback
FRONTEND_URL=http://localhost:3000
```

create .env.local if missing
```bash
# apps/web/
echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local
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

Go to
[http://localhost:3000](http://localhost:3000)
and you should see the Praxis homepage.

# Useful Commands

Reset Database: `docker compose down -v` (Deletes all data)

Run Migrations: `cd apps/api && sqlx migrate run`

Create Migration: `cd apps/api && sqlx migrate add name_of_change`

# TO-DO
Not comprehensive.
```
- Create flowchart (Figma)
- Create mockup UI (Excalidraw)
- Design home/landing page
- GitHub login support
```

# Possible Domains
- joinpraxis.net
- joinpraxis.xyz
- joinpraxis.site
- praxs.org
- getpraxis.me
[https://www.spaceship.com/domain-search/?query=praxis&beast=false&tab=domains](https://www.spaceship.com/domain-search/?query=praxis&beast=false&tab=domains)
