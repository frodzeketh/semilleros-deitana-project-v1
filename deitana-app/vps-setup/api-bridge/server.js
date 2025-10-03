const express = require('express');
const mysql = require('mysql2/promise');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const compression = require('compression');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const logger = require('./utils/logger');
const auth = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Compresión
app.use(compression());

// CORS configurado
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Middleware de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Pool de conexiones MySQL
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  reconnect: true
});

// Cache simple en memoria
const cache = new Map();
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 5 * 60 * 1000; // 5 minutos

// Función para limpiar cache expirado
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now > value.expires) {
      cache.delete(key);
    }
  }
}

// Limpiar cache cada 5 minutos
setInterval(cleanExpiredCache, 5 * 60 * 1000);

// Middleware de logging
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`, {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });
  
  next();
});

// Health check endpoint (sin autenticación)
app.get('/health', async (req, res) => {
  try {
    // Verificar conexión a MySQL
    const connection = await pool.getConnection();
    await connection.execute('SELECT 1');
    connection.release();
    
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024)
      },
      cache: {
        size: cache.size
      },
      mysql: 'connected'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

// Endpoint para generar token JWT (para testing)
app.post('/auth/token', [
  body('username').notEmpty().withMessage('Username es requerido'),
  body('password').notEmpty().withMessage('Password es requerido')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;
    
    // Validación simple (en producción usar hash y base de datos)
    if (username === 'api_user' && password === process.env.API_PASSWORD) {
      const token = jwt.sign(
        { username, role: 'api_access' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );
      
      logger.info('Token generated for user:', username);
      res.json({ token, expiresIn: process.env.JWT_EXPIRES_IN });
    } else {
      logger.warn('Failed login attempt:', { username, ip: req.ip });
      res.status(401).json({ error: 'Credenciales inválidas' });
    }
  } catch (error) {
    logger.error('Error generating token:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Middleware de autenticación para endpoints protegidos
app.use('/api', auth);

// Endpoint principal para consultas SQL
app.post('/api/query', [
  body('sql').notEmpty().withMessage('SQL query es requerida'),
  body('params').optional().isArray().withMessage('Params debe ser un array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { sql, params = [], useCache = true } = req.body;
    
    // Validar consultas SQL (permitir SELECT, pero evitar DROP, DELETE sin WHERE, etc.)
    const trimmedSql = sql.trim().toLowerCase();
    
    // Lista de comandos peligrosos que NO se permiten
    const dangerousCommands = ['drop', 'delete', 'truncate', 'create', 'alter', 'insert', 'update'];
    const hasDangerousCommand = dangerousCommands.some(cmd => trimmedSql.includes(cmd));
    
    if (hasDangerousCommand) {
      return res.status(400).json({
        error: `Comando SQL no permitido: ${dangerousCommands.find(cmd => trimmedSql.includes(cmd))}`,
        code: 'DANGEROUS_COMMAND'
      });
    }
    
    // Permitir SELECT y otras consultas seguras
    const allowedCommands = ['select', 'show', 'describe', 'explain', 'with'];
    const hasAllowedCommand = allowedCommands.some(cmd => trimmedSql.startsWith(cmd));
    
    if (!hasAllowedCommand && trimmedSql.length > 10) {
      return res.status(400).json({
        error: 'Consulta SQL no reconocida o no permitida',
        code: 'INVALID_QUERY_TYPE'
      });
    }

    // Generar clave de cache
    const cacheKey = `${sql}:${JSON.stringify(params)}`;
    
    // Verificar cache si está habilitado
    if (useCache && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() < cached.expires) {
        logger.info('Cache hit for query');
        return res.json({
          ...cached.data,
          cached: true,
          cacheAge: Date.now() - cached.created
        });
      } else {
        cache.delete(cacheKey);
      }
    }

    const startTime = Date.now();
    const [rows, fields] = await pool.execute(sql, params);
    const executionTime = Date.now() - startTime;

    const result = {
      success: true,
      data: rows,
      rowCount: Array.isArray(rows) ? rows.length : 0,
      executionTime,
      cached: false,
      timestamp: new Date().toISOString()
    };

    // Guardar en cache si está habilitado
    if (useCache) {
      cache.set(cacheKey, {
        data: result,
        created: Date.now(),
        expires: Date.now() + CACHE_TTL
      });
    }

    logger.info(`Query executed successfully: ${executionTime}ms, ${result.rowCount} rows`);
    res.json(result);

  } catch (error) {
    logger.error('Query execution error:', {
      error: error.message,
      code: error.code,
      sql: req.body.sql
    });
    
    res.status(500).json({
      error: 'Error ejecutando consulta',
      code: error.code || 'QUERY_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Endpoint para consultas específicas del negocio
app.get('/api/data/latest-updates', auth, async (req, res) => {
  try {
    const cacheKey = 'latest_updates';
    
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() < cached.expires) {
        return res.json({ ...cached.data, cached: true });
      }
    }

    // Aquí adaptas según tu esquema de base de datos
    const [rows] = await pool.execute(`
      SELECT 
        COUNT(*) as total_records,
        MAX(updated_at) as last_update,
        DATE(MAX(updated_at)) as last_update_date
      FROM tu_tabla_principal 
      WHERE updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    const result = {
      success: true,
      data: rows[0],
      cached: false,
      timestamp: new Date().toISOString()
    };

    cache.set(cacheKey, {
      data: result,
      created: Date.now(),
      expires: Date.now() + CACHE_TTL
    });

    res.json(result);
    
  } catch (error) {
    logger.error('Error getting latest updates:', error);
    res.status(500).json({
      error: 'Error obteniendo actualizaciones',
      code: 'DATA_ERROR'
    });
  }
});

// Endpoint para estadísticas de la base de datos
app.get('/api/stats/database', auth, async (req, res) => {
  try {
    const [tableStats] = await pool.execute(`
      SELECT 
        TABLE_NAME as table_name,
        TABLE_ROWS as row_count,
        ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) as size_mb
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
      LIMIT 20
    `, [process.env.MYSQL_DATABASE]);

    res.json({
      success: true,
      data: {
        tables: tableStats
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error getting database stats:', error);
    res.status(500).json({
      error: 'Error obteniendo estadísticas',
      code: 'STATS_ERROR'
    });
  }
});

// Middleware de manejo de errores
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Error interno del servidor',
    code: 'INTERNAL_ERROR'
  });
});

// Endpoint 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    code: 'NOT_FOUND',
    path: req.originalUrl
  });
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  
  try {
    await pool.end();
    logger.info('MySQL pool closed');
  } catch (error) {
    logger.error('Error closing MySQL pool:', error);
  }
  
  process.exit(0);
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 API Bridge servidor iniciado en puerto ${PORT}`);
  logger.info(`📊 Health check disponible en: http://localhost:${PORT}/health`);
  logger.info(`🔒 Endpoints protegidos: /api/*`);
  
  // Test inicial de conexión a MySQL
  pool.getConnection()
    .then(connection => {
      logger.info('✅ Conexión inicial a MySQL exitosa');
      connection.release();
    })
    .catch(error => {
      logger.error('❌ Error en conexión inicial a MySQL:', error.message);
    });
});

module.exports = app;
