.PHONY: dev dev-api dev-web db stop

# Start everything: database, API, and frontend
dev: db
	@echo "Starting API and frontend..."
	@cd apps/api && cargo run --bin api &
	@cd apps/web && npm run dev &
	@wait

# Start only the database
db:
	docker compose up -d

# Start only the API (starts db if needed)
dev-api: db
	cd apps/api && cargo run --bin api

# Start only the frontend (starts db if needed)
dev-web: db
	cd apps/web && npm run dev

# Stop everything
stop:
	docker compose down
