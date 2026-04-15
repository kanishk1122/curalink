const { Redis } = require('@upstash/redis');
const dotenv = require('dotenv');

dotenv.config();

/**
 * High-Performance Cloud-Native Caching Bridge
 * Uses Upstash REST protocol for maximum compatibility in serverless and containerized environments.
 */
const redis = new Redis({
  url: process.env.REDIS_REST_URL,
  token: process.env.REDIS_REST_TOKEN,
});

// Diagnostic check for production readiness
(async () => {
    try {
        await redis.ping();
        console.log('◇ Cloud Cache: Upstash Redis connection established.');
    } catch (error) {
        console.warn('⚠ Cloud Cache Warning: Upstash Redis connection failed. System will fallback to database-only retrieval.', error.message);
    }
})();

module.exports = redis;
