# backend/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend ./
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "server.js"]
