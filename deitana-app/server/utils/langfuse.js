// =====================================
// CONFIGURACIÓN DE LANGFUSE PARA OBSERVABILIDAD COMPLETA
// =====================================

const { Langfuse } = require('langfuse');
require('dotenv').config();

// Inicializar Langfuse
const langfuse = new Langfuse({
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
});

// =====================================
// FUNCIONES PRINCIPALES DE OBSERVABILIDAD
// =====================================

/**
 * Inicia un trace completo para una consulta de usuario
 * @param {string} userId - ID del usuario
 * @param {string} message - Mensaje del usuario
 * @param {string} modelo - "admin" o "employee"
 * @returns {Object} Trace de Langfuse
 */
function iniciarTrace(userId, message, modelo = 'admin') {
    console.log('📊 [LANGFUSE] Iniciando trace para consulta:', message.substring(0, 50) + '...');
    
    const trace = langfuse.trace({
        name: `deitana-${modelo}-query`,
        userId: userId,
        input: {
            mensaje: message,
            modelo: modelo,
            timestamp: new Date().toISOString()
        },
        metadata: {
            sistema: 'Deitana IA',
            version: '2.0',
            modelo_tipo: modelo,
            servidor: 'semilleros-deitana'
        },
        tags: [modelo, 'consulta-usuario', 'producción']
    });
    
    console.log('✅ [LANGFUSE] Trace iniciado con ID:', trace.id);
    return trace;
}

/**
 * Registra el análisis del contexto y preparación del prompt
 * @param {Object} trace - Trace padre
 * @param {Object} contexto - Información del contexto preparado
 * @returns {Object} Span de contexto
 */
function registrarContexto(trace, contexto) {
    console.log('📊 [LANGFUSE] Registrando análisis de contexto...');
    
    const spanContexto = trace.span({
        name: 'contexto-preparation',
        input: {
            mensaje_original: contexto.mensajeOriginal,
            historial_length: contexto.historialLength || 0,
            mapaERP_length: contexto.mapaERPLength || 0,
            pinecone_length: contexto.pineconeLength || 0
        },
        metadata: {
            tiene_historial: (contexto.historialLength || 0) > 0,
            tiene_mapaERP: (contexto.mapaERPLength || 0) > 0,
            tiene_pinecone: (contexto.pineconeLength || 0) > 0,
            contexto_total: (contexto.historialLength || 0) + (contexto.mapaERPLength || 0) + (contexto.pineconeLength || 0)
        }
    });
    
    return spanContexto;
}

/**
 * Registra la llamada a OpenAI con todos los detalles
 * @param {Object} trace - Trace padre
 * @param {Object} llamada - Detalles de la llamada a OpenAI
 * @returns {Object} Generation de Langfuse
 */
function registrarLlamadaOpenAI(trace, llamada) {
    console.log('📊 [LANGFUSE] Registrando llamada a OpenAI...');
    
    const generation = trace.generation({
        name: 'openai-generation',
        model: llamada.modelo || 'gpt-4o',
        modelParameters: {
            temperature: llamada.temperature || 0.7,
            max_tokens: llamada.maxTokens || 2000
        },
        input: llamada.prompt,
        output: llamada.respuesta,
        usage: {
            promptTokens: llamada.promptTokens,
            completionTokens: llamada.completionTokens,
            totalTokens: llamada.totalTokens
        },
        metadata: {
            costo_estimado: llamada.costoEstimado,
            tiempo_respuesta_ms: llamada.tiempoRespuesta
        }
    });
    
    console.log('✅ [LANGFUSE] Llamada OpenAI registrada');
    return generation;
}

/**
 * Registra la generación y ejecución de SQL
 * @param {Object} trace - Trace padre
 * @param {Object} sqlInfo - Información del SQL generado y ejecutado
 * @returns {Object} Span de SQL
 */
function registrarSQL(trace, sqlInfo) {
    console.log('📊 [LANGFUSE] Registrando generación y ejecución SQL...');
    
    const spanSQL = trace.span({
        name: 'sql-execution',
        input: {
            sql_generado: sqlInfo.sqlGenerado,
            mensaje_usuario: sqlInfo.mensajeUsuario
        },
        output: {
            resultados_count: sqlInfo.resultadosCount || 0,
            tiempo_ejecucion_ms: sqlInfo.tiempoEjecucion
        },
        metadata: {
            sql_valido: sqlInfo.sqlValido || false,
            tuvo_reintentos: sqlInfo.tuvoReintentos || false,
            fuzzy_search_usado: sqlInfo.fuzzySearchUsado || false
        },
        level: sqlInfo.sqlValido ? 'DEFAULT' : 'WARNING'
    });
    
    return spanSQL;
}

/**
 * Registra el procesamiento de marcadores y respuesta final
 * @param {Object} trace - Trace padre
 * @param {Object} procesamiento - Información del procesamiento final
 * @returns {Object} Span de procesamiento
 */
