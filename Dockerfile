# Stage 1: build the static site.
# Base images come from the AWS Public ECR mirrors of the official images: Docker Hub
# rate-limits the shared GitHub Actions runners (429 Too Many Requests).
FROM public.ecr.aws/docker/library/node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: serve it with an nginx that runs as a non-root user on port 8080.
FROM public.ecr.aws/nginx/nginx-unprivileged:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
