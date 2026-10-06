# Development Dockerfile used with docker-compose
FROM node:24-alpine

WORKDIR /app

COPY package.json yarn.lock ./
COPY server/package.json ./server/package.json

RUN yarn install --frozen-lockfile

COPY server ./server
COPY eslint.config.mjs ./

WORKDIR /app/server

RUN chmod +x scripts/docker/local-run.sh

EXPOSE 8080