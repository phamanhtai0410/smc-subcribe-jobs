const Web3 = require('web3')
const _ = require('lodash')
const logger = require('./logger')

MAX_BLOCK_SUBSCRIBE = 5000 //NOTE: only get prev maximum 1000 block
PAST_BLOCK_SIZE = 20
EVENT_TYPE_PARSE_INT_TYPE = ['uint256', 'uint8']
LOG_DATA_TOPIC_PARSED = ['', '0x', '0x0'] //NOTE: if in this list must be parse from topics

class SubscribeEvent {
  constructor({
    httpRpcUrl,
    wssRpcUrl,
    topics,
    eventType,
    taskNames,
    redis,
    celeryTasks,
    address = [],
    redisAddressKey = null,
    redisAddressKeyType = null,
    chain='GOERLI',
    sendRawLog=false,
    parseLogFunction=undefined
  }) {
    this.wssRpcUrl = wssRpcUrl;
    this.httpRpcUrl = httpRpcUrl;
    this.currentHttpRpc = this.httpRpcUrl.shift();
    this.httpWeb3 = new Web3(this.currentHttpRpc);
    if(this.wssRpcUrl)
      this.wssWeb3 = new Web3(this.wssRpcUrl);
    this.topics = topics;
    this.eventType = eventType;
    this.taskNames = taskNames;
    this.redis = redis;
    this.REDIS_PREV_SUBSCRIBE_BLOCK_KEY = `scroll-id.smc-subscribe-jobs.SubscribeEvent:${topics}:${chain}`;
    this.celeryTasks = celeryTasks;
    this.address = address;
    this.redisAddressKey = redisAddressKey;
    this.redisAddressKeyType = redisAddressKeyType;
    this.chain = chain
    this.sendRawLog = sendRawLog
    this.parseLogFunction = parseLogFunction
    console.log(
      "REDIS_PREV_SUBSCRIBE_BLOCK_KEY",
      this.REDIS_PREV_SUBSCRIBE_BLOCK_KEY
    );
    console.log("redisAddressKey", this.redisAddressKey);
  }

  async changeHttpRpc() {
    logger.info(`[START] changeHttpRpc currentHttpRpc: ${this.currentHttpRpc}`);
    this.httpRpcUrl.push(this.currentHttpRpc);
    this.currentHttpRpc = this.httpRpcUrl.shift();
    this.httpWeb3 = new Web3(this.currentHttpRpc);
    logger.info(`[DONE] changeHttpRpc currentHttpRpc: ${this.currentHttpRpc}`);
  }

  async initialize({ fromBlock, isRunAtFromBlock = false }) {
    const prevBlockNumber = await this.redis.get(
      this.REDIS_PREV_SUBSCRIBE_BLOCK_KEY
    );
    if (!prevBlockNumber) {
      logger.info(`Do not have prev blockNumber, start from: ${fromBlock}`);
      await this.setFromBlock(fromBlock);
      return fromBlock;
    }

    if (prevBlockNumber && isRunAtFromBlock) {
      logger.info(`Config is run at fromBlock, start from: ${fromBlock}`);
      await this.setFromBlock(fromBlock);
      return fromBlock;
    }

    return prevBlockNumber;
  }

  handleExit(subscription) {
    logger.info(`--------- Script Exit ---------`);
    if (!subscription) {
      process.exit(0);
    }
    subscription.unsubscribe(function (error, success) {
      if (error) {
        logger.info(error);
        return;
      }
      logger.info("Successfully unsubscribed!");
      process.exit(0);
    });
  }

  removeNullListAddress(address) {
    const data = _.remove(address, (item) => {
      return item != "" && item != null && item != undefined;
    });

    return data;
  }

  async getListAddress() {
    if (!this.redisAddressKey || !this.redisAddressKeyType) {
      return this.address ? this.address : [];
    }

    if (this.redisAddressKeyType == "GET") {
      const data = (await this.redis.get(this.redisAddressKey)) || "[]";
      const listAddress = this.removeNullListAddress(JSON.parse(data));
      return this.address ? [...this.address, ...listAddress] : listAddress;
    }

    const data = (await this.redis.hgetall(this.redisAddressKey)) || {};
    const listAddress = this.removeNullListAddress(Object.values(data));

    return this.address ? [...this.address, ...listAddress] : listAddress;
  }

  async suggestBlockNumber(fromBlock) {
    const prevBlockNumber = _.toInteger(
      await this.redis.get(this.REDIS_PREV_SUBSCRIBE_BLOCK_KEY)
    );
    console.log("prevBlockNumber", prevBlockNumber);
    if (!prevBlockNumber) {
      return fromBlock;
    }
    if (prevBlockNumber) {
      return Math.max(fromBlock, prevBlockNumber);
    }

    const latestBlockNumber = await this.httpWeb3.eth.getBlockNumber();
    return latestBlockNumber - PAST_BLOCK_SIZE;
  }

  async setFromBlock(value) {
    await this.redis.set(this.REDIS_PREV_SUBSCRIBE_BLOCK_KEY, value);
    logger.info(`Set from block: ${value}, ${this.REDIS_PREV_SUBSCRIBE_BLOCK_KEY}`)
  }

  async getFromBlock() {
    const prevBlockNumber = _.toInteger(
      await this.redis.get(this.REDIS_PREV_SUBSCRIBE_BLOCK_KEY)
    );
    const latestBlockNumber = await this.httpWeb3.eth.getBlockNumber();
    if (
      !prevBlockNumber ||
      latestBlockNumber - prevBlockNumber > MAX_BLOCK_SUBSCRIBE
    ) {
      return latestBlockNumber;
    }

    return prevBlockNumber;
  }

