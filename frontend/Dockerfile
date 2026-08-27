# syntax=docker/dockerfile:1
# Dev-oriented image: runs the Vite dev server so VITE_API_URL can be set at runtime.
FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
