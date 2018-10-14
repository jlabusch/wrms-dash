.PHONY: config deps build start stop clean

DOCKER=docker
CONFIG_VOL=wrms-dash-config-vol
BUILD=$(shell ls ./wrms-dash-build-funcs/build.sh 2>/dev/null || ls ../wrms-dash-build-funcs/build.sh 2>/dev/null)
SHELL:=/bin/bash

deps:
	@test -n "$(BUILD)" || (echo 'wrms-dash-build-funcs not found; do you need "git submodule update --init"?'; false)
	@echo "Using $(BUILD)"

config: deps
	@$(BUILD) volume create $(CONFIG_VOL)
	@$(BUILD) image pull-if-not-exists alpine
	@for i in config/*; do \
        $(BUILD) cp alpine $$PWD/config $(CONFIG_VOL) /vol0/$$(basename $$i) /vol1/; \
    done

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
	$(BUILD) volume delete $(CONFIG_VOL) || :
	make -C wrms-dash-nginx $@ || :
	make -C wrms-dash-api $@ || :
	make -C wrms-dash-sync $@ || :
	make -C wrms-dash-frontend $@ || :
	make -C wrms-dash-frontend-db $@ || :

