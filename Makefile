
.PHONY: sync data-clean tree install lint format test dev-up dev-down migrate

sync:
	python3 scripts/sync_shared.py

data-clean:
	rm -rf data/web-app/*.json data/kiosk-app/*.json data/teacher-pwa/*.json

tree:
	@echo "Repository structure:"
	@find . -maxdepth 3 -type d | sed 's|^./||'

install:
	python -m pip install -e .[dev]

lint:
	ruff check app tests
	mypy app

format:
	black app tests

test:
	pytest

dev-up:
	docker compose -f infra/docker-compose.yml up --build

dev-down:
	docker compose -f infra/docker-compose.yml down

migrate:
	alembic upgrade head

seed:
	python scripts/dev_seed.py
