# sintr: the canonical developer interface. Run `make help` for the list.

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

# Every target sees the configuration in .env (created on first use).
-include .env
export

export NEXT_TELEMETRY_DISABLED := 1

PNPM ?= pnpm
PNPM_VERSION := 11.20.0
# One dev database per checkout (worktrees run side by side), named after its path.
DEV_PROJECT ?= sintr-dev-$(shell printf '%s' "$(CURDIR)" | cksum | cut -d' ' -f1)
COMPOSE_DEV := docker compose -p $(DEV_PROJECT) -f docker/compose.dev.yaml --env-file .env
COMPOSE := docker compose -f docker/compose.yaml $(if $(SINTR_DOCKER_SUBNET),-f docker/compose.subnet.yaml) --env-file .env
# CI passes --with-deps to also install the browser's system libraries.
PLAYWRIGHT_INSTALL_FLAGS ?=

.PHONY: help setup dev test lint typecheck build migrate db-generate report-assets selfhost-up selfhost-down db-up db-down

help: ## List the targets
	@grep -hE '^[a-z-]+:.*## ' Makefile | awk -F ':.*## ' '{printf "  make %-14s %s\n", $$1, $$2}'

.env: .env.example
	@sh scripts/init-env.sh
	@touch .env

setup: .env ## Install dependencies, create .env with fresh secrets, fetch the test browser
	@command -v $(PNPM) >/dev/null || npm install --global pnpm@$(PNPM_VERSION)
	$(PNPM) install --frozen-lockfile
	$(PNPM) --filter @sintr/web exec playwright install chromium $(PLAYWRIGHT_INSTALL_FLAGS)

db-up: .env ## Start the development database
	$(COMPOSE_DEV) up -d --wait db

db-down: ## Stop the development database (data is kept)
	$(COMPOSE_DEV) down

migrate: db-up ## Apply database migrations to the development database
	$(PNPM) --filter @sintr/core db:migrate

db-generate: ## Write a new SQL migration after a schema change (name it with NAME=...)
	$(PNPM) --filter @sintr/core db:generate --name $(or $(NAME),change)

report-assets: ## Re-embed the report's fonts and light after changing them (LIGHT=1 renders the light again)
	node scripts/report-assets.mjs $(if $(LIGHT),--light)

dev: migrate ## Run the web app and the worker against the development database
	$(PNPM) --parallel --filter @sintr/web --filter @sintr/worker dev

test: db-up ## Unit, integration and end-to-end tests (real Postgres, offline assistant)
	$(PNPM) --filter @sintr/core test
	$(PNPM) --filter @sintr/agent test
	$(PNPM) --filter @sintr/worker test
	$(PNPM) --filter @sintr/web test

lint: ## ESLint, Prettier and the copy rules (no dashes, no emoji)
	$(PNPM) exec eslint . --max-warnings 0
	$(PNPM) exec prettier --check .
	node scripts/check-copy.mjs

typecheck: ## TypeScript, strict, in every package
	$(PNPM) -r typecheck

build: ## Build the web app and the worker
	$(PNPM) -r build

selfhost-up: .env ## Build and start the self-host stack (Caddy, app, worker, Postgres)
	$(COMPOSE) up -d --build --wait
	@echo "sintr is running at $(SINTR_URL)"

selfhost-down: ## Stop the self-host stack (data volumes are kept)
	$(COMPOSE) down
