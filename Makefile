.PHONY: app run

COMPOSE=docker-compose

test:
	make -C app

.htpasswd: SHELL:=/bin/bash
.htpasswd: app/config/default.json
	grep -E password.*/ app/config/default.json | perl ./htpasswd.pl

build: .htpasswd
	$(COMPOSE) build

run: build
	$(COMPOSE) up -d; $(COMPOSE) logs -f

restart:
	$(COMPOSE) down; sleep 3; $(COMPOSE) up -d; $(COMPOSE) logs -f

