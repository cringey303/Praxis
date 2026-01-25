# Dev Setup

## Prerequisites
- Use nvm (Node installed in WSL, not Windows)
- Docker for PostgreSQL

## Start
```bash
docker compose up -d
cd apps/api && cargo run --bin api
cd apps/web && npm run dev
```

## Stop
```bash
# Stop servers with Ctrl+C
docker compose down
```

## Environment
- Backend `.env` is at `apps/api/.env`
- Frontend `.env.local` is at `apps/web/.env.local`
- Both are gitignored - each dev creates their own OAuth keys
