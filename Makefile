.PHONY: config deps build start stop clean

DOCKER=docker
BUILD=$(shell ls ./wrms-dash-build-funcs/build.sh 2>/dev/null || ls ../wrms-dash-build-funcs/build.sh 2>/dev/null)
SHELL:=/bin/bash

deps:
	@test -n "$(BUILD)" || (echo 'wrms-dash-build-funcs not found; do you need "git submodule update --init"?'; false)
	@echo "Using $(BUILD)"

config: deps
	@$(BUILD) image pull-if-not-exists alpine

build: config
	@for i in \
        wrms-dash-frontend-db \
        wrms-dash-frontend \
        wrms-dash-nginx \
        wrms-dash-api \
        wrms-dash-sync \
    ; do \
        make -C $$i $@; \
    done

start:
	@test -n "$$CONFIG" || (echo 'CONFIG not set, try "export CONFIG=`base64 < ./config/default.json`"'; false)
	@test -n "$$DB_PASS" || (echo 'DB_PASS not set - try "export DB_PASS=`cat ./wrms-dash-frontend-db/pgpass`"'; false)
	@for i in \
        wrms-dash-frontend-db \
        wrms-dash-api \
        wrms-dash-sync \
        wrms-dash-frontend \
        wrms-dash-nginx \
    ; do \
        make -C $$i $@; \
    done

stop:
	make -C wrms-dash-nginx $@ || :
	make -C wrms-dash-api $@ || :
	make -C wrms-dash-sync $@ || :
	make -C wrms-dash-frontend $@ || :
	make -C wrms-dash-frontend-db $@ || :

clean:
	make -C wrms-dash-nginx $@ || :
	make -C wrms-dash-api $@ || :
	make -C wrms-dash-sync $@ || :
	make -C wrms-dash-frontend $@ || :
	make -C wrms-dash-frontend-db $@ || :

