# Canvas Website Dockerfile
# Builds Vite frontend and serves with nginx
# Backend (sync) still uses Cloudflare Workers

# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source
COPY . .

# Build args for environment
ARG VITE_WORKER_ENV=production
ARG VITE_DAILY_API_KEY
ARG VITE_RUNPOD_API_KEY
ARG VITE_RUNPOD_IMAGE_ENDPOINT_ID
ARG VITE_RUNPOD_VIDEO_ENDPOINT_ID
ARG VITE_RUNPOD_TEXT_ENDPOINT_ID
ARG VITE_RUNPOD_WHISPER_ENDPOINT_ID

# Set environment for build
# VITE_WORKER_ENV: 'production' | 'staging' | 'dev' | 'local'
ENV VITE_WORKER_ENV=$VITE_WORKER_ENV
ENV VITE_DAILY_API_KEY=$VITE_DAILY_API_KEY
ENV VITE_RUNPOD_API_KEY=$VITE_RUNPOD_API_KEY
ENV VITE_RUNPOD_IMAGE_ENDPOINT_ID=$VITE_RUNPOD_IMAGE_ENDPOINT_ID
ENV VITE_RUNPOD_VIDEO_ENDPOINT_ID=$VITE_RUNPOD_VIDEO_ENDPOINT_ID
ENV VITE_RUNPOD_TEXT_ENDPOINT_ID=$VITE_RUNPOD_TEXT_ENDPOINT_ID
ENV VITE_RUNPOD_WHISPER_ENDPOINT_ID=$VITE_RUNPOD_WHISPER_ENDPOINT_ID

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine AS production
WORKDIR /usr/share/nginx/html

# Remove default nginx static assets
RUN rm -rf ./*

# Copy built assets from build stage
COPY --from=build /app/dist .

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
