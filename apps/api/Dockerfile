# Se construye desde la raíz del monorepo (contexto "."), ver docker-compose.yml.
FROM node:22-alpine
ENV TZ=America/Lima
RUN apk add --no-cache tzdata openssl
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/finance/package.json packages/finance/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace packages/finance --workspace apps/api --include-workspace-root=false

COPY packages/finance packages/finance
COPY apps/api apps/api
RUN npm run build -w packages/finance && npm run build -w apps/api

EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
