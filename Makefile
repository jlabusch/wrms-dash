.PHONY: run

COMPOSE=docker-compose

build:
	$(COMPOSE) build

run: build
	$(COMPOSE) up -d; $(COMPOSE) logs -f

restart:
	$(COMPOSE) down; sleep 3; make run

