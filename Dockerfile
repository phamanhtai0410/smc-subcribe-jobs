FROM 968557029040.dkr.ecr.ap-southeast-1.amazonaws.com/node:16-alpine as base

USER root
WORKDIR /webapps
COPY package*.json ./
RUN npm install && \
    npm install -g pm2
COPY . /webapps

ENV NODE_ENV production
