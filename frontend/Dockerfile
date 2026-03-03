FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Dev stage: code is bind-mounted at runtime ────────────────────────────────
FROM base AS dev
CMD ["npm", "run", "dev", "--", "--host"]

# ── Prod stage: static build ──────────────────────────────────────────────────
FROM base AS build
COPY . .
RUN npm run build

FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
