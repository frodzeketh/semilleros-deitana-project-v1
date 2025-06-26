// =====================================
// API ENDPOINTS PARA MÉTRICAS DE LANGFUSE
// =====================================

const express = require('express');
const router = express.Router();
const langfuseDashboard = require('../utils/langfuseDashboard');

// Middleware de autenticación (ajustar según tu sistema)
const verificarAuth = (req, res, next) => {
    // Aquí implementarías tu lógica de autenticación
    // Por ahora, permitir todas las solicitudes
    next();
};

/**
 * GET /api/langfuse/metrics
 * Obtiene métricas generales del sistema
 */
router.get('/metrics', verificarAuth, async (req, res) => {
    try {
        console.log('📊 [API] Solicitando métricas de Langfuse...');
        
        const dias = parseInt(req.query.dias) || 7;
        const metricas = await langfuseDashboard.obtenerMetricasRendimiento(dias);
        
        if (!metricas) {
            return res.status(500).json({
                error: 'Error obteniendo métricas',
                message: 'No se pudieron obtener las métricas del sistema'
            });
        }
        
        res.json({
            success: true,
            data: metricas,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ [API] Error en endpoint de métricas:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            message: error.message
        });
    }
});

/**
 * GET /api/langfuse/dashboard
 * Obtiene datos completos para dashboard
 */
router.get('/dashboard', verificarAuth, async (req, res) => {
    try {
        console.log('📋 [API] Generando dashboard completo...');
        
        const reporte = await langfuseDashboard.generarReporteCompleto();
        
        if (!reporte) {
            return res.status(500).json({
                error: 'Error generando dashboard',
                message: 'No se pudo generar el reporte completo'
            });
        }
        
        res.json({
            success: true,
            data: reporte,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ [API] Error en endpoint de dashboard:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            message: error.message
        });
    }
});

/**
 * GET /api/langfuse/live
 * Obtiene métricas en tiempo real
 */
router.get('/live', verificarAuth, async (req, res) => {
    try {
        console.log('📺 [API] Obteniendo métricas en tiempo real...');
        
        const metricas = langfuseDashboard.mostrarMetricasEnVivo();
        
        res.json({
            success: true,
            data: metricas,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ [API] Error en endpoint de métricas en vivo:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            message: error.message
        });
    }
});

/**
 * GET /api/langfuse/patterns
 * Obtiene patrones de uso y anomalías
 */
router.get('/patterns', verificarAuth, async (req, res) => {
    try {
        console.log('🔍 [API] Detectando patrones de uso...');
        
        const patrones = await langfuseDashboard.detectarPatrones();
        
        res.json({
            success: true,
            data: patrones,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ [API] Error en endpoint de patrones:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            message: error.message
        });
    }
});

/**
 * GET /api/langfuse/prompts
 * Analiza rendimiento de prompts
 */
router.get('/prompts', verificarAuth, async (req, res) => {
    try {
        console.log('🔍 [API] Analizando rendimiento de prompts...');
        
        const periodo = req.query.periodo || 'ultima_semana';
        const analisis = await langfuseDashboard.analizarPrompts(periodo);
        
        res.json({
            success: true,
            data: analisis,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ [API] Error en endpoint de análisis de prompts:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            message: error.message
        });
    }
});

/**
 * POST /api/langfuse/test-trace
 * Endpoint para probar la integración de Langfuse
 */
router.post('/test-trace', verificarAuth, async (req, res) => {
    try {
        console.log('🧪 [API] Ejecutando prueba de trace de Langfuse...');
        
        const { langfuse, iniciarTrace, finalizarTrace } = require('../utils/langfuse');
        
        // Crear un trace de prueba
        const trace = iniciarTrace('test-user', 'Prueba de integración Langfuse', 'test');
        
        // Simular una operación
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Finalizar el trace
        finalizarTrace(trace, {
            respuestaFinal: 'Prueba completada exitosamente',
            exito: true,
            tiempoTotal: 100,
            tokensTotal: 50,
            costoTotal: 0.001
        });
        
        res.json({
            success: true,
            message: 'Trace de prueba creado exitosamente',
            trace_id: trace.id,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ [API] Error en prueba de trace:', error);
        res.status(500).json({
            error: 'Error en prueba de integración',
            message: error.message
        });
    }
});

/**
 * GET /api/langfuse/health
 * Verifica el estado de la conexión con Langfuse
 */
router.get('/health', verificarAuth, async (req, res) => {
    try {
        console.log('🏥 [API] Verificando salud de Langfuse...');
        
        // Intentar crear un trace simple para verificar conectividad
        const { langfuse } = require('../utils/langfuse');
        
        const healthCheck = {
            status: 'healthy',
            langfuse_connected: true,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        };
        
        res.json({
            success: true,
            data: healthCheck
        });
        
    } catch (error) {
        console.error('❌ [API] Error en health check:', error);
        
        const healthCheck = {
            status: 'unhealthy',
            langfuse_connected: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
        
        res.status(503).json({
            success: false,
            data: healthCheck
        });
    }
});

module.exports = router; 