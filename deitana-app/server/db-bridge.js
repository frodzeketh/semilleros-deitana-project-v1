// =====================================
// NUEVO SISTEMA DE BASE DE DATOS - VPS BRIDGE
// =====================================
// 
// Este archivo reemplaza la conexión directa a MySQL con el sistema
// de puente VPS que accede a la base de datos del cliente vía Sophos VPN.
// 
// MIGRACIÓN GRADUAL:
// 1. Se mantiene compatibilidad con el código existente
// 2. Se puede alternar entre conexión directa y VPS bridge
// 3. Fallback automático en caso de fallas
// =====================================

const mysql = require('mysql2/promise');
const { executeViaVPS, getBridgeClient } = require('./vps-bridge-client');
require('dotenv').config();

// Configuración del modo de operación
const USE_VPS_BRIDGE = process.env.USE_VPS_BRIDGE === 'true';
const FALLBACK_TO_DIRECT = process.env.FALLBACK_TO_DIRECT === 'true';

console.log('🔧 [DB-BRIDGE] Configuración:');
console.log(`   - Usar VPS Bridge: ${USE_VPS_BRIDGE}`);
console.log(`   - Fallback directo: ${FALLBACK_TO_DIRECT}`);

// Pool de conexión directa (para fallback)
let directPool = null;

if (FALLBACK_TO_DIRECT || !USE_VPS_BRIDGE) {
    console.log('🔌 [DB-BRIDGE] Configurando pool de conexión directa...');
    
    directPool = mysql.createPool({
        host: process.env.DB_HOST || 'centerbeam.proxy.rlwy.net',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'gbrIerodvEYzzDQbgtlQjelgLaLlgPuf',
        database: process.env.DB_NAME || 'railway',
        port: parseInt(process.env.DB_PORT) || 32877,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        acquireTimeout: 60000,
        timeout: 60000
    });

    // Test de conexión directa
    if (!USE_VPS_BRIDGE) {
        directPool.getConnection()
            .then(connection => {
                console.log('✅ [DB-BRIDGE] Conexión directa exitosa');
                connection.release();
            })
            .catch(err => {
                console.error('❌ [DB-BRIDGE] Error conexión directa:', err.message);
            });
    }
}

/**
 * Ejecutar consulta con el método configurado
 */
async function query(sql, params = []) {
    const startTime = Date.now();
    
    try {
        let result;
        
        if (USE_VPS_BRIDGE) {
            console.log('🌉 [DB-BRIDGE] Ejecutando vía VPS Bridge...');
            result = await executeViaVPS(sql, params);
        } else {
            console.log('🔗 [DB-BRIDGE] Ejecutando vía conexión directa...');
            result = await directPool.query(sql, params);
        }
        
        const executionTime = Date.now() - startTime;
        console.log(`✅ [DB-BRIDGE] Consulta completada en ${executionTime}ms`);
        
        return result;
        
    } catch (error) {
        const executionTime = Date.now() - startTime;
        console.error(`❌ [DB-BRIDGE] Error en consulta (${executionTime}ms):`, error.message);
        
        // Intentar fallback si está habilitado
        if (USE_VPS_BRIDGE && FALLBACK_TO_DIRECT && directPool) {
            console.log('🔄 [DB-BRIDGE] Intentando fallback a conexión directa...');
            try {
                const fallbackResult = await directPool.query(sql, params);
                const fallbackTime = Date.now() - startTime;
                console.log(`✅ [DB-BRIDGE] Fallback exitoso en ${fallbackTime}ms`);
                return fallbackResult;
            } catch (fallbackError) {
                console.error('❌ [DB-BRIDGE] Fallback también falló:', fallbackError.message);
            }
        }
        
        throw error;
    }
}

/**
 * Obtener conexión (para compatibilidad)
 */
async function getConnection() {
    if (USE_VPS_BRIDGE) {
        // Para VPS Bridge, retornar un objeto que simule una conexión
        return {
            query: query,
            release: () => {
                // No-op para VPS Bridge
            },
            execute: query
        };
    } else {
        return await directPool.getConnection();
    }
}

/**
 * Función específica para obtener estadísticas del VPS Bridge
 */
async function getVPSBridgeStats() {
    if (!USE_VPS_BRIDGE) {
        throw new Error('VPS Bridge no está habilitado');
    }
    
    try {
        const client = getBridgeClient();
        
        // Obtener estadísticas del cliente
        const cacheInfo = client.getCacheInfo();
        const healthStatus = client.isHealthy;
        
        // Obtener estadísticas de la base de datos
        let dbStats = null;
        try {
            dbStats = await client.getDatabaseStats();
        } catch (error) {
            console.warn('⚠️ [DB-BRIDGE] No se pudieron obtener estadísticas de DB:', error.message);
        }
        
        return {
            bridge: {
                healthy: healthStatus,
                baseURL: client.baseURL,
                tokenValid: client.isTokenValid(),
                cache: cacheInfo
            },
            database: dbStats?.data || null
        };
        
    } catch (error) {
        console.error('❌ [DB-BRIDGE] Error obteniendo estadísticas VPS:', error.message);
        throw error;
    }
}

/**
 * Función para obtener últimas actualizaciones vía VPS Bridge
 */
async function getLatestUpdates() {
    if (!USE_VPS_BRIDGE) {
        throw new Error('VPS Bridge no está habilitado');
    }
    
    try {
        const client = getBridgeClient();
        return await client.getLatestUpdates();
    } catch (error) {
        console.error('❌ [DB-BRIDGE] Error obteniendo actualizaciones:', error.message);
        throw error;
    }
}

/**
 * Cerrar todas las conexiones
 */
async function close() {
    console.log('🔌 [DB-BRIDGE] Cerrando conexiones...');
    
    if (USE_VPS_BRIDGE) {
        const client = getBridgeClient();
        client.close();
    }
    
    if (directPool) {
        await directPool.end();
        console.log('✅ [DB-BRIDGE] Pool directo cerrado');
    }
}

// Objeto de compatibilidad con el pool existente
const bridgePool = {
    query,
    getConnection,
    end: close,
    
    // Funciones específicas del VPS Bridge
    getVPSBridgeStats,
    getLatestUpdates,
    
    // Información de configuración
    isUsingBridge: () => USE_VPS_BRIDGE,
    canFallback: () => FALLBACK_TO_DIRECT && directPool !== null
};

// Manejo de cierre graceful
process.on('SIGINT', close);
process.on('SIGTERM', close);

module.exports = bridgePool;
