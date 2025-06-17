
// Production configuration file for server deployment

/**
 * Server deployment configuration for the STFU GameGuardian
 * 
 * Production-ready configuration for deploying the anti-cheat system to a server environment
 */
const deployConfig = {
  // Environment settings
  environment: process.env.NODE_ENV || 'production',
  port: process.env.PORT || 443,
  
  // Security settings
  security: {
    // API key for authentication (CHANGE THIS TO A SECURE VALUE IN PRODUCTION!)
    apiKey: process.env.API_KEY || 'change-me-in-production',
    
    // SSL configuration
    sslEnabled: process.env.SSL_ENABLED === 'true' || true,
    sslKeyPath: process.env.SSL_KEY_PATH || '/etc/ssl/private/privkey.pem',
    sslCertPath: process.env.SSL_CERT_PATH || '/etc/ssl/certs/fullchain.pem',
    
    // CORS settings
    corsOrigin: process.env.CORS_ORIGIN || '*',
    
    // Rate limiting
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX) || 100 // Limit each IP to 100 requests per `windowMs`
    }
  },
  
  // Database settings
  database: {
    enabled: process.env.DB_ENABLED === 'true' || true,
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017/stfugg',
    name: process.env.DB_NAME || 'stfugg',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  
  // Game rules for value verification
  gameRules: {
    maxCoinsPerMinute: parseInt(process.env.MAX_COINS_PER_MINUTE) || 1000,
    maxXpPerMinute: parseInt(process.env.MAX_XP_PER_MINUTE) || 500,
    suspiciousHealthChange: process.env.SUSPICIOUS_HEALTH_CHANGE === 'true' || true,
    maxHealthRegenRate: parseInt(process.env.MAX_HEALTH_REGEN_RATE) || 10, // Health points per minute
    maxDamageRate: parseInt(process.env.MAX_DAMAGE_RATE) || 1000, // Maximum damage per minute
    maxItemsPerMinute: parseInt(process.env.MAX_ITEMS_PER_MINUTE) || 60, // Items per minute
  },
  
  // Protection settings
  protection: {
    // Default server endpoint for logging tampering attempts
    serverLogEndpoint: process.env.TAMPERING_LOG_ENDPOINT || '/api/log-tampering',
    
    // Production protection settings
    obfuscationEnabled: process.env.OBFUSCATION_ENABLED === 'false' ? false : true,
    encryptionEnabled: process.env.ENCRYPTION_ENABLED === 'false' ? false : true,
    maxTamperingAttempts: parseInt(process.env.MAX_TAMPERING_ATTEMPTS) || 3,
    
    // Check interval in milliseconds
    checkInterval: parseInt(process.env.CHECK_INTERVAL) || 1000,
    
    // App validation settings
    validateAppSignature: process.env.VALIDATE_APP_SIGNATURE === 'false' ? false : true,
    allowEmulator: process.env.ALLOW_EMULATOR === 'true' || false,
    allowRootedDevices: process.env.ALLOW_ROOTED_DEVICES === 'true' || false,
    
    // Server sync interval (minimum time between syncs in milliseconds)
    minSyncInterval: parseInt(process.env.MIN_SYNC_INTERVAL) || 5000,
    
    // Session validation
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 3600000, // 1 hour in milliseconds
  },
  
  // Server response settings for tampering detection
  serverResponses: {
    warningMessage: process.env.WARNING_MESSAGE || 'Security violation detected.',
    terminalMessage: process.env.TERMINAL_MESSAGE || 'Your access has been suspended due to security violations.',
    banDuration: parseInt(process.env.BAN_DURATION) || 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  },
  
  // Logging configuration
  logs: {
    // Log rotation
    rotationDays: parseInt(process.env.LOG_ROTATION_DAYS) || 30, // Keep logs for 30 days
    
    // Log levels
    consoleLevel: process.env.CONSOLE_LOG_LEVEL || 'info',
    fileLevel: process.env.FILE_LOG_LEVEL || 'debug',
    
    // Monitoring alert threshold
    criticalAlertsThreshold: parseInt(process.env.CRITICAL_ALERTS_THRESHOLD) || 10 // Send alert after 10 critical incidents
  }
};

module.exports = deployConfig;
