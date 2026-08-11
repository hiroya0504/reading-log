.PHONY: setup dev backend frontend db-up db-down \
        check lint lint-backend lint-frontend \
        test test-backend test-frontend \
        build build-backend build-frontend \
        openapi openapi-check format clean help

# The single source of truth for every command in this repository. CI calls these targets rather
# than repeating the underlying tool invocations, so `make check` and CI cannot drift apart.

OPENAPI_ARTIFACTS := docs/openapi.json frontend/src/lib/api/schema.d.ts

# --- Setup ---

setup: ## Install dependencies, install git hooks, start the database
	@echo "==> Installing root tooling (lefthook)"
	pnpm install
	@echo "==> Installing frontend dependencies"
	cd frontend && pnpm install
	@echo "==> Installing git hooks"
	pnpm exec lefthook install
	@test -f .git/hooks/pre-commit \
		|| { echo "lefthook install did not create .git/hooks/pre-commit"; exit 1; }
	@echo "==> Starting PostgreSQL"
	docker compose up -d postgres
	@echo "==> Waiting for PostgreSQL to be healthy"
	@until docker compose exec -T postgres pg_isready -U reading -d reading_log >/dev/null 2>&1; do sleep 1; done
	@echo "==> Ready. Next: make dev"

# --- Dev ---

dev: ## Run backend and frontend in parallel
	@$(MAKE) -j2 backend frontend

backend: ## Run the backend (requires PostgreSQL to be up)
	cd backend && ./gradlew bootRun

frontend: ## Run the frontend dev server
	cd frontend && pnpm dev

db-up: ## Start PostgreSQL
	docker compose up -d postgres

db-down: ## Stop PostgreSQL
	docker compose down

# No `migrate` target on purpose: Flyway runs at application startup, so `make dev` (or the
# Testcontainers suite) applies migrations. A separate target would need the Flyway Gradle
# plugin and would be one more thing that can rot unnoticed.

# --- Check (this is exactly what CI runs) ---

check: lint test build openapi-check ## Everything CI runs

lint: lint-backend lint-frontend ## Run all linters

lint-backend: ## Spotless (google-java-format) check
	cd backend && ./gradlew spotlessCheck

lint-frontend: ## ESLint + Prettier + tsc
	cd frontend && pnpm lint && pnpm format:check && pnpm typecheck

test: test-backend test-frontend ## Run all tests

test-backend: ## Backend tests (requires Docker for Testcontainers)
	cd backend && ./gradlew test

test-frontend: ## Frontend tests
	cd frontend && pnpm test

build: build-backend build-frontend ## Produce both build artifacts

build-backend:
	cd backend && ./gradlew bootJar

build-frontend:
	cd frontend && pnpm build

# --- API contract ---

openapi: ## Regenerate the API contract and the frontend types from it
	@echo "==> Regenerating docs/openapi.json from the running application"
	cd backend && ./gradlew test --tests '*OpenApiSnapshotTest' -Popenapi.update=true
	@echo "==> Regenerating frontend/src/lib/api/schema.d.ts"
	cd frontend && pnpm gen:api

openapi-check: ## Fail if the committed contract artifacts are stale
	@# The backend half is covered by OpenApiSnapshotTest during `make test`: it fails when the
	@# code no longer matches docs/openapi.json. What is left to verify is that the generated
	@# frontend types were regenerated and committed alongside it.
	cd frontend && pnpm gen:api
	@if [ -n "$$(git status --porcelain -- $(OPENAPI_ARTIFACTS))" ]; then \
		echo ""; \
		echo "API contract artifacts are out of date:"; \
		git status --porcelain -- $(OPENAPI_ARTIFACTS); \
		echo ""; \
		echo "Run 'make openapi' and commit the result."; \
		exit 1; \
	fi
	@echo "==> API contract artifacts are up to date"

# --- Formatting ---

format: ## Auto-format backend and frontend
	cd backend && ./gradlew spotlessApply
	cd frontend && pnpm format && pnpm lint:fix

# --- Misc ---

clean: ## Remove build outputs
	cd backend && ./gradlew clean
	cd frontend && rm -rf .next node_modules/.cache

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
