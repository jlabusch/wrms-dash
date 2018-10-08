.PHONY: config build start stop clean

DOCKER=docker
CONFIG_VOL=wrms-dash-config-vol
IMAGES=wrms-dash-api \
       wrms-dash-sync \
       wrms-dash-frontend-db \
       wrms-dash-frontend \
       wrms-dash-nginx

config:
	$(DOCKER) volume ls | grep -q $(CONFIG_VOL) || $(DOCKER) volume create $(CONFIG_VOL)
	# Copy files from ./config into the config volume
	$(DOCKER) images | grep -q alpine || $(DOCKER) pull alpine
	CONTAINER=$$($(DOCKER) run -d -t -e TERM=xterm --rm -v $(CONFIG_VOL):/opt/ alpine top) && \
    for i in config/*; do $(DOCKER) cp $$i $$CONTAINER:/opt/; done && \
    $(DOCKER) stop $$CONTAINER

build: config
	@for i in $(IMAGES); do make -C $$i $@; done

start:
	@for i in $(IMAGES); do make -C $$i $@; done

stop:
	@for i in $(IMAGES); do make -C $$i $@ || :; done

clean:
	$(DOCKER) volume rm $(CONFIG_VOL) || :
	@for i in $(IMAGES); do make -C $$i $@ || :; done

