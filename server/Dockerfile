# Production Dockerfile

# First stage: Build the application
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./
COPY server/package.json ./server/package.json

RUN yarn install --frozen-lockfile

COPY server ./server

RUN yarn workspace @secret-santa/server build

# Second stage: Setup the production image
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json yarn.lock ./
COPY server/package.json ./server/package.json

RUN yarn install --frozen-lockfile --production=true && yarn cache clean

COPY --from=builder /app/server/dist ./server/dist

WORKDIR /app/server

# Run the server in production mode
CMD ["yarn", "server:prod"]

EXPOSE 8080