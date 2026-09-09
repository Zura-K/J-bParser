# Build context is the repository root (see deploy/docker-compose.yml).
FROM node:22-alpine AS build

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
# package-lock.json is authored with npm 11; node:22-alpine ships npm 10, whose
# lock format is incompatible, so upgrade before installing.
RUN npm install -g npm@11 && npm ci
COPY frontend ./
RUN npm run build

# The final image contains only compiled assets and the nginx config —
# no source code, no node_modules, no repository files.
FROM nginx:1.27-alpine

COPY deploy/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist /usr/share/nginx/html

EXPOSE 80
