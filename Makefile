.PHONY: setup dev build test test-e2e lint typecheck format \
        db-migrate db-seed db-reset db-studio \
        docker-up docker-down docker-logs clean security

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------

setup: ## Install deps, start infra, run migrations, seed
	@echo "==> Checking prerequisites..."
	@command -v node >/dev/null 2>&1 || (echo "ERROR: node is required (>=20)" && exit 1)
	@command -v pnpm >/dev/null 2>&1 || (echo "ERROR: pnpm is required (>=9). Run: npm i -g pnpm" && exit 1)
	@command -v docker >/dev/null 2>&1 || (echo "ERROR: docker is required" && exit 1)
	@echo "==> Copying .env.example → .env (if .env doesn't exist)..."
	@test -f .env || cp .env.example .env
	@echo "==> Installing dependencies..."
	pnpm install
	@echo "==> Starting infrastructure (Postgres, Redis, Mailhog)..."
	$(MAKE) docker-up
	@echo "==> Waiting for Postgres to be ready..."
	@until docker compose exec -T postgres pg_isready -U efd_user -d efd_dev >/dev/null 2>&1; do sleep 1; done
	@echo "==> Running database migrations..."
	$(MAKE) db-migrate-deploy
	@echo "==> Generating Prisma client..."
	pnpm --filter @repo/db db:generate
	@echo "==> Seeding database..."
	$(MAKE) db-seed
	@echo ""
	@echo "✓ Setup complete. Run 'make dev' to start."

# ---------------------------------------------------------------------------
# Development
# ---------------------------------------------------------------------------

dev: ## Start all services in development mode
	pnpm turbo dev

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

build: ## Build all packages and apps
	pnpm turbo build

# ---------------------------------------------------------------------------
# Code quality
# ---------------------------------------------------------------------------

lint: ## Run ESLint across all workspaces
	pnpm turbo lint

lint-fix: ## Run ESLint with auto-fix
	pnpm turbo lint:fix

typecheck: ## Run TypeScript type checking
	pnpm turbo typecheck

format: ## Format all files with Prettier
	pnpm format

format-check: ## Check formatting without writing
	pnpm format:check

# ---------------------------------------------------------------------------
# Testing
# ---------------------------------------------------------------------------

test: ## Run unit tests
	pnpm turbo test

test-e2e: ## Run Playwright end-to-end tests
	pnpm turbo test:e2e

test-coverage: ## Run tests with coverage report
	pnpm turbo test -- --coverage

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

db-migrate: ## Run pending Prisma migrations
	pnpm --filter @repo/db db:migrate

db-migrate-deploy: ## Apply migrations in production (no prompts)
	pnpm --filter @repo/db db:migrate:deploy

db-generate: ## Regenerate Prisma client after schema changes
	pnpm --filter @repo/db db:generate

db-seed: ## Seed the database with development data
	pnpm --filter @repo/db db:seed

db-reset: ## Drop and recreate the database, run migrations, seed
	pnpm --filter @repo/db db:reset

db-studio: ## Open Prisma Studio
	pnpm --filter @repo/db db:studio

# ---------------------------------------------------------------------------
# Docker
# ---------------------------------------------------------------------------

docker-up: ## Start Docker Compose services
	docker compose up -d

docker-down: ## Stop Docker Compose services
	docker compose down

docker-logs: ## Tail Docker Compose logs
	docker compose logs -f

# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------

security: ## Run all security checks (audit + semgrep + gitleaks)
	@echo "==> npm audit..."
	pnpm audit --audit-level=high
	@echo "==> Semgrep..."
	@command -v semgrep >/dev/null 2>&1 && semgrep --config=p/typescript --config=p/owasp-top-ten . || echo "SKIP: semgrep not installed"
	@echo "==> Gitleaks..."
	@command -v gitleaks >/dev/null 2>&1 && gitleaks detect --source . || echo "SKIP: gitleaks not installed"
	@echo "Security checks complete."

# ---------------------------------------------------------------------------
# Clean
# ---------------------------------------------------------------------------

clean: ## Remove all build artifacts and node_modules
	pnpm clean
	docker compose down -v

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
