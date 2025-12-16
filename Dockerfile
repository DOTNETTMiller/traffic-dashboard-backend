# Use Node.js 20 with Alpine Linux for smaller image size
FROM node:20-alpine

# Install GDAL and required dependencies
RUN apk add --no-cache \
    gdal \
    gdal-tools \
    gdal-dev \
    proj \
    proj-util \
    geos \
    geos-dev \
    sqlite \
    sqlite-dev

# Set working directory
WORKDIR /app

# Copy all application files FIRST (but frontend will be overridden next)
COPY . .

# Copy package files and install backend dependencies
ENV SKIP_FRONTEND_BUILD=1
RUN npm ci --only=production

# Now build frontend (this will create frontend/dist)
WORKDIR /app/frontend
RUN npm ci
RUN npm run build

# Switch back to app directory
WORKDIR /app

# Expose port (Railway will set PORT env variable)
EXPOSE 3001

# Start the application
CMD ["node", "backend_proxy_server.js"]
