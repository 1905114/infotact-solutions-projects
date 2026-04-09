/**
 * Optimized Rate Limiting Middleware
 * Uses Redis for distributed rate limiting (optional)
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

// Redis client (optional, falls back to memory store)
let redisClient = null;
let useRedis = false;

try {
  if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL);
    useRedis = true;
    console.log('Redis connected for rate limiting');
  }
} catch (error) {
  console.warn('Redis not available, using memory store for rate limiting');
}

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  ...(useRedis && redisClient ? {
    store: new RedisStore({
      client: redisClient,
      prefix: 'rl:api:',
    }),
  } : {}),
});

// Stricter limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  ...(useRedis && redisClient ? {
    store: new RedisStore({
      client: redisClient,
      prefix: 'rl:auth:',
    }),
  } : {}),
});

// Merchant dashboard limiter
const merchantLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: {
    success: false,
    message: 'Too many requests to merchant dashboard, please slow down.',
  },
  ...(useRedis && redisClient ? {
    store: new RedisStore({
      client: redisClient,
      prefix: 'rl:merchant:',
    }),
  } : {}),
});

// Order creation limiter
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many orders placed, please wait.',
  },
  ...(useRedis && redisClient ? {
    store: new RedisStore({
      client: redisClient,
      prefix: 'rl:order:',
    }),
  } : {}),
});

// WebSocket connection limiter
const websocketLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const key = `ws:${ip}`;
  
  // Simple in-memory rate limiting for WebSocket
  if (!global.wsRateLimits) {
    global.wsRateLimits = new Map();
  }
  
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxConnections = 10;
  
  const userLimits = global.wsRateLimits.get(key) || { count: 0, resetTime: now + windowMs };
  
  if (now > userLimits.resetTime) {
    userLimits.count = 0;
    userLimits.resetTime = now + windowMs;
  }
  
  userLimits.count++;
  global.wsRateLimits.set(key, userLimits);
  
  if (userLimits.count > maxConnections) {
    return res.status(429).json({
      success: false,
      message: 'Too many WebSocket connection attempts, please try again later.',
    });
  }
  
  next();
};

// Clean up old rate limit entries periodically
if (!useRedis) {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of global.wsRateLimits || []) {
      if (now > value.resetTime) {
        global.wsRateLimits.delete(key);
      }
    }
  }, 60 * 1000);
}

module.exports = {
  apiLimiter,
  authLimiter,
  merchantLimiter,
  orderLimiter,
  websocketLimiter,
};