FROM node:8

WORKDIR /opt

COPY package.json /opt/

RUN npm install

COPY . /opt/

ENTRYPOINT ["npm"]
