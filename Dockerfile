FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

ARG VITE_APP_ENV=production
ARG VITE_API_BASE_URL=/api
ARG VITE_BUILD_VERSION=QWG-production
ARG VITE_MARKET_DATA_MODE=live

ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_BUILD_VERSION=$VITE_BUILD_VERSION
ENV VITE_MARKET_DATA_MODE=$VITE_MARKET_DATA_MODE

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime

LABEL org.opencontainers.image.title="Quantum-AI Wealth Guardian"
LABEL org.opencontainers.image.description="Crypto portfolio risk analysis app with Node API, React UI, PostgreSQL auth, and local QAOA optimizer."

ARG APP_PORT=8787

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV LOCAL_API_PORT=$APP_PORT

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server

USER node

EXPOSE $APP_PORT

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "const port=process.env.LOCAL_API_PORT||8787; fetch('http://127.0.0.1:'+port+'/health').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1));"

CMD ["node", "server/local-api.mjs"]
