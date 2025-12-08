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

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Expose port (Railway will set PORT env variable)
EXPOSE 3001

# Start the application
CMD ["node", "backend_proxy_server.js"]
