const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Configuración de rotación diaria para logs de aplicación
const dailyRotateFileTransport = new DailyRotateFile({
  filename: '/var/log/mysql-bridge/application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: process.env.LOG_MAX_SIZE || '20m',
  maxFiles: process.env.LOG_MAX_FILES || '30d',
  createSymlink: true,
  symlinkName: 'application-current.log'
});

// Configuración de rotación diaria para logs de errores
const errorRotateFileTransport = new DailyRotateFile({
  level: 'error',
  filename: '/var/log/mysql-bridge/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: process.env.LOG_MAX_SIZE || '20m',
  maxFiles: process.env.LOG_MAX_FILES || '30d',
  createSymlink: true,
  symlinkName: 'error-current.log'
});

// Configuración de rotación diaria para logs de acceso
const accessRotateFileTransport = new DailyRotateFile({
  level: 'info',
  filename: '/var/log/mysql-bridge/access-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: process.env.LOG_MAX_SIZE || '20m',
  maxFiles: process.env.LOG_MAX_FILES || '30d',
  createSymlink: true,
  symlinkName: 'access-current.log',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      if (meta.method && meta.url && meta.status) {
        return `${timestamp} ${level}: ${meta.method} ${meta.url} - ${meta.status} - ${meta.duration}ms - ${meta.ip}`;
      }
      return `${timestamp} ${level}: ${message}`;
    })
  )
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'mysql-bridge-api' },
  transports: [
    dailyRotateFileTransport,
    errorRotateFileTransport,
    accessRotateFileTransport
  ],
});

// En desarrollo, también loguear a consola
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
      })
    )
  }));
}

// Manejar eventos de rotación
dailyRotateFileTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info('Log file rotated', { oldFilename, newFilename });
});

errorRotateFileTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info('Error log file rotated', { oldFilename, newFilename });
});

accessRotateFileTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info('Access log file rotated', { oldFilename, newFilename });
});

// Función para crear directorio de logs si no existe
const fs = require('fs');
const path = require('path');

const logDir = '/var/log/mysql-bridge';
if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    console.log(`Log directory created: ${logDir}`);
  } catch (error) {
    console.error(`Failed to create log directory: ${error.message}`);
    // Fallback a logs locales si no se puede crear /var/log
    logger.configure({
      transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console()
      ]
    });
  }
}

module.exports = logger;