function registrarProcesamiento(trace, procesamiento) {
    console.log('📊 [LANGFUSE] Registrando procesamiento de respuesta final...');
    
    const spanProcesamiento = trace.span({
        name: 'response-processing',
        input: {
            respuesta_cruda: procesamiento.respuestaCruda,
            marcadores_encontrados: procesamiento.marcadoresEncontrados || [],
            datos_disponibles: procesamiento.datosDisponibles || 0
        },
        output: {
            respuesta_final: procesamiento.respuestaFinal,
            marcadores_reemplazados: procesamiento.marcadoresReemplazados || 0,
            datos_utilizados: procesamiento.datosUtilizados || 0
        },
        metadata: {
            tiene_marcadores: (procesamiento.marcadoresEncontrados || []).length > 0,
            reemplazo_exitoso: procesamiento.reemplazoExitoso || false,
            tipo_respuesta: procesamiento.tipoRespuesta || 'unknown'
        }
    });
    
    return spanProcesamiento;
}

/**
 * Registra interacciones con Pinecone
 * @param {Object} trace - Trace padre
 * @param {Object} pineconeInfo - Información de Pinecone
 * @returns {Object} Span de Pinecone
 */
function registrarPinecone(trace, pineconeInfo) {
    console.log('📊 [LANGFUSE] Registrando interacción con Pinecone...');
    
    const spanPinecone = trace.span({
        name: 'pinecone-memory',
        input: {
            operacion: pineconeInfo.operacion,
            consulta: pineconeInfo.consulta,
            userId: pineconeInfo.userId
        },
        output: {
            recuerdos_encontrados: pineconeInfo.recuerdosEncontrados || 0,
            contexto_generado: pineconeInfo.contextoGenerado || ''
        },
        metadata: {
            memoria_guardada: pineconeInfo.memoriaGuardada || false
        }
    });
    
    return spanPinecone;
}

/**
 * Finaliza el trace con métricas completas
 * @param {Object} trace - Trace a finalizar
 * @param {Object} metricas - Métricas finales de la consulta
 */
function finalizarTrace(trace, metricas) {
    console.log('📊 [LANGFUSE] Finalizando trace con métricas completas...');
    
    trace.update({
        output: {
            respuesta_final: metricas.respuestaFinal,
            exito: metricas.exito || false,
            tiempo_total_ms: metricas.tiempoTotal
        },
        metadata: {
            tokens_totales: metricas.tokensTotal || 0,
            costo_total: metricas.costoTotal || 0
        },
        level: metricas.exito ? 'DEFAULT' : 'ERROR'
    });
    
    console.log('✅ [LANGFUSE] Trace finalizado exitosamente');
}

/**
 * Registra un error en el trace
 * @param {Object} trace - Trace padre
 * @param {Error} error - Error ocurrido
 * @param {string} contexto - Contexto donde ocurrió el error
 */
function registrarError(trace, error, contexto = 'unknown') {
    console.log('🚨 [LANGFUSE] Registrando error:', error.message);
    
    trace.event({
        name: 'error-occurred',
        input: {
            error_message: error.message,
            contexto: contexto
        },
        level: 'ERROR'
    });
}

/**
 * Cierra la conexión con Langfuse de forma segura
 */
async function cerrarLangfuse() {
    try {
        console.log('🔄 [LANGFUSE] Cerrando conexión...');
        await langfuse.flushAsync();
        console.log('✅ [LANGFUSE] Conexión cerrada correctamente');
    } catch (error) {
        console.error('❌ [LANGFUSE] Error cerrando conexión:', error);
    }
}

// =====================================
// FUNCIONES DE ANÁLISIS Y MÉTRICAS
// =====================================

/**
 * Calcula métricas de rendimiento para una sesión
 * @param {Array} traces - Array de traces de una sesión
 * @returns {Object} Métricas calculadas
 */
function calcularMetricas(traces) {
    const metricas = {
        total_consultas: traces.length,
        tiempo_promedio: 0,
        tokens_promedio: 0,
        costo_total: 0,
        tasa_exito: 0,
        errores_comunes: {}
    };
    
    if (traces.length === 0) return metricas;
    
    let tiempoTotal = 0;
    let tokensTotal = 0;
    let costoTotal = 0;
    let exitosos = 0;
    
    traces.forEach(trace => {
        tiempoTotal += trace.metadata?.tiempo_total_ms || 0;
        tokensTotal += trace.metadata?.tokens_totales || 0;
        costoTotal += trace.metadata?.costo_total || 0;
        
        if (trace.output?.exito) exitosos++;
        
        // Contar errores
        if (!trace.output?.exito && trace.metadata?.statusMessage) {
            const error = trace.metadata.statusMessage;
            metricas.errores_comunes[error] = (metricas.errores_comunes[error] || 0) + 1;
        }
    });
    
    metricas.tiempo_promedio = tiempoTotal / traces.length;
    metricas.tokens_promedio = tokensTotal / traces.length;
    metricas.costo_total = costoTotal;
    metricas.tasa_exito = (exitosos / traces.length) * 100;
    
    return metricas;
}

/**
 * Registra métricas de rendimiento
 */
function registrarMetricas(trace, metricas) {
    trace.event({
        name: 'performance-metrics',
        input: {
            tiempo_total_ms: metricas.tiempoTotal,
            tokens_usados: metricas.tokensUsados,
            costo_estimado: metricas.costoEstimado,
            pasos_completados: metricas.pasosCompletados
        },
        level: 'INFO'
    });
}

// =====================================
// EXPORTAR FUNCIONES
// =====================================

module.exports = {
    langfuse,
    iniciarTrace,
    registrarContexto,
    registrarLlamadaOpenAI,
    registrarSQL,
    registrarProcesamiento,
    registrarPinecone,
    registrarMetricas,
    finalizarTrace,
    registrarError,
    cerrarLangfuse,
    calcularMetricas
}; 