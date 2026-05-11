const axios = require('axios');
const cron = require('node-cron');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configuration
const CONFIG = {
  sourceApiUrl: process.env.SOURCE_API_URL || 'https://jsonplaceholder.typicode.com',
  sourceApiKey: process.env.SOURCE_API_KEY || '',
  targetApiUrl: process.env.TARGET_API_URL || 'https://httpbin.org',
  targetApiKey: process.env.TARGET_API_KEY || '',
  cronSchedule: process.env.CRON_SCHEDULE || '*/5 * * * *',
  maxRetries: parseInt(process.env.MAX_RETRIES, 10) || 3,
  retryDelayMs: parseInt(process.env.RETRY_DELAY_MS, 10) || 1000,
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS, 10) || 10000,
  logLevel: process.env.LOG_LEVEL || 'info',
  rateLimitRequestsPerMinute: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE, 10) || 60,
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === 'true',
  healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT, 10) || 3000
};

// Rate limiter implementation
class RateLimiter {
  constructor(requestsPerMinute) {
    this.requestsPerMinute = requestsPerMinute;
    this.minIntervalMs = 60000 / requestsPerMinute;
    this.lastRequestTime = 0;
  }

  async wait() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - timeSinceLastRequest;
      await sleep(waitTime);
    }
    
    this.lastRequestTime = Date.now();
  }
}

// Logger
const logger = {
  debug: (...args) => CONFIG.logLevel === 'debug' && console.log(`[DEBUG] ${new Date().toISOString()}:`, ...args),
  info: (...args) => ['info', 'debug'].includes(CONFIG.logLevel) && console.log(`[INFO] ${new Date().toISOString()}:`, ...args),
  warn: (...args) => ['warn', 'info', 'debug'].includes(CONFIG.logLevel) && console.warn(`[WARN] ${new Date().toISOString()}:`, ...args),
  error: (...args) => console.error(`[ERROR] ${new Date().toISOString()}:`, ...args)
};

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Axios instance with defaults
const createAxiosInstance = (baseURL, apiKey) => {
  const headers = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  
  return axios.create({
    baseURL,
    timeout: CONFIG.requestTimeoutMs,
    headers
  });
};

// Fetch data from source API with retries
async function fetchFromSource() {
  logger.info("Fetching Jira stories...");

  const auth = Buffer.from(
      `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`
  ).toString("base64");

  const jql =
      `project=${process.env.JIRA_PROJECT} ` +
      `AND labels=ai-ready ` +
      `AND status="To Do"`;

  try {
    const response = await axios.post(
        `https://${process.env.JIRA_DOMAIN}/rest/api/3/search/jql`,
        {
          jql: jql,
          fields: ['summary', 'status', 'priority', 'assignee', 'labels', 'created', 'updated'],
          maxResults: 50
        },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
            'Content-Type': 'application/json'
          }
        }
    );

    const issues = response.data.issues || [];

    logger.info(`Found ${issues.length} Jira issues`);

    return issues;
  } catch (error) {
    if (error.response) {
      logger.error(`Jira API error: ${error.response.status} ${error.response.statusText}`);
      logger.error(`Jira response body: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

// Transform raw Jira issues into target payload format
function transformData(issues) {
  return issues.map(issue => ({
    key: issue.key,
    summary: issue.fields?.summary || '',
    status: issue.fields?.status?.name || '',
    priority: issue.fields?.priority?.name || '',
    assignee: issue.fields?.assignee?.displayName || null,
    labels: issue.fields?.labels || [],
    created: issue.fields?.created,
    updated: issue.fields?.updated
  }));
}

// Send transformed data to target API
async function sendToTarget(data) {
  const target = createAxiosInstance(CONFIG.targetApiUrl, CONFIG.targetApiKey);
  const response = await target.post('/post', { payload: data });
  logger.info(`Sent to target, status: ${response.status}`);
  return response.data;
}

// Main pipeline function
async function runPipeline() {
  const startTime = Date.now();
  logger.info("Starting Jira pipeline execution...");

  try {
    const issues = await fetchFromSource();
    const transformed = transformData(issues);

    transformed.forEach(item => {
      logger.info(`${item.key}: ${item.summary}`);
    });

    if (transformed.length > 0) {
      await sendToTarget(transformed);
    }

    return { success: true, count: transformed.length };
  } catch (error) {
    logger.error(error.message);
    return { success: false };
  }
}

// Schedule the pipeline
function schedulePipeline() {
  logger.info(`Scheduling pipeline with cron expression: ${CONFIG.cronSchedule}`);
  
  // Validate cron expression
  if (!cron.validate(CONFIG.cronSchedule)) {
    logger.error(`Invalid cron schedule: ${CONFIG.cronSchedule}`);
    process.exit(1);
  }
  
  const task = cron.schedule(CONFIG.cronSchedule, async () => {
    logger.info('Cron triggered pipeline execution');
    await runPipeline();
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  
  logger.info('Pipeline scheduled successfully');
  return task;
}

// Graceful shutdown
function setupGracefulShutdown(task) {
  const shutdown = (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    
    if (task) {
      task.stop();
      logger.info('Cron job stopped');
    }
    
    // Allow time for pending requests to complete
    setTimeout(() => {
      logger.info('Shutdown complete');
      process.exit(0);
    }, 1000);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Health check server (optional)
function startHealthCheckServer() {
  if (!CONFIG.enableHealthCheck) {
    return null;
  }
  
  const http = require('http');
  
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        config: {
          sourceApiUrl: CONFIG.sourceApiUrl,
          targetApiUrl: CONFIG.targetApiUrl,
          cronSchedule: CONFIG.cronSchedule
        }
      }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
  
  server.listen(CONFIG.healthCheckPort, () => {
    logger.info(`Health check server running on port ${CONFIG.healthCheckPort}`);
  });
  
  return server;
}

// Main execution
function main() {
  logger.info('=== Automated Data Pipeline Starting ===');
  logger.info('Configuration:', {
    sourceApiUrl: CONFIG.sourceApiUrl,
    targetApiUrl: CONFIG.targetApiUrl,
    cronSchedule: CONFIG.cronSchedule,
    maxRetries: CONFIG.maxRetries,
    requestTimeoutMs: CONFIG.requestTimeoutMs,
    logLevel: CONFIG.logLevel
  });
  
  // Run once immediately
  runPipeline().then(result => {
    if (result.success) {
      logger.info('Initial pipeline run completed successfully');
    } else {
      logger.error('Initial pipeline run failed:', result.error);
    }
  });
  
  // Schedule periodic runs
  const task = schedulePipeline();
  
  // Setup graceful shutdown
  setupGracefulShutdown(task);
  
  // Start health check server if enabled
  startHealthCheckServer();
}

// Run if executed directly
if (require.main === module) {
  main();
}

// Export for testing or external use
module.exports = {
  runPipeline,
  fetchFromSource,
  transformData,
  sendToTarget,
  CONFIG,
  logger,
  RateLimiter
};