# Stage 1: Build the React Application
FROM node:20-alpine AS build
WORKDIR /app

# Define Build Arguments
ARG VITE_PEXELS_API_KEY
ARG VITE_API_BIBLE_KEY
ARG VITE_GA_MEASUREMENT_ID

# Make them available as environment variables for the build process
ENV VITE_PEXELS_API_KEY=$VITE_PEXELS_API_KEY
ENV VITE_API_BIBLE_KEY=$VITE_API_BIBLE_KEY
ENV VITE_GA_MEASUREMENT_ID=$VITE_GA_MEASUREMENT_ID

# Install root dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the application
RUN npm run build

# Stage 2a: Frontend (Nginx) - Served on Port 8080
FROM nginx:alpine AS frontend

# Create user 'apps' with UID/GID 568
RUN addgroup -g 568 apps && \
    adduser -u 568 -G apps -D -s /bin/sh apps

# Set up permissions for Nginx to run as non-root
RUN touch /var/run/nginx.pid && \
    chown -R apps:apps /var/run/nginx.pid /var/cache/nginx /var/log/nginx /etc/nginx/conf.d

USER apps

COPY --from=build --chown=apps:apps /app/dist /usr/share/nginx/html
COPY --chown=apps:apps nginx.conf /etc/nginx/nginx.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

# Stage 2b: Backend (Node) - Served on Port 8284
FROM node:20-alpine AS backend
WORKDIR /app

# Create user 'apps' with UID/GID 568
RUN addgroup -g 568 apps && \
    adduser -u 568 -G apps -D -s /bin/sh apps

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install

# Copy the server code
COPY server/ ./server/

# Copy the built frontend (optional, for direct access to backend)
COPY --from=build /app/dist ./dist/

# Create uploads directory and set permissions
RUN mkdir -p server/uploads && chown -R apps:apps /app

USER apps

# Expose the backend port
EXPOSE 8284

# Start the server
CMD ["node", "server/index.js"]
