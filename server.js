
/**
 * STFU GameGuardian Production Server
 * 
 * Production-ready Express server for detecting and logging game tampering attempts
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./deploy-config');
const https = require('https');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const compression = require('compression');
const winston = require('winston');
const { createLogger, format, transports } = winston;
require('winston-daily-rotate-file');

// Initialize express app
const app = express();
const PORT = config.port;

// Setup logger
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console({
      level: config.logs.consoleLevel
    }),
    new transports.DailyRotateFile({
      filename: path.join(logDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: config.logs.fileLevel,
      maxFiles: config.logs.rotationDays,
      zippedArchive: true
    })
  ]
});

// Initialize MongoDB with proper connection handling and retries
let db;
let mongoClient;
let isConnecting = false;
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectAttempts = 0;

async function connectToDatabase() {
  if (isConnecting) return;
  
  if (!config.database.enabled) {
    logger.info('Database integration disabled in configuration');
    return;
  }
  
  isConnecting = true;
  
  try {
    logger.info(`Connecting to MongoDB at ${config.database.url.replace(/\/\/([^:]+):[^@]+@/, '//***:***@')}`);
    mongoClient = await MongoClient.connect(config.database.url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      connectTimeoutMS: 10000,
    });
    
    db = mongoClient.db(config.database.name);
    
    // Create indexes for better query performance
    await db.collection('tampering_logs').createIndex({ serverTimestamp: -1 });
    await db.collection('players').createIndex({ playerId: 1 }, { unique: true });
    await db.collection('players').createIndex({ deviceId: 1 });
    await db.collection('sync_logs').createIndex({ playerId: 1 });
    await db.collection('sync_logs').createIndex({ timestamp: -1 });
    
    logger.info('Connected to MongoDB successfully');
    reconnectAttempts = 0;
    isConnecting = false;
  } catch (error) {
    isConnecting = false;
    reconnectAttempts++;
    
    logger.error(`MongoDB connection error (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}):`, error);
    
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      logger.info(`Retrying database connection in ${delay}ms...`);
      
      setTimeout(() => {
        connectToDatabase();
      }, delay);
    } else {
      logger.error(`Failed to connect to MongoDB after ${MAX_RECONNECT_ATTEMPTS} attempts`);
    }
  }
}

// Initial database connection
if (config.database.enabled) {
  connectToDatabase();
}

// Handle MongoDB disconnection and reconnection
process.on('SIGINT', async () => {
  if (mongoClient) {
    logger.info('Closing MongoDB connection');
    await mongoClient.close();
  }
  process.exit(0);
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

app.disable('x-powered-by');

// Enable CORS with configuration
app.use(cors({
  origin: config.security.corsOrigin,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
  maxAge: 86400
}));

// Enable compression
app.use(compression());

// Rate limiting to prevent DoS attacks
const limiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

// Apply rate limiting to all routes
app.use(limiter);

// Parse JSON bodies with increased limit for potential larger payloads
app.use(express.json({ 
  limit: '1mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).send({ error: 'Invalid JSON' });
      throw new Error('Invalid JSON');
    }
  }
}));

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Request logging middleware
app.use((req, res, next) => {
  // Mask sensitive data in URL paths for logging
  const maskedUrl = req.url.replace(/\/([\w-]+)\/([\w-]{8}).*/, '/$1/********');
  logger.info(`${req.method} ${maskedUrl} from ${req.ip}`);
  
  // Record response time
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    logger.debug(`${req.method} ${maskedUrl} completed with status ${statusCode} in ${duration}ms`);
    
    // Log slow responses
    if (duration > 1000) {
      logger.warn(`Slow response: ${req.method} ${maskedUrl} took ${duration}ms`);
    }
  });
  
  next();
});

// API key validation middleware with improved security
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== config.security.apiKey) {
    logger.warn(`Unauthorized access attempt from ${req.ip} with key: ${apiKey ? '(present but invalid)' : '(missing)'}`);
    
    // Add a small delay to slow down brute force attempts
    setTimeout(() => {
      return res.status(401).json({
        error: 'Unauthorized access'
      });
    }, 500);
    return;
  }
  
  next();
};

