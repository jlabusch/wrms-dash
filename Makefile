.PHONY: config build start stop clean

DOCKER=docker
CONFIG_VOL=wrms-dash-config-vol

config:
	$(DOCKER) volume ls | grep -q $(CONFIG_VOL) || $(DOCKER) volume create $(CONFIG_VOL)
	$(DOCKER) images | grep -q alpine || $(DOCKER) pull alpine
	CONTAINER=$$($(DOCKER) run -d -t -e TERM=xterm --rm -v $(CONFIG_VOL):/opt/ alpine top) && \
    for i in config/*; do $(DOCKER) cp $$i $$CONTAINER:/opt/; done && \
    $(DOCKER) stop $$CONTAINER

build: config
	make -C wrms-dash-api $@
	make -C wrms-dash-sync $@
	make -C wrms-dash-frontend $@
	make -C wrms-dash-nginx $@

start:
	make -C wrms-dash-api $@
	make -C wrms-dash-sync $@
	make -C wrms-dash-frontend $@
	make -C wrms-dash-nginx $@

stop:
	make -C wrms-dash-nginx $@ || :
	make -C wrms-dash-frontend $@ || :
	make -C wrms-dash-sync $@ || :
	make -C wrms-dash-api $@ || :

clean:
	$(DOCKER) volume rm $(CONFIG_VOL) || :
	make -C wrms-dash-nginx $@
	make -C wrms-dash-frontend $@
	make -C wrms-dash-sync $@
	make -C wrms-dash-api $@

