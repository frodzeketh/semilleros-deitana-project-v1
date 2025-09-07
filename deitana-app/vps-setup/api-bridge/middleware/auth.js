const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      logger.warn('Missing authorization header', { ip: req.ip, url: req.url });
      return res.status(401).json({
        error: 'Token de autorización requerido',
        code: 'MISSING_AUTH_HEADER'
      });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      logger.warn('Missing token in authorization header', { ip: req.ip });
      return res.status(401).json({
        error: 'Token de autorización inválido',
        code: 'MISSING_TOKEN'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar que el token no haya expirado
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      logger.warn('Expired token used', { username: decoded.username, ip: req.ip });
      return res.status(401).json({
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Agregar información del usuario a la request
    req.user = {
      username: decoded.username,
      role: decoded.role,
      tokenExp: decoded.exp
    };

    logger.debug('Authentication successful', { 
      username: decoded.username, 
      role: decoded.role,
      ip: req.ip 
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid JWT token', { 
        error: error.message, 
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(401).json({
        error: 'Token de autorización inválido',
        code: 'INVALID_TOKEN'
      });
    }

    if (error.name === 'TokenExpiredError') {
      logger.warn('Expired JWT token', { ip: req.ip });
      return res.status(401).json({
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }

    logger.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Error interno de autenticación',
      code: 'AUTH_ERROR'
    });
  }
};

module.exports = authMiddleware;
