/**
 * Blockchain events listener.
 *
 * TODO:
 *  - Handle blockchain splits/winners
 *  - Include current-as-of block numbers in POSTs
 *  - Perhaps send related data as it was at the time of the event, not as of crawl time
 *  - Possible configurable log levels
 */
const logger = require('./logger')

require('dotenv').config()
try {
  require('envkey')
} catch (error) {
  logger.warn('EnvKey not configured')
}

const Web3 = require('web3')
const pLimit = require('p-limit')
const esmImport = require('esm')(module)
const contractsContext = esmImport('@origin/graphql/src/contracts').default
const { setNetwork } = esmImport('@origin/graphql/src/contracts')

const { blockGauge, errorCounter } = require('./metrics')
const { handleEvent } = require('./handler')
const { getLastBlock, setLastBlock, withRetrys } = require('./utils')

/**
 * Helper class passed to logic methods containing config and shared resources.
 */
class Context {
  constructor() {
    this.config = undefined
    this.web3 = undefined
  }

  async init(config, errorCounter) {
    const web3Provider = new Web3.providers.HttpProvider(
      contractsContext.config.provider
    )
    this.web3 = new Web3(web3Provider)
    this.config = config
    this.config.networkId = await this.web3.eth.net.getId()
    this.errorCounter = errorCounter
    return this
  }
}

// ---------------------------
// Listener startup
// ---------------------------

const args = {}
process.argv.forEach(arg => {
  const t = arg.split('=')
  const argVal = t.length > 1 ? t[1] : true
  args[t[0]] = argVal
})

const config = {
  // Unique id. Used to differentiate between the several listeners instances
  // that may run concurrently (ex: main vs webhook vs re-indexing).
  listenerId: args['--listener-id'] || process.env.LISTENER_ID || 'main',
  // Notification web hook URL.
  webhook: args['--webhook'] || process.env.WEBHOOK,
  // Discord webhook URL.
  discordWebhook: args['--discord-webhook'] || process.env.DISCORD_WEBHOOK,
  // Mailing list webhook URL.
  emailWebhook: args['--email-webhook'] || process.env.EMAIL_WEBHOOK,
  // Index events in the search index.
  elasticsearch:
    args['--elasticsearch'] || process.env.ELASTICSEARCH === 'true',
  // Google Cloud pub/sub topic
  gcloudPubsubTopic:
    args['--gcloud-pubsub-topic'] || process.env.GCLOUD_PUBSUB_TOPIC,
  // Google Cloud project id for pub/sub
  gcloudProjectId: args['--gcloud-project-id'] || process.env.GCLOUD_PROJECT_ID,
  // Index marketplace events.
  marketplace:
    args['--marketplace'] || process.env.INDEX_MARKETPLACE === 'true',
  // Index identity events.
  identity: args['--identity'] || process.env.INDEX_IDENTITY === 'true',
  // Index growth events.
  growth: args['--growth'] || process.env.INDEX_GROWTH === 'true',
  // File to use for picking which block number to restart from
  continueFile: args['--continue-file'] || process.env.CONTINUE_FILE,
  // Trail X number of blocks behind
  trailBlocks: parseInt(
    args['--trail-behind-blocks'] || process.env.TRAIL_BEHIND_BLOCKS || 0
  ),
  concurrency: parseInt(args['--concurrency'] || process.env.CONCURRENCY || 1),
  network: args['--network'] || process.env.NETWORK || 'docker',
  // Default continue block
  defaultContinueBlock: parseInt(process.env.CONTINUE_BLOCK || 0)
}

/**
 * Creates runtime context and starts the tracking loop
 * @return {Promise<void>}
 */
async function main() {
  const context = await new Context().init(config, errorCounter)
  let processedToBlock = await getLastBlock(context.config)

  logger.info(`Resuming processing from block ${processedToBlock}`)

  const checkIntervalSeconds = 5
  let start

  const check = async () => {
    await withRetrys(async () => {
      start = new Date()
      const currentBlock = await context.web3.eth.getBlockNumber()
      // Respect the trailBlocks option
      const toBlock = Math.max(currentBlock - context.config.trailBlocks, 0)
      if (toBlock === processedToBlock) {
        logger.debug('No new blocks to process')
        return scheduleNextCheck()
      }
      logger.debug(`Processing to block ${toBlock}`)
      contractsContext.marketplace.eventCache.updateBlock(toBlock)
      contractsContext.identityEvents.eventCache.updateBlock(toBlock)

      // Retrieve all events for the relevant contracts up to the the block
      // specified in the previous calls to updateBlock
      const eventArrays = await Promise.all([
        contractsContext.marketplace.eventCache.allEvents(),
        contractsContext.identityEvents.eventCache.allEvents()
      ])

      // Flatten array of arrays filtering out anything undefined
      const events = [].concat(...eventArrays.filter(x => x))
      // Filter to only new events
      const newEvents = events.filter(
        event => event.blockNumber > processedToBlock
      )
      logger.debug(`Got ${newEvents.length} new events`)

      const limit = pLimit(context.config.concurrency)
      const promises = []
      newEvents.forEach(newEvent => {
        promises.push(limit(() => handleEvent(newEvent, context)))
      })
      await Promise.all(promises)

      // Record state of processing
      logger.debug(`Updating last processed block to ${toBlock}`)
      await setLastBlock(context.config, toBlock)
      processedToBlock = toBlock
      blockGauge.set(toBlock)

      return scheduleNextCheck()
    })
  }

  const scheduleNextCheck = async () => {
    const elapsed = new Date() - start
    const delay = Math.max(checkIntervalSeconds * 1000 - elapsed, 1)
    setTimeout(check, delay)
  }

  check()
}

// Start the listener.
logger.info(`Starting event-listener with config:\n
  ${JSON.stringify(config, (k, v) => (v === undefined ? null : v), 2)}`)

setNetwork(config.network)
main()