// Database check middleware
const checkDatabaseConnection = (req, res, next) => {
  if (!config.database.enabled) {
    return next();
  }
  
  if (!db) {
    // Try to reconnect if database was initially enabled
    if (!isConnecting) {
      connectToDatabase();
    }
    
    return res.status(503).json({ 
      error: 'Database service unavailable',
      retryAfter: '30'
    });
  }
  
  next();
};

// Endpoint for logging tampering attempts - production ready
app.post('/api/log-tampering', validateApiKey, (req, res) => {
  const tamperingData = req.body;
  
  // Validation
  if (!tamperingData || typeof tamperingData !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  
  // Add server timestamp and unique ID
  tamperingData.serverTimestamp = new Date().toISOString();
  tamperingData.id = uuidv4();
  
  // Sanitize and validate data
  const sanitizedData = {
    id: tamperingData.id,
    serverTimestamp: tamperingData.serverTimestamp,
    clientTimestamp: tamperingData.timestamp || new Date().toISOString(),
    severity: ['low', 'medium', 'high', 'critical'].includes(tamperingData.severity) 
      ? tamperingData.severity : 'unknown',
    type: typeof tamperingData.type === 'string' ? tamperingData.type.substring(0, 50) : 'unknown',
    deviceId: typeof tamperingData.deviceId === 'string' ? tamperingData.deviceId.substring(0, 100) : 'unknown',
    playerId: typeof tamperingData.playerId === 'string' ? tamperingData.playerId.substring(0, 100) : null,
    appVersion: typeof tamperingData.appVersion === 'string' ? tamperingData.appVersion.substring(0, 20) : null,
    details: tamperingData.details || {}
  };
  
  // Log tampering data
  logger.warn('Tampering attempt detected', {
    id: sanitizedData.id,
    severity: sanitizedData.severity,
    type: sanitizedData.type,
    deviceId: sanitizedData.deviceId
  });
  
  // Store in MongoDB if available
  if (db) {
    db.collection('tampering_logs').insertOne(sanitizedData)
      .then(() => {
        // If player ID is provided, increment their tampering counter
        if (sanitizedData.playerId) {
          return db.collection('players').updateOne(
            { playerId: sanitizedData.playerId },
            { 
              $inc: { tamperingAttempts: 1 },
              $push: { 
                tampering: { 
                  timestamp: sanitizedData.serverTimestamp, 
                  type: sanitizedData.type,
                  severity: sanitizedData.severity
                } 
              }
            }
          );
        }
      })
      .catch(err => logger.error('Error saving tampering log to database', err));
  }
  
  // Also log to file system for backup
  const today = new Date().toISOString().split('T')[0];
  const logFilePath = path.join(logsDir, `tampering-${today}.log`);
  
  const logEntry = JSON.stringify({
    timestamp: sanitizedData.serverTimestamp,
    id: sanitizedData.id,
    data: sanitizedData
  }) + '\n';
  
  fs.appendFile(logFilePath, logEntry, (err) => {
    if (err) {
      logger.error('Error writing to tampering log file', err);
    }
  });
  
  // Determine response based on severity
  if (sanitizedData.severity === 'critical') {
    return res.status(403).json({ 
      message: config.serverResponses.terminalMessage,
      action: 'ban',
      duration: config.serverResponses.banDuration,
      requestId: sanitizedData.id
    });
  } else {
    return res.status(200).json({ 
      message: config.serverResponses.warningMessage,
      action: 'warn',
      requestId: sanitizedData.id
    });
  }
});

// Register or update player data
app.post('/api/register-player', validateApiKey, checkDatabaseConnection, async (req, res) => {
  try {
    const { playerId, deviceId, initialData } = req.body;
    
    // Validate required fields
    if (!playerId || typeof playerId !== 'string' || playerId.length > 100) {
      return res.status(400).json({ error: 'Invalid player ID' });
    }
    
    if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 100) {
      return res.status(400).json({ error: 'Invalid device ID' });
    }
    
    // Sanitize initial data
    const safeInitialData = initialData && typeof initialData === 'object' 
      ? initialData 
      : {};
    
    try {
      // Check if player already exists
      const existingPlayer = await db.collection('players').findOne({ playerId });
      
      if (existingPlayer) {
        // Update existing player
        await db.collection('players').updateOne(
          { playerId },
          { 
            $set: { 
              lastSeen: new Date(),
              deviceId
            }
          }
        );
        
        logger.info(`Player updated: ${playerId}`);
        return res.status(200).json({ message: 'Player updated', playerId });
      } else {
        // Create new player
        const newPlayer = {
          playerId,
          deviceId,
          created: new Date(),
          lastSeen: new Date(),
          gameData: safeInitialData,
          tamperingAttempts: 0,
          isBanned: false
        };
        
        await db.collection('players').insertOne(newPlayer);
        
        logger.info(`New player registered: ${playerId}`);
        return res.status(201).json({ message: 'Player registered', playerId });
      }
    } catch (error) {
      logger.error('Database error registering player:', error);
      return res.status(500).json({ error: 'Failed to register player' });
    }
  } catch (error) {
    logger.error('Error in register-player endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Sync and verify game values
app.post('/api/sync-game-values', validateApiKey, checkDatabaseConnection, async (req, res) => {
  try {
    const { playerId, sessionId, gameValues, clientTimestamp, checksum } = req.body;
    
    // Validate required fields
    if (!playerId || typeof playerId !== 'string') {
      return res.status(400).json({ error: 'Invalid player ID' });
    }
    
    if (!gameValues || typeof gameValues !== 'object') {
      return res.status(400).json({ error: 'Invalid game values' });
    }
    
    try {
      // Get player record
      const player = await db.collection('players').findOne({ playerId });
      
      if (!player) {
        return res.status(404).json({ error: 'Player not found' });
      }
      
      if (player.isBanned) {
        return res.status(403).json({ error: 'Account suspended' });
      }
      
      // Verify the client-provided values
      const serverTimestamp = new Date();
      const verificationResult = await verifyGameValues(player, gameValues, clientTimestamp, checksum);
      
      if (!verificationResult.isValid) {
        // Increment tampering counter
        await db.collection('players').updateOne(
          { playerId },
          { 
            $inc: { tamperingAttempts: 1 },
            $push: { 
              tampering: { 
                timestamp: serverTimestamp, 
                invalidValues: true,
                reason: verificationResult.reason,
                sessionId
              } 
            }
          }
        );
        
        // Check if player should be banned
        const updatedPlayer = await db.collection('players').findOne({ playerId });
        if (updatedPlayer.tamperingAttempts >= config.protection.maxTamperingAttempts) {
          // Ban the player
          await db.collection('players').updateOne(
            { playerId },
            { $set: { isBanned: true, banTimestamp: serverTimestamp } }
          );
          
          logger.warn(`Player banned due to tampering: ${playerId}, reason: ${verificationResult.reason}`);
          return res.status(403).json({
            message: config.serverResponses.terminalMessage,
            action: 'ban',
            status: 'invalid'
          });
        }
        
        logger.warn(`Invalid game values detected for player: ${playerId}, reason: ${verificationResult.reason}`);
        return res.status(200).json({ 
          message: config.serverResponses.warningMessage,
          status: 'invalid',
          reason: verificationResult.reason,
          serverValues: player.gameData
        });
      }
      
      // If values valid, update player data
      const updatedData = {
        ...player.gameData,
        ...gameValues,
        _lastUpdated: serverTimestamp
      };
      
      await db.collection('players').updateOne(
        { playerId },
        { 
          $set: { 
            gameData: updatedData,
            lastSync: serverTimestamp
          }
        }
      );
      
      // Log successful sync
      await db.collection('sync_logs').insertOne({
        playerId,
        sessionId,
        timestamp: serverTimestamp,
        values: gameValues,
        status: 'success'
      });
      
      return res.status(200).json({
        status: 'valid',
        serverTimestamp: serverTimestamp.toISOString(),
        verifiedValues: updatedData
      });
      
    } catch (error) {
      logger.error('Database error syncing game values:', error);
      return res.status(500).json({ error: 'Failed to sync game values' });
    }
  } catch (error) {
    logger.error('Error in sync-game-values endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to verify game values
async function verifyGameValues(player, newValues, clientTimestamp, clientChecksum) {
  // If player has no previous data, we'll trust this first sync
  if (!player.gameData || Object.keys(player.gameData).length === 0) {
    return { isValid: true };
  }
  
  // Parse timestamps
  let clientTime;
  try {
    clientTime = new Date(clientTimestamp);
    if (isNaN(clientTime.getTime())) {
      return { isValid: false, reason: "Invalid client timestamp" };
    }
  } catch (e) {
    return { isValid: false, reason: "Invalid client timestamp format" };
  }
  
  const lastSyncTime = new Date(player.lastSync || player.created);
  
  // Validate timestamp is not in the future (allowing small clock differences)
  const currentTime = new Date();
  if (clientTime > new Date(currentTime.getTime() + 5 * 60 * 1000)) { // 5 minutes in the future
    return { isValid: false, reason: "Client timestamp is too far in the future" };
  }
  
  // Calculate time difference in minutes since last sync
  const timeDiffMinutes = Math.max(0, (clientTime - lastSyncTime) / 60000);
  
  // Check health (should never increase beyond max without powerups)
  if (newValues.health !== undefined && player.gameData.health !== undefined) {
    const maxHealth = player.gameData.maxHealth || 100;
    
    if (newValues.health > maxHealth && 
        !newValues.powerups?.includes('health')) {
      return { isValid: false, reason: "Health exceeds maximum allowed value" };
    }
    
    // Check for impossible health regeneration
    const maxRegen = player.gameData.healthRegenRate || 5; // health points per minute
    const maxPossibleHealthIncrease = maxRegen * timeDiffMinutes;
    
    // Only apply this check if health is increasing and player wasn't at full health
    if (newValues.health > player.gameData.health && 
        player.gameData.health < maxHealth &&
        newValues.health > player.gameData.health + maxPossibleHealthIncrease && 
        !newValues.powerups?.includes('health')) {
      return { 
        isValid: false, 
        reason: `Health increased too fast (${newValues.health - player.gameData.health} in ${timeDiffMinutes.toFixed(2)} minutes)` 
      };
    }
  }
  
  // Check coins/currency (shouldn't have impossible increases)
  if (newValues.coins !== undefined && player.gameData.coins !== undefined) {
    const maxPossibleIncrease = config.gameRules.maxCoinsPerMinute * timeDiffMinutes;
    
    if (newValues.coins > player.gameData.coins + maxPossibleIncrease) {
      return { 
        isValid: false, 
        reason: `Coins increased too fast (${newValues.coins - player.gameData.coins} in ${timeDiffMinutes.toFixed(2)} minutes)` 
      };
    }
  }
  
  // Check experience points (shouldn't increase too fast)
  if (newValues.xp !== undefined && player.gameData.xp !== undefined) {
    const maxPossibleXP = config.gameRules.maxXpPerMinute * timeDiffMinutes;
    
    if (newValues.xp > player.gameData.xp + maxPossibleXP) {
      return { 
        isValid: false, 
        reason: `XP increased too fast (${newValues.xp - player.gameData.xp} in ${timeDiffMinutes.toFixed(2)} minutes)` 
      };
    }
  }
  
  // Add your game-specific validation rules here
  
  return { isValid: true };
}

// Management API route to retrieve recent logs
app.get('/api/management/logs', validateApiKey, checkDatabaseConnection, async (req, res) => {
  try {
    const days = parseInt(req.query.days || '1');
    const maxDays = 30; // Limit to prevent excessive requests
    
    if (days < 1 || days > maxDays) {
      return res.status(400).json({ error: `Days parameter must be between 1 and ${maxDays}` });
    }
    
    let logs = [];
    
    // If database is available, use it as primary source
    if (db) {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        logs = await db.collection('tampering_logs')
          .find({ serverTimestamp: { $gte: cutoffDate.toISOString() } })
          .sort({ serverTimestamp: -1 })
          .limit(1000)
          .toArray();
          
      } catch (dbError) {
        logger.error('Database error retrieving logs:', dbError);
        // Fall back to file-based logs if database query fails
        logs = await getLogsFromFiles(days);
      }
    } else {
      // Fallback to file-based logs
      logs = await getLogsFromFiles(days);
    }
    
    return res.json({ logs });
  } catch (error) {
    logger.error('Error retrieving logs:', error);
    return res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

// Helper function to get logs from files
async function getLogsFromFiles(days) {
  const logs = [];
  const today = new Date();
  
  // Collect logs from requested days
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const logFilePath = path.join(logsDir, `tampering-${dateStr}.log`);
    
    if (fs.existsSync(logFilePath)) {
      try {
        const fileContent = fs.readFileSync(logFilePath, 'utf8');
        const fileLines = fileContent.trim().split('\n');
        for (const line of fileLines) {
          try {
            logs.push(JSON.parse(line));
          } catch (e) {
            logger.error('Error parsing log line:', e);
          }
        }
      } catch (error) {
        logger.error(`Error reading log file ${logFilePath}:`, error);
      }
    }
  }
  
  return logs;
}

// Get player statistics
app.get('/api/management/player/:playerId', validateApiKey, checkDatabaseConnection, async (req, res) => {
  try {
    const { playerId } = req.params;
    
    if (!playerId || typeof playerId !== 'string') {
      return res.status(400).json({ error: 'Invalid player ID' });
    }
    
    try {
      const player = await db.collection('players').findOne({ playerId });
      
      if (!player) {
        return res.status(404).json({ error: 'Player not found' });
      }
      
      // Get tampering logs for this player
      const tamperingLogs = await db.collection('tampering_logs')
        .find({ playerId: player.playerId })
        .sort({ serverTimestamp: -1 })
        .limit(100)
        .toArray();
      
      // Get sync logs for this player
      const syncLogs = await db.collection('sync_logs')
        .find({ playerId })
        .sort({ timestamp: -1 })
        .limit(20)
        .toArray();
      
      // Prepare sanitized response (remove sensitive data)
      const playerData = {
        playerId: player.playerId,
        created: player.created,
        lastSeen: player.lastSeen,
        gameData: player.gameData,
        tamperingAttempts: player.tamperingAttempts,
        isBanned: player.isBanned,
        banTimestamp: player.banTimestamp
      };
      
      return res.json({ 
        player: playerData,
        tampering: tamperingLogs,
        syncs: syncLogs
      });
      
    } catch (error) {
      logger.error('Database error retrieving player data:', error);
      return res.status(500).json({ error: 'Failed to retrieve player data' });
    }
  } catch (error) {
    logger.error('Error in player endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: db ? 'connected' : 'disconnected'
    }
  };
  
  if (!db && config.database.enabled) {
    status.status = 'degraded';
  }
  
  res.status(200).json(status);
});

// Start the server
let server;

if (config.environment === 'production' && config.security.sslEnabled) {
  // Use HTTPS in production
  try {
    const privateKey = fs.readFileSync(config.security.sslKeyPath, 'utf8');
    const certificate = fs.readFileSync(config.security.sslCertPath, 'utf8');
    const credentials = { key: privateKey, cert: certificate };
    
    server = https.createServer(credentials, app);
  } catch (error) {
    logger.error('Failed to load SSL certificates:', error);
    logger.info('Falling back to HTTP server (not recommended for production)');
    server = app;
  }
} else {
  server = app;
}

server.listen(PORT, () => {
  logger.info(`Game Guardian Shield server running on ${config.environment} mode`);
  logger.info(`Server listening on port ${PORT}`);
  logger.info(`Protection settings: Check interval ${config.protection.checkInterval}ms`);
  logger.info(`API endpoint: ${config.environment === 'production' && config.security.sslEnabled ? 'https' : 'http'}://[your-domain]${PORT === 80 || PORT === 443 ? '' : ':' + PORT}/api/log-tampering`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing server');
  
  server.close(async () => {
    logger.info('Server closed');
    
    // Close MongoDB connection if open
    if (mongoClient) {
      logger.info('Closing MongoDB connection');
      await mongoClient.close();
    }
    
    process.exit(0);
  });
  
  // Force shutdown after 10s if graceful shutdown fails
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  
  // Keep the process running for non-critical errors
  if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
    logger.warn(`Non-fatal connection error: ${error.code}`);
  } else {
    // Exit for critical errors to allow process manager to restart
    logger.error('Critical error, exiting process');
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection:', reason);
});