  async formatFromBlockWss(fromBlock) {
    const latestBlockNumber = await this.httpWeb3.eth.getBlockNumber();
    if (latestBlockNumber - fromBlock > MAX_BLOCK_SUBSCRIBE) {
      return latestBlockNumber - MAX_BLOCK_SUBSCRIBE;
    }

    return fromBlock;
  }

  async makeTopicData({ log, eventType }) {
    const topics = _.get(log, "topics");
    let args = {};
    for (let i = 0; i < eventType.length; i++) {
      const valueDecode = await this.httpWeb3.eth.abi.decodeParameter(
        _.get(eventType[i], "type"),
        topics[i + 1]
      );
      const name = _.get(eventType[i], "name");
      const valueType = _.get(eventType[i], "type");
      const value = EVENT_TYPE_PARSE_INT_TYPE.includes(valueType)
        ? _.toInteger(valueDecode)
        : valueDecode;
      _.set(args, name, value);
    }
    return {
      chain: this.chain,
      transactionHash: _.get(log, "transactionHash"),
      blockNumber: _.get(log, "blockNumber"),
      address: _.get(log, "address"),
      args: args,
    };
  }

  parseSpecificValue({ parseData, name, valueType }) {
    const data = _.get(parseData, name);
    if (!/^uint*/.test(valueType)) {
      return data;
    }
    if (!Array.isArray(data)) {
      return _.toInteger(data);
    }

    const value = [];
    for (let item of data) {
      value.push(_.toInteger(item));
    }
    return value;
  }

  async makeEventData({ log, eventType }) {
    const parseData = this.httpWeb3.eth.abi.decodeParameters(
      eventType,
      _.get(log, "data")
    );
    let args = {};
    for (let type of eventType) {
      const name = _.get(type, "name");
      const valueType = _.get(type, "type");
      const value = this.parseSpecificValue({ parseData, name, valueType });
      _.set(args, name, value);
    }
    return {
      chain: this.chain,
      transactionHash: _.get(log, "transactionHash"),
      blockNumber: _.get(log, "blockNumber"),
      address: _.get(log, "address"),
      args: args,
    };
  }

  async handleLog(log) {
    const logTopics = _.get(log, "topics");
    const topicIndex = _.findIndex(this.topics, (topic) => {
      return topic == _.get(logTopics, "0");
    });
    if (topicIndex == -1) {
      logger.info(`Topics Not Found`);
      return;
    }

    const eventType = this.eventType[topicIndex];
    const taskName = this.taskNames[topicIndex];

    const logData = _.get(log, "data");
    let event = {};

    if(this.sendRawLog) {
      event = JSON.stringify(log)
    }
    else if(this.parseLogFunction) {
      event = require(`${process.cwd()}/functions/${this.parseLogFunction}`)(this.httpWeb3, eventType, log)
      event = {
        ...event,
        'chain': this.chain
      }
    }
    else if (LOG_DATA_TOPIC_PARSED.includes(logData)) {
      event = await this.makeTopicData({
        log,
        eventType,
      });
    } else {
      event = await this.makeEventData({
        log,
        eventType,
      });
    }

    const celeryTask = _.get(this.celeryTasks, taskName);

    console.log(`Handle Log For event`, event);

    await celeryTask.delay(event,);

    const blockNumber = _.get(event, "blockNumber");
    await this.setFromBlock(blockNumber);
    return event;
  }

  async scanAll({ fromBlock }) {
    logger.info(`------------------------------------------------------------`);
    logger.info(
      `Start scan all block for: ${this.topics}, ${this.currentHttpRpc}, startBlock: ${fromBlock}`
    );
    const latestBlock = await this.httpWeb3.eth.getBlockNumber();
    while (fromBlock < latestBlock) {
      const toBlock =
        fromBlock + PAST_BLOCK_SIZE < latestBlock
          ? fromBlock + PAST_BLOCK_SIZE
          : latestBlock;
      logger.info(
        `Scan from ${fromBlock}, to ${toBlock}, latest: ${latestBlock}`
      );
      const listRedisAddress = await this.getListAddress();
      if (this.redisAddressKey && _.isEmpty(listRedisAddress)) {
        logger.info(`Do not have list address for key: ${this.redisAddressKey}`)
        return latestBlock
      }
      const logs = await this.httpWeb3.eth.getPastLogs({
        fromBlock,
        toBlock,
        topics: this.topics,
        address: listRedisAddress,
      });
      for (let log of logs) {
        const event = await this.handleLog(log);
      }
      fromBlock += PAST_BLOCK_SIZE;
    }

    return latestBlock;
  }

  async subscribe({ fromBlock }) {
    // const fromBlock = await this.getFromBlock()
    logger.info(
      `--------- start subscribe logs ${this.wssRpcUrl}, fromBlock: ${fromBlock} ---------`
    );
    const subscription = this.wssWeb3.eth.subscribe(
      "logs",
      {
        fromBlock: fromBlock,
        topics: this.topics,
        address: this.address,
      },
      (error, result) => {
        if (error) {
          console.error(error);
          throw error;
        }
        this.subscription = subscription;
      }
    );

    subscription.on("data", async (log) => {
      const event = await this.handleLog(log);
    });
  }

  async scan() {
    const fromBlock = await this.getFromBlock();
    const wssFromBlock = await this.scanAll({
      fromBlock,
    });
    await this.setFromBlock(wssFromBlock);
    logger.info(`Done Scan All Block`);
    logger.info(`Start Subscribe`);
    this.subscribe({
      fromBlock: wssFromBlock,
    });
  }
}

module.exports = SubscribeEvent