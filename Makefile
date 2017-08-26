.PHONY: app run

COMPOSE=docker-compose

test:
	make -C app

build:
	$(COMPOSE) build

run: build
	$(COMPOSE) up -d; $(COMPOSE) logs -f

restart:
	$(COMPOSE) down; sleep 3; make run

