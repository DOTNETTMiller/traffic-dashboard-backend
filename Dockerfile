# Use Node.js 20 with Alpine Linux for smaller image size
FROM node:20-alpine

# Install build dependencies for native modules (better-sqlite3, puppeteer)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    gdal \
    gdal-tools \
    gdal-dev \
    proj \
    proj-util \
    geos \
    geos-dev \
    sqlite \
    sqlite-dev

# Tell Puppeteer to skip downloading Chromium (use system Chromium)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Set working directory
WORKDIR /app

# Copy all application files
COPY . .

# Install backend dependencies (postinstall script will exit gracefully)
ENV SKIP_FRONTEND_BUILD=1
RUN npm ci --only=production && \
    echo "📦 Verifying critical dependencies..." && \
    node -e "const deps = ['ajv', 'pdfkit', 'express', 'cors', 'better-sqlite3']; deps.forEach(d => { try { require(d); console.log('✅', d); } catch(e) { console.log('❌', d, 'MISSING'); } });"

# Expose port (Railway will set PORT env variable)
EXPOSE 3001

# Start the application via start.js wrapper (handles volume initialization)
CMD ["node", "start.js"]
