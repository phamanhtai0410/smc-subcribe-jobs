const { redisCluster } = require("../connect");
const Sentry = require("@sentry/node");
const fs = require('fs')
const celery = require('celery-node');
const delay = require('delay');

const _ = require("lodash");
const logger = require('../helper/logger')
const SubscribeEvent = require('../helper/subscribe_event')
const config = require('../config')

let subscribeEvent = null
const DELAY_TIME = 15 * 1000 //NOTE: Delay is millisecond

async function createCeleryTasks(taskNames) {
  const tasks = {}
  for (let taskName of taskNames) {
    const workerQueue = _.get(config.CELERY_ROUTES, taskName)
    if(!workerQueue) {
      throw Error(`not config worker queue for task: ${taskName}`)
    }
    const celeryClient = await celery.createClient(
      config.CELERY_BROKER_URL,
      config.CELERY_BROKER_URL,
      workerQueue
    );
    const celeryTask = celeryClient.createTask(taskName);
    _.set(tasks, taskName, celeryTask);
  }
  return tasks
}

async function createEventType(eventFileNames) {
  const eventTypes = []
  for(let fileName of eventFileNames) {
    const filePath = `event_type/${fileName}`
    if(!fs.existsSync(filePath)) {
      throw Error(`event type file not existed: ${filePath}`)
    }
    const eventType = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    eventTypes.push(eventType)
  }

  return eventTypes
}

async function start({
  fromBlock,
  isRunAtFromBlock,
  wssRpc,
  httpRpc,
  taskNames,
  topics,
  eventType,
  celeryTasks,
  redis,
  address = [],
  redisAddressKey = null,
  redisAddressKeyType = null,
  chain='BASE',
  sendRawLog=false,
  parseLogFunction=null
}) {
  subscribeEvent = new SubscribeEvent({
    wssRpcUrl: wssRpc,
    httpRpcUrl: httpRpc,
    topics: topics,
    eventType: eventType,
    taskNames: taskNames,
    redis: redisCluster,
    celeryTasks: celeryTasks,
    address: address,
    redisAddressKey,
    redisAddressKeyType,
    chain,
    sendRawLog,
    parseLogFunction
  });

  let scanBlock = await subscribeEvent.suggestBlockNumber(fromBlock);

  while (true) {
    try{
      const latestBlock = await subscribeEvent.scanAll({
        fromBlock: scanBlock,
      });
      await subscribeEvent.setFromBlock(latestBlock);
  
      scanBlock = latestBlock;
      console.log(`Start Delay: ${DELAY_TIME}`);
      await delay(DELAY_TIME);
      console.log(`Done Delay`);
    } catch(error) {
      console.log(error);
      logger.error(error)
      await subscribeEvent.changeHttpRpc()
    }

  }
}

async function run() {
  try {
    const args = require("args-parser")(process.argv);
    const startBlock = _.get(args, "fromBlock"); // NOTE: start block for init script
    const isRunAtFromBlock = _.get(args, 'isRunAtFromBlock', false) // NOTE: if true will always run at startBlock when restart service
    const chain = _.get(args, 'chain', 'BASE')
    const sendRawLog = _.get(args, 'sendRawLog', false)
    const parseLogFunction = _.get(args, 'parseLogFunction', null)
    let httpRpc = _.get(args, 'httpRpc')// NOTE: http rpc required
    let wssRpc = _.get(args, 'wssRpc') // NOTE: websocket rpc required
    let topics = _.get(args, 'topics') // NOTE: list topics to handle, split with ',' to get array
    let taskNames = _.get(args, "taskNames") // NOTE: task name in config for celery send task to handle
    let eventFileNames = _.get(args, "eventFileNames") //NOTE: event type file for parse log data
    let address = _.get(args, 'address', null) //NOTE: list hard address want to scan
    let redisAddress = _.get(args, 'redisAddress', null) //NOTE: redisAddress is string with format: redisAddressKey#keyType
    let redisAddressKey = null
    let redisAddressKeyType = null

    if(!_.isNumber(startBlock)) {
      logger.info(`fromBlock Is Not Number `, startBlock)
      throw Error(`fromBlock Is Not Number`)
    }
    if(!taskNames || !eventFileNames || !topics || (!httpRpc && !wssRpc)) {
      logger.info(`Missing Subscribe Params: `, args)
      throw Error(`Missing Subscribe Params`)
    }

    if(address) {
      address = address.split(',')
    }

    if(redisAddress) {
      redisAddress = redisAddress.split('#')
      redisAddressKey = _.get(redisAddress, 0)
      redisAddressKeyType = _.get(redisAddress, 1)
    }

    taskNames = taskNames.split(',')
    eventFileNames = eventFileNames.split(',')
    topics = topics.split(',')
    httpRpc = JSON.parse(_.get(process.env, httpRpc))
    wssRpc = _.get(process.env, wssRpc)

    console.log(`Start Script: `, args);
    console.log({
      httpRpc,
      wssRpc
    });

    const eventType = await createEventType(eventFileNames)
    const celeryTasks = await createCeleryTasks(taskNames)

    Sentry.captureMessage(`Start Subscribe Jobs - fromBlock:${startBlock}, topics:${topics}, wssRpc:${wssRpc}, taskNames:${taskNames}`)

    await start({
      httpRpc,
      wssRpc,
      fromBlock: startBlock,
      isRunAtFromBlock,
      taskNames,
      topics,
      eventType,
      celeryTasks,
      address,
      redisAddressKey,
      redisAddressKeyType,
      chain,
      sendRawLog,
      parseLogFunction
    })

  } catch (error) {
    logger.error(error);
    if(subscribeEvent != null) {
      process.on("SIGINT", () => {
        subscribeEvent.handleExit(subscribeEvent.subscription);
      });
      process.on("exit", () => {
        subscribeEvent.handleExit(subscribeEvent.subscription);
      });
      Sentry.captureException(error);
    }

  }
}
run();
