/**
 * Caching System for DOT Corridor Communicator
 *
 * Provides:
 * - HTTP Cache-Control headers
 * - In-memory server-side caching
 * - ETag generation and validation
 * - 304 Not Modified responses
 */

const crypto = require('crypto');

// =============================================================================
// In-Memory Cache Store
// =============================================================================

class CacheStore {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };
  }

  /**
   * Get cached value if not expired
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.stats.evictions++;
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set cached value with optional TTL (in seconds)
   */
  set(key, value, ttlSeconds = 60) {
    const entry = {
      value,
      expiresAt: ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null,
      setAt: Date.now()
    };

    this.cache.set(key, entry);
    this.stats.sets++;

    // Auto-cleanup expired entries periodically
    if (this.cache.size > 1000) {
      this.cleanup();
    }
  }

  /**
   * Delete specific key
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.evictions += size;
  }

  /**
   * Remove expired entries
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.cache.delete(key);
        removed++;
      }
    }

    this.stats.evictions += removed;
    console.log(`🧹 Cache cleanup: removed ${removed} expired entries`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage (rough approximation)
   */
  estimateMemoryUsage() {
    let bytes = 0;
    for (const [key, entry] of this.cache.entries()) {
      bytes += key.length * 2; // Assuming UTF-16
      bytes += JSON.stringify(entry.value).length * 2;
    }
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }
}

// Global cache instance
const cache = new CacheStore();

// Cleanup every 5 minutes
setInterval(() => cache.cleanup(), 5 * 60 * 1000);

// =============================================================================
// ETag Generation
// =============================================================================

/**
 * Generate ETag from response data
 */
function generateETag(data) {
  const hash = crypto
    .createHash('md5')
    .update(typeof data === 'string' ? data : JSON.stringify(data))
    .digest('hex');

  return `"${hash}"`;
}

// =============================================================================
// Caching Middleware
// =============================================================================

/**
 * HTTP Cache-Control middleware
 *
 * @param {number} maxAge - Cache duration in seconds
 * @param {boolean} isPublic - Public (CDN) or private (browser only)
 * @param {boolean} enableETag - Add ETag support
 */
function cacheControl(maxAge = 60, isPublic = true, enableETag = true) {
  return (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to add caching headers
    res.json = function(data) {
      // Set Cache-Control header
      const visibility = isPublic ? 'public' : 'private';
      res.set('Cache-Control', `${visibility}, max-age=${maxAge}`);

      // Add ETag if enabled
      if (enableETag) {
        const etag = generateETag(data);
        res.set('ETag', etag);

        // Check if client has matching ETag
        const clientETag = req.headers['if-none-match'];
        if (clientETag === etag) {
          return res.status(304).end(); // Not Modified
        }
      }

      // Call original json method
      return originalJson(data);
    };

    next();
  };
}

/**
 * Server-side caching middleware with memoization
 *
 * Caches expensive operations in memory
 *
 * @param {function} keyGenerator - Function to generate cache key from req
 * @param {number} ttlSeconds - Cache TTL in seconds
 */
function memoize(keyGenerator, ttlSeconds = 60) {
  return async (req, res, next) => {
    const cacheKey = keyGenerator(req);
    const cached = cache.get(cacheKey);

    if (cached) {
      console.log(`💨 Cache HIT: ${cacheKey}`);

      // Add cache header
      res.set('X-Cache', 'HIT');

      // Return cached response
      return res.json(cached);
    }

    console.log(`🔍 Cache MISS: ${cacheKey}`);
    res.set('X-Cache', 'MISS');

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json to cache the response
    res.json = function(data) {
      // Cache the response
      cache.set(cacheKey, data, ttlSeconds);

      // Call original json method
      return originalJson(data);
    };

    next();
  };
}

/**
 * Conditional request middleware (ETag + Last-Modified)
 */
function conditionalRequest() {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function(data) {
      // Generate ETag
      const etag = generateETag(data);
      res.set('ETag', etag);

      // Add Last-Modified (current time since data is dynamic)
      res.set('Last-Modified', new Date().toUTCString());

      // Check If-None-Match (ETag)
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch === etag) {
        console.log(`✅ 304 Not Modified: ETag match`);
        return res.status(304).end();
      }

      // Check If-Modified-Since (less common for APIs)
      const ifModifiedSince = req.headers['if-modified-since'];
      if (ifModifiedSince) {
        // For this API, data changes frequently, so we'll skip this check
        // In a real implementation, compare with actual last modification time
      }

      return originalJson(data);
    };

    next();
  };
}

// =============================================================================
// Cache Management Functions
// =============================================================================

/**
 * Invalidate cache by pattern
 */
function invalidateCache(pattern) {
  let removed = 0;
  for (const key of cache.cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
      removed++;
    }
  }
  console.log(`🗑️  Invalidated ${removed} cache entries matching: ${pattern}`);
  return removed;
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  return cache.getStats();
}

/**
 * Clear all cache
 */
function clearCache() {
  cache.clear();
  console.log('🧹 Cache cleared');
}

// =============================================================================
// Preset Caching Strategies
// =============================================================================

const CachingStrategies = {
  /**
   * No caching (for real-time data)
   */
  none: () => (req, res, next) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    next();
  },

  /**
   * Short cache (60 seconds) - Good for traffic data
   */
  short: () => cacheControl(60, true, true),

  /**
   * Medium cache (5 minutes) - Good for static-ish data
   */
  medium: () => cacheControl(300, true, true),

  /**
   * Long cache (1 hour) - Good for rarely changing data
   */
  long: () => cacheControl(3600, true, true),

  /**
   * Very long cache (1 day) - Good for static assets
   */
  veryLong: () => cacheControl(86400, true, true),

  /**
   * Private cache (browser only, not CDN)
   */
  private: (maxAge = 60) => cacheControl(maxAge, false, true),

  /**
   * Server-side memoization for expensive operations
   */
  memoize: (keyGen, ttl = 60) => memoize(keyGen, ttl)
};

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  // Middleware
  cacheControl,
  memoize,
  conditionalRequest,

  // Strategies
  CachingStrategies,

  // Cache management
  cache,
  invalidateCache,
  getCacheStats,
  clearCache,

  // Utilities
  generateETag
};
