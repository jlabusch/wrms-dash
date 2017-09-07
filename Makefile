.PHONY: run

COMPOSE=docker-compose
DOCKER=docker

build:
	$(COMPOSE) build

frontend/db.sqlite3:
	CONTAINER=$$($(DOCKER) run -d -t -e TERM=xterm --rm jlabusch/wrms-dash-frontend top) && \
    $(DOCKER) cp $$CONTAINER:/opt/db.sqlite3 ./frontend/ && \
    $(DOCKER) stop $$CONTAINER

#ssl/key.pem:
#	openssl req -x509 -nodes -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365

run: build frontend/db.sqlite3
	$(COMPOSE) up -d; $(COMPOSE) logs -f

restart:
	$(COMPOSE) down; sleep 3; make run

