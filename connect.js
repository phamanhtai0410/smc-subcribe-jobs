const Sentry = require("@sentry/node");
const Redis = require("ioredis");

const config = require("./config");
const logger = require("./helper/logger")

const redisClient = new Redis(config.REDIS_URL);
redisClient.on("error", (err) => console.log("Redis Server Error", err));

console.log(config.REDIS_CLUSTER, typeof config.REDIS_CLUSTER);

const redisCluster = new Redis.Cluster(
  config.REDIS_CLUSTER
)
redisCluster.on("error", (err) => console.log("Redis Cluster Server Error", err));

if (config.SENTRY_DSN) {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    tracesSampleRate: 1.0,
    debug: true
  });
  logger.info(`Init sentry: ${config.SENTRY_DSN}`)
}

module.exports = {
  redisClient,
  redisCluster
};
