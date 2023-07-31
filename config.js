require('dotenv').config()

class Config {
    HTTP_BASE_RPC = process.env.HTTP_BASE_RPC
    WSS_BASE_RPC = process.env.WSS_BASE_RPC
    REDIS_URL = process.env.REDIS_URL
    REDIS_CLUSTER = JSON.parse(process.env.REDIS_CLUSTER)
    CELERY_BROKER_URL = process.env.CELERY_BROKER_URL
    CELERY_ROUTES = {
        'worker.task_register_domain': 'dns-domain-queue',
        'worker.on_transfer_nft': 'dns-domain-queue',
        'worker.on_trade_nft': 'dns-domain-queue',

    }
    SENTRY_DSN = process.env.SENTRY_DSN

}

module.exports = new Config()