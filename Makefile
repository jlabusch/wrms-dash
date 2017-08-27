.PHONY: run

COMPOSE=docker-compose

build: ssl/key.pem
	$(COMPOSE) build

ssl/key.pem:
	openssl req -x509 -nodes -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365

run: build
	$(COMPOSE) up -d; $(COMPOSE) logs -f

restart:
	$(COMPOSE) down; sleep 3; make run

