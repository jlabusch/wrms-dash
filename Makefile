.PHONY: build start stop clean

DOCKER=docker
CONFIG_VOL=wrms-dash-config-vol

build:
	$(DOCKER) volume ls | grep -q $(STATIC_VOL) || $(DOCKER) volume create $(STATIC_VOL)
	$(DOCKER) images | grep -q alpine || $(DOCKER) pull alpine
	CONTAINER=$$($(DOCKER) run -d -t -e TERM=xterm --rm -v $(CONFIG_VOL):/opt/ alpine top) && \
    $(DOCKER) cp config/* $$CONTAINER:/opt/ && \
    $(DOCKER) stop $$CONTAINER

start:
	make -C wrms-dash-api build start
	make -C wrms-dash-sync build start
	make -C wrms-dash-frontend build start
	make -C wrms-dash-nginx build start

stop:
	make -C wrms-dash-nginx stop
	make -C wrms-dash-frontend stop
	make -C wrms-dash-sync stop
	make -C wrms-dash-api stop

clean:
	$(DOCKER) volume rm $(CONFIG_VOL)
	make -C wrms-dash-nginx clean
	make -C wrms-dash-frontend clean
	make -C wrms-dash-sync clean
	make -C wrms-dash-api clean

