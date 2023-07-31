const { redisClient } = require("../connect");
const Sentry = require("@sentry/node");
const fs = require('fs')
const celery = require('celery-node');

const _ = require("lodash");
const logger = require('../helper/logger')
const SubscribeEvent = require('../helper/subscribe_event')
const config = require('../config')

let subscribeEvent = null

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

async function start({ fromBlock, isRunAtFromBlock, wssRpc, httpRpc, taskNames, topics, eventType, celeryTasks }) {

  subscribeEvent = new SubscribeEvent({
    wssRpcUrl: wssRpc,
    httpRpcUrl: httpRpc,
    topics: topics,
    eventType: eventType,
    taskNames: taskNames,
    redis: redisClient,
    celeryTasks: celeryTasks,
  });

  await subscribeEvent.initialize({
    fromBlock,
    isRunAtFromBlock
  })

  await subscribeEvent.scan()

}

async function run() {
  try {
    const args = require("args-parser")(process.argv);
    const startBlock = _.get(args, "fromBlock");
    const isRunAtFromBlock = _.get(args, 'isRunAtFromBlock', false)
    let httpRpc = _.get(args, 'httpRpc')
    let wssRpc = _.get(args, 'wssRpc')
    let topics = _.get(args, 'topics')
    let taskNames = _.get(args, "taskNames")
    let eventFileNames = _.get(args, "eventFileNames")

    if(!_.isNumber(startBlock)) {
      logger.info(`fromBlock Is Not Number `, startBlock)
      throw Error(`fromBlock Is Not Number`)
    }
    if(!taskNames || !eventFileNames || !topics || !httpRpc || !wssRpc) {
      logger.info(`Missing Subscribe Params: `, args)
      throw Error(`Missing Subscribe Params`)
    }

    taskNames = taskNames.split(',')
    eventFileNames = eventFileNames.split(',')
    topics = topics.split(',')
    httpRpc = _.get(process.env, httpRpc)
    wssRpc = _.get(process.env, wssRpc)

    logger.info(`Start Subscribe`, args)
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
      celeryTasks
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
