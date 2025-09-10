// =====================================
// CLIENTE PARA API PUENTE VPS - RAILWAY INTEGRATION
// =====================================
// 
// Este módulo maneja la conexión con el VPS puente que tiene acceso
// a la base de datos MySQL del cliente vía VPN Sophos.
// 
// ARQUITECTURA:
// [Railway] → [VPS Bridge API] ⇄ [VPN Sophos] ⇄ [MySQL Cliente]
//
// CARACTERÍSTICAS:
// - Autenticación JWT automática
// - Retry automático con backoff exponencial
// - Cache de resultados
// - Fallback a datos mock en desarrollo
// - Logging detallado
// - Health checks periódicos
// =====================================

const axios = require('axios');
require('dotenv').config();

class VPSBridgeClient {
    constructor() {
        this.baseURL = process.env.VPS_BRIDGE_URL || 'https://mysql-bridge.tu-dominio.com';
        this.apiUser = process.env.VPS_BRIDGE_USER || 'api_user';
        this.apiPassword = process.env.VPS_BRIDGE_PASSWORD;
        this.token = null;
        this.tokenExpiry = null;
        this.retryCount = 3;
        this.retryDelay = 1000; // 1 segundo inicial
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutos
        this.healthCheckInterval = null;
        this.isHealthy = false;
        
        // Cliente HTTP con configuración optimizada
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000, // 30 segundos
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Railway-Deitana-App/1.0'
            }
        });

        // Interceptor para logging
        this.client.interceptors.request.use(
            (config) => {
                console.log(`🌉 [VPS-BRIDGE] ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                console.error('🚫 [VPS-BRIDGE] Request error:', error.message);
                return Promise.reject(error);
            }
        );

        this.client.interceptors.response.use(
            (response) => {
                console.log(`✅ [VPS-BRIDGE] ${response.status} ${response.config.url} - ${response.data?.executionTime || 0}ms`);
                return response;
            },
            (error) => {
                console.error(`❌ [VPS-BRIDGE] ${error.response?.status || 'Network Error'} ${error.config?.url}:`, error.message);
                return Promise.reject(error);
            }
        );

        // Inicializar health checks si estamos en producción
        if (process.env.NODE_ENV === 'production') {
            this.startHealthChecks();
        }
    }

    /**
     * Iniciar health checks periódicos
     */
    startHealthChecks() {
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.healthCheck();
                this.isHealthy = true;
            } catch (error) {
                this.isHealthy = false;
                console.error('💔 [VPS-BRIDGE] Health check failed:', error.message);
            }
        }, 60000); // Cada minuto
    }

    /**
     * Detener health checks
     */
    stopHealthChecks() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    /**
     * Health check del VPS bridge
     */
    async healthCheck() {
        const response = await this.client.get('/health');
        return response.data;
    }

    /**
     * Verificar si el token JWT sigue siendo válido
     */
    isTokenValid() {
        if (!this.token || !this.tokenExpiry) {
            return false;
        }
        // Renovar 5 minutos antes de la expiración
        return Date.now() < (this.tokenExpiry - 5 * 60 * 1000);
    }

    /**
     * Autenticarse con el VPS bridge y obtener token JWT
     */
    async authenticate() {
        try {
            console.log('🔐 [VPS-BRIDGE] Autenticando...');
            
            if (!this.apiPassword) {
                throw new Error('VPS_BRIDGE_PASSWORD no configurado');
            }

            const response = await this.client.post('/auth/token', {
                username: this.apiUser,
                password: this.apiPassword
            });

            this.token = response.data.token;
            
            // Calcular expiración basada en el JWT
            const tokenPayload = JSON.parse(Buffer.from(this.token.split('.')[1], 'base64').toString());
            this.tokenExpiry = tokenPayload.exp * 1000; // Convertir a milliseconds

            console.log('✅ [VPS-BRIDGE] Autenticación exitosa, token válido hasta:', new Date(this.tokenExpiry));
            
        } catch (error) {
            console.error('❌ [VPS-BRIDGE] Error de autenticación:', error.response?.data || error.message);
            throw new Error(`VPS Bridge authentication failed: ${error.message}`);
        }
    }

    /**
     * Obtener headers de autorización
     */
    getAuthHeaders() {
        if (!this.token) {
            throw new Error('No hay token disponible, debe autenticarse primero');
        }
        return {
            Authorization: `Bearer ${this.token}`
        };
    }

    /**
     * Ejecutar consulta SQL con reintentos y cache
     */
    async query(sql, params = [], useCache = true) {
        // Verificar autenticación
        if (!this.isTokenValid()) {
            await this.authenticate();
        }

        // Generar clave de cache
        const cacheKey = `${sql}:${JSON.stringify(params)}`;

        // Verificar cache si está habilitado
        if (useCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() < cached.expires) {
                console.log('💾 [VPS-BRIDGE] Cache hit');
                return {
                    ...cached.data,
                    cached: true,
                    cacheAge: Date.now() - cached.created
                };
            } else {
                this.cache.delete(cacheKey);
            }
        }

        // Ejecutar consulta con reintentos
        let lastError;
        for (let attempt = 1; attempt <= this.retryCount; attempt++) {
            try {
                console.log(`🔄 [VPS-BRIDGE] Intento ${attempt}/${this.retryCount}: Ejecutando consulta`);
                
                const response = await this.client.post('/api/query', {
                    sql,
                    params,
                    useCache
                }, {
                    headers: this.getAuthHeaders()
                });

                const result = response.data;

                // Guardar en cache si está habilitado
                if (useCache && result.success) {
                    this.cache.set(cacheKey, {
                        data: result,
                        created: Date.now(),
                        expires: Date.now() + this.cacheTTL
                    });
                }

                console.log(`✅ [VPS-BRIDGE] Consulta exitosa: ${result.rowCount} filas, ${result.executionTime}ms`);
                return result;

            } catch (error) {
                lastError = error;
                console.error(`❌ [VPS-BRIDGE] Intento ${attempt} falló:`, error.response?.data || error.message);

                // Si es error de autenticación, intentar renovar token
                if (error.response?.status === 401) {
                    console.log('🔐 [VPS-BRIDGE] Token expirado, renovando...');
                    this.token = null;
                    this.tokenExpiry = null;
                    
                    if (attempt < this.retryCount) {
                        await this.authenticate();
                        continue;
                    }
                }

                // Si no es el último intento, esperar antes de reintentar
                if (attempt < this.retryCount) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1); // Backoff exponencial
                    console.log(`⏳ [VPS-BRIDGE] Esperando ${delay}ms antes del siguiente intento...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // Si llegamos aquí, todos los intentos fallaron
        console.error('💥 [VPS-BRIDGE] Todos los intentos fallaron');
        throw new Error(`VPS Bridge query failed after ${this.retryCount} attempts: ${lastError.message}`);
    }

    /**
     * Obtener últimas actualizaciones (endpoint específico)
     */
    async getLatestUpdates() {
        if (!this.isTokenValid()) {
            await this.authenticate();
        }

        try {
            const response = await this.client.get('/api/data/latest-updates', {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('❌ [VPS-BRIDGE] Error obteniendo actualizaciones:', error.message);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de la base de datos
     */
    async getDatabaseStats() {
        if (!this.isTokenValid()) {
            await this.authenticate();
        }

        try {
            const response = await this.client.get('/api/stats/database', {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('❌ [VPS-BRIDGE] Error obteniendo estadísticas:', error.message);
            throw error;
        }
    }

    /**
     * Limpiar cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ [VPS-BRIDGE] Cache limpiado');
    }

    /**
     * Obtener información del cache
     */
    getCacheInfo() {
        const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
            key: key.substring(0, 50) + '...',
            created: new Date(value.created),
            expires: new Date(value.expires),
            size: JSON.stringify(value).length
        }));

        return {
            size: this.cache.size,
            entries: entries.slice(0, 10), // Solo mostrar primeras 10
            totalSize: entries.reduce((acc, entry) => acc + entry.size, 0)
        };
    }

    /**
     * Cerrar conexión y limpiar recursos
     */
    close() {
        this.stopHealthChecks();
        this.clearCache();
        this.token = null;
        this.tokenExpiry = null;
        console.log('🔌 [VPS-BRIDGE] Cliente cerrado');
    }
}

// Instancia singleton
let bridgeClient = null;

/**
 * Obtener instancia del cliente VPS Bridge
 */
function getBridgeClient() {
    if (!bridgeClient) {
        bridgeClient = new VPSBridgeClient();
    }
    return bridgeClient;
}

/**
 * Función de compatibilidad con el pool actual
 * Permite usar el mismo código existente
 */
async function executeViaVPS(sql, params = []) {
    try {
        const client = getBridgeClient();
        const result = await client.query(sql, params);
        
        if (!result.success) {
            throw new Error('VPS Bridge query failed');
        }

        // Retornar en formato compatible con mysql2
        return [result.data];
        
    } catch (error) {
        console.error('❌ [VPS-BRIDGE] Execute failed:', error.message);
        
        // En desarrollo, retornar array vacío en lugar de fallar
        if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ [VPS-BRIDGE] Retornando datos mock en desarrollo');
            return [[]];
        }
        
        throw error;
    }
}

module.exports = {
    VPSBridgeClient,
    getBridgeClient,
    executeViaVPS
};