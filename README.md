# Praxis
_**Please submit an issue if you find a bug!!**_


(WIP)

A students-first social network where students discover and collaborate on projects; creating real work rather than focusing on connections.

Created by Lucas Root, Luke Coffman and Owen Abbott.

Here is the 
[figma](https://www.figma.com/design/z9Tf6F6dxn4S84Cd3mWeif/Praxis-Flowchart?node-id=0-1&m=dev&t=drysAnHQDYuItSh1-1)

[stitch with google](https://stitch.withgoogle.com/projects/2144734098224224255)

## Quickstart
Get Praxis ready to develop and run locally.

### 1. Prerequisites
- Docker Desktop (Must be running for the database)
- Rust (`rustup update`)
- Node.js & npm
- Clone this repo

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
echo "DATABASE_URL=postgres://postgres:password@localhost:5432/praxis_db\nGOOGLE_CLIENT_ID=...\nGOOGLE_CLIENT_SECRET=...\nGOOGLE_REDIRECT_URL=http://localhost:3000/api/auth/google/callback\nGITHUB_CLIENT_ID=...\nGITHUB_CLIENT_SECRET=...\nGITHUB_REDIRECT_URL=http://localhost:3000/api/auth/github/callback\nFRONTEND_URL=http://localhost:3000" > .env
```

replace placeholders (get keys from Lucas or setup your own in Google Cloud Console / GitHub Developer Settings. Get R2 keys from Lucas)
```bash
# apps/api/.env
DATABASE_URL=postgres://postgres:password@localhost:5432/praxis_db
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URL=http://localhost:3000/api/auth/google/callback
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URL=http://localhost:3000/api/auth/github/callback
FRONTEND_URL=http://localhost:3000

# Cloudflare R2 (for image storage)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=praxis-uploads
R2_PUBLIC_URL=https://your-bucket.r2.dev
```

create .env.local if missing
```bash
# apps/web/
echo "NEXT_PUBLIC_API_URL=/api\nAPI_URL=http://localhost:8080" > .env.local
```

run the server
```bash
cargo run --bin api
```

### 4. Start Frontend (Web)
The Next.js app runs on port 3000.

Open a new terminal tab
```bash
cd apps/web
npm install

# Development (hot refresh)
npm run dev
```
```bash
# Production (faster/optimized, but no automatic refresh)
# You need to rebuild every code change
npm build
npm start
```

### 5. Testing
Praxis should be ready and running.

Go to
[http://localhost:3000](http://localhost:3000)
and you should see the Praxis homepage.

# Useful Commands
Make User Admin: `cd apps/api && cargo run --bin make_admin -- <username>`
(replace brackets as well)

Reset Database: `docker compose down -v` (Deletes all data)

Run Migrations: `cd apps/api && sqlx migrate run`

Create Migration: `cd apps/api && sqlx migrate add name_of_change`

## Production
Make User Admin (from your machine):
```bash
DATABASE_URL="<production_postgres_url>" cargo run --bin make_admin -- <username>
```
Get the production DATABASE_URL from Railway → Postgres service → Variables tab.

# TO-DO
Not comprehensive.
Submit an issue if you find a bug!
```
Known bugs:
- Image cropping and uploading
```
```
Other:
- Create flowchart (Figma)
- Create mockup UI (Excalidraw)
- Design home/landing page
- Email verification (needs domain for SMTP)
```

# Possible Domains
- joinpraxis.net
- joinpraxis.xyz
- joinpraxis.site
- praxs.org
- getpraxis.me
[https://www.spaceship.com/domain-search/?query=praxis&beast=false&tab=domains](https://www.spaceship.com/domain-search/?query=praxis&beast=false&tab=domains)
