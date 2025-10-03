
// =====================================
// IMPORTACIONES Y CONFIGURACIÓN INICIAL
// =====================================



const { OpenAI } = require('openai');
const pool = require('../../db');
const dbBridge = require('../../db-bridge');
const chatManager = require('../../utils/chatManager');
const admin = require('../../firebase-admin');
const pineconeMemoria = require('../../utils/pinecone');
// Comandos y langfuse removidos - no se usan
require('dotenv').config();
const mapaERP = require('./mapaERP');
// Importaciones desde las carpetas organizadas
const {
    guiaMarkdownCompleta,
    promptGlobal, 
    comportamientoGlobal,
    formatoRespuesta
} = require('../prompts/GLOBAL');

const { sqlRules } = require('../prompts/SQL');

const { identidadEmpresa, terminologia } = require('../prompts/DEITANA');




// =====================================
// VERIFICACIÓN DE IMPORTACIONES
// =====================================


const ragInteligente = require('../data/integrar_rag_nuevo');



const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// =====================================
// CONFIGURACIÓN DE VARIABLES GLOBALES
// =====================================

// Historial global de conversación (en memoria, para demo)
const conversationHistory = [];
// Contexto de datos reales de la última consulta relevante
let lastRealData = null;




// =====================================
// CONFIGURACIÓN DE VARIABLES GLOBALES
// =====================================

/**
 * 
 * @param {Array} results - Resultados de la consulta SQL
 * @param {string} query - Consulta original del usuario
 * @returns {string} Respuesta formateada de forma natural
 * 
 */


// =====================================
// FUNCIONES DE EJECUCIÓN Y VALIDACIÓN SQL
// =====================================


// =====================================
// EJECUCIÓN DE CONSULTAS SQL
// =====================================

/**
 * Función para ejecutar consultas SQL con sistema inteligente de manejo de errores
 * @param {string} sql - Consulta SQL a ejecutar
 * @param {string} originalQuery - Consulta original del usuario
 * @param {number} attempt - Número de intento (para reintentos)
 * @returns {Promise<Array>} Resultados de la consulta
 */
async function executeQuery(sql, originalQuery = '', attempt = 1) {
    try {
        // Reemplazar los nombres de las tablas con sus nombres reales
        const sqlModificado = reemplazarNombresTablas(sql);
        console.log(`🔍 [SQL-EXEC] Intento ${attempt} - Ejecutando:`, sqlModificado);
        
        const [rows] = await pool.query(sqlModificado);
        console.log('📊 [SQL-RESULT] Filas devueltas:', rows.length);
        
        if (rows.length === 0) {
            console.log('⚠️ [SQL-RESULT] La consulta no devolvió resultados');
            return [];
        }

        return rows;
        
    } catch (error) {
        console.error(`❌ [SQL-EXEC] Error en intento ${attempt}:`, error.message);
        console.error('❌ [SQL-EXEC] SQL:', sql);
        
        // Si es posible reintentar y no hemos agotado los intentos
        if (attempt < 3) {
            console.log(`🔄 [RETRY] Reintentando consulta...`);
            return await executeQuery(sql, originalQuery, attempt + 1);
        }
        
        // Si llegamos aquí, el error no se pudo resolver
        throw error;
    }
}





// =====================================
// DETECCIÓN DE CONSULTAS ESPECIALES
// =====================================

// =====================================
// MANTENIMIENTO DEL SISTEMA
// =====================================

/**
 * Limpieza automática de TODOs antiguos (ejecutar periódicamente)
 */
function performSystemMaintenance() {
    console.log('🧹 [MAINTENANCE] Iniciando mantenimiento del sistema...');
    
    // Log de mantenimiento básico
    console.log('📊 [MAINTENANCE] Sistema funcionando correctamente');
    
    return {
        status: 'ok',
        message: 'Mantenimiento completado'
    };
}

// Ejecutar mantenimiento cada hora
setInterval(performSystemMaintenance, 60 * 60 * 1000);



// =====================================
// VALIDACIÓN Y PROCESAMIENTO DE SQL
// =====================================

/**
 * Función para validar que la respuesta contiene una consulta SQL válida
 * Extrae SQL de diferentes formatos y valida su sintaxis
 * 
 * @param {string} response - Respuesta de OpenAI
 * @returns {string|null} SQL validado o null si no es válido
 * 
 * FORMATOS SOPORTADOS:
 * - <sql>SELECT...</sql>
 * - ```sql SELECT...```
 * - SELECT... (texto plano)
 */
function validarRespuestaSQL(response) {
    console.log('🔍 [SQL-VALIDATION] Validando respuesta para extraer SQL...');
    
    const sqlQueries = [];
    
    // Buscar múltiples consultas SQL con etiquetas <sql>
    const sqlMatches = response.match(/<sql>([\s\S]*?)<\/sql>/g);
    if (sqlMatches) {
        console.log('✅ [SQL-VALIDATION] Encontradas', sqlMatches.length, 'consultas SQL con etiquetas');
        sqlMatches.forEach((match, index) => {
            const sqlContent = match.replace(/<\/?sql>/g, '').trim();
            if (sqlContent && sqlContent.toLowerCase().startsWith('select')) {
                sqlQueries.push(procesarSQL(sqlContent, `SQL ${index + 1}`));
            }
        });
    }
    
    // Si no encontró con etiquetas, buscar con bloques de código SQL
    if (sqlQueries.length === 0) {
        const codeMatches = response.match(/```sql\s*([\s\S]*?)```/g);
        if (codeMatches) {
            console.log('✅ [SQL-VALIDATION] Encontradas', codeMatches.length, 'consultas SQL en bloques de código');
            codeMatches.forEach((match, index) => {
                const sqlContent = match.replace(/```sql\s*/, '').replace(/```/, '').trim();
                if (sqlContent && sqlContent.toLowerCase().startsWith('select')) {
                    sqlQueries.push(procesarSQL(sqlContent, `SQL ${index + 1}`));
                }
            });
        }
    }
    
    // Si no encontró con bloques, buscar SQL en texto plano
    if (sqlQueries.length === 0) {
        console.log('🔍 [SQL-VALIDATION] Buscando SQL en texto plano...');
        const sqlPattern = /(SELECT\s+[\s\S]*?)(?:;|$)/gi;
        let match;
        let index = 0;
        while ((match = sqlPattern.exec(response)) !== null) {
            const sqlContent = match[1].trim();
            if (sqlContent && sqlContent.toLowerCase().startsWith('select')) {
                sqlQueries.push(procesarSQL(sqlContent, `SQL ${index + 1}`));
                index++;
            }
        }
        if (sqlQueries.length > 0) {
            console.log('✅ [SQL-VALIDATION] Encontradas', sqlQueries.length, 'consultas SQL en texto plano');
        }
    }
    
    if (sqlQueries.length === 0) {
        console.log('❌ [SQL-VALIDATION] No se encontró SQL en la respuesta');
        return null;
    }
    
    // Si solo hay una consulta, devolverla como string (compatibilidad)
    if (sqlQueries.length === 1) {
        return sqlQueries[0];
    }
    
    // Si hay múltiples consultas, devolver array
    console.log('✅ [SQL-VALIDATION] Devolviendo', sqlQueries.length, 'consultas SQL');
    return sqlQueries;
}

function procesarSQL(sql, nombre) {
    console.log(`🔍 [SQL-PROCESSING] Procesando ${nombre}:`, sql.substring(0, 100) + '...');
    
    // Validar que es una consulta SQL válida
    if (!sql.toLowerCase().startsWith('select')) {
        console.error(`❌ [SQL-PROCESSING] ${nombre} no es SELECT`);
        throw new Error(`${nombre} debe comenzar con SELECT`);
    }
    
    // Validar y corregir sintaxis común
    if (sql.includes('OFFSET')) {
        const offsetMatch = sql.match(/LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i);
        if (offsetMatch) {
            sql = sql.replace(
                /LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i,
                `LIMIT ${offsetMatch[2]}, ${offsetMatch[1]}`
            );
            console.log(`🔄 [SQL-PROCESSING] Corregida sintaxis OFFSET en ${nombre}`);
        }
    }
    
    // Verificar si es una consulta de conteo
    const esConsultaConteo = sql.toLowerCase().includes('count(*)');
    const tieneDistinct = /select\s+distinct/i.test(sql);
    const tieneGroupBy = /group by/i.test(sql);
    const tieneJoin = /join/i.test(sql);
    const tieneFiltroFecha = /where[\s\S]*fpe_fec|where[\s\S]*fecha|where[\s\S]*_fec/i.test(sql);
    
    // Si no tiene LIMIT y no es excepción, AGREGAR LIMIT automáticamente
    if (!esConsultaConteo && !tieneDistinct && !tieneGroupBy && !sql.toLowerCase().includes('limit') && !(tieneJoin && tieneFiltroFecha)) {
        sql = sql.replace(/;*\s*$/, '');
        sql += ' LIMIT 10';
        console.log(`🔄 [SQL-PROCESSING] Agregado LIMIT automático en ${nombre}`);
    }
    
    console.log(`✅ [SQL-PROCESSING] ${nombre} validado:`, sql.substring(0, 100) + '...');
    return sql;
}



// =====================================
// UTILIDADES DE MAPEO DE TABLAS
// =====================================

// Función para reemplazar nombres de tablas en la consulta SQL
function reemplazarNombresTablas(sql) {
    let sqlModificado = sql;
    Object.keys(mapaERP).forEach(key => {
        if (mapaERP[key].tabla && mapaERP[key].tabla.includes('-')) {
            const regex = new RegExp(`\\b${key}\\b`, 'g');
            sqlModificado = sqlModificado.replace(regex, `\`${mapaERP[key].tabla}\``);
        }
    });
    return sqlModificado;
}





// =====================================
// FUNCIONES DE PERSISTENCIA Y ALMACENAMIENTO
// =====================================



// Función para guardar mensaje en Firestore
async function saveMessageToFirestore(userId, message, isAdmin = true) {
    try {
        const now = new Date();
        const messageData = {
            content: message,
            role: 'user',
            timestamp: now
        };

        const userChatRef = chatManager.chatsCollection.doc(userId);
        const conversationRef = userChatRef.collection('conversations').doc('admin_conversation');
        
        // Primero obtenemos el documento actual
        const conversationDoc = await conversationRef.get();
        let messages = [];
        
        if (conversationDoc.exists) {
            messages = conversationDoc.data().messages || [];
        }
        
        // Agregamos el nuevo mensaje
        messages.push(messageData);
        
        // Actualizamos el documento con el nuevo array de mensajes
        await conversationRef.set({
            lastUpdated: now,
            messages: messages
        }, { merge: true });

        return true;
    } catch (error) {
        console.error('Error al guardar mensaje en Firestore:', error);
        return false;
    }
}

// Función para guardar mensaje del asistente en Firestore
async function saveAssistantMessageToFirestore(userId, message) {
    try {
        const now = new Date();
        const messageData = {
            content: message,
            role: 'assistant',
            timestamp: now
        };

        const userChatRef = chatManager.chatsCollection.doc(userId);
        const conversationRef = userChatRef.collection('conversations').doc('admin_conversation');
        
        // Primero obtenemos el documento actual
        const conversationDoc = await conversationRef.get();
        let messages = [];
        
        if (conversationDoc.exists) {
            messages = conversationDoc.data().messages || [];
        }
        
        // Agregamos el nuevo mensaje
        messages.push(messageData);
        
        // LIMITAR EL TAMAÑO DE LA CONVERSACIÓN PARA EVITAR ERRORES DE FIRESTORE
        const MAX_MESSAGES = 30; // Máximo 30 mensajes por conversación
        const MAX_MESSAGE_SIZE = 50000; // Máximo 50KB por mensaje
        
        // Si el mensaje es muy grande, truncarlo
        if (messageData.content.length > MAX_MESSAGE_SIZE) {
            console.log(`⚠️ [FIRESTORE] Mensaje muy grande (${messageData.content.length} chars), truncando...`);
            messageData.content = messageData.content.substring(0, MAX_MESSAGE_SIZE) + '\n\n[Contenido truncado por límite de tamaño]';
        }
        
        // Si hay demasiados mensajes, mantener solo los últimos MAX_MESSAGES
        if (messages.length > MAX_MESSAGES) {
            console.log(`⚠️ [FIRESTORE] Demasiados mensajes (${messages.length}), manteniendo últimos ${MAX_MESSAGES}...`);
            messages = messages.slice(-MAX_MESSAGES);
        }
        
        // Calcular tamaño aproximado del documento
        const documentSize = JSON.stringify({
            lastUpdated: now,
            messages: messages
        }).length;
        
        if (documentSize > 900000) { // 900KB como margen de seguridad
            console.log(`⚠️ [FIRESTORE] Documento muy grande (${documentSize} bytes), limpiando conversación...`);
            // Mantener solo los últimos 10 mensajes
            messages = messages.slice(-10);
        }
        
        // Actualizamos el documento con el nuevo array de mensajes
        await conversationRef.set({
            lastUpdated: now,
            messages: messages
        }, { merge: true });

        console.log(`✅ [FIRESTORE] Mensaje guardado. Total mensajes: ${messages.length}`);
        return true;
    } catch (error) {
        console.error('Error al guardar mensaje del asistente en Firestore:', error);
        
        // Si el error es por tamaño, intentar limpiar la conversación
        if (error.message && error.message.includes('exceeds the maximum allowed size')) {
            console.log('🔄 [FIRESTORE] Intentando limpiar conversación por tamaño...');
            try {
                const userChatRef = chatManager.chatsCollection.doc(userId);
                const conversationRef = userChatRef.collection('conversations').doc('admin_conversation');
                
                // Crear nueva conversación con solo el mensaje actual
                await conversationRef.set({
                    lastUpdated: new Date(),
                    messages: [{
                        content: message.length > 50000 ? message.substring(0, 50000) + '\n\n[Contenido truncado]' : message,
                        role: 'assistant',
                        timestamp: new Date()
                    }]
                });
                
                console.log('✅ [FIRESTORE] Conversación limpiada exitosamente');
                return true;
            } catch (cleanupError) {
                console.error('❌ [FIRESTORE] Error limpiando conversación:', cleanupError);
                return false;
            }
        }
        
        return false;
    }
}





// =====================================
// CONSTRUCCIÓN INTELIGENTE DE PROMPTS
// =====================================

/**
 * Construye un prompt optimizado usando IA inteligente (UNA SOLA LLAMADA)
 * Esta es la función principal que orquesta todo el proceso de construcción
 * 
 * @param {string} mensaje - Consulta del usuario
 * @param {Object} mapaERP - Mapa de estructura de la base de datos
 * @param {Object} openaiClient - Cliente de OpenAI
 * @param {string} contextoPinecone - Contexto de memoria vectorial
 * @param {string} contextoDatos - Datos de contexto previo
 * @param {boolean} modoDesarrollo - Modo de desarrollo para debugging
 * @returns {Object} Prompt construido con configuración y métricas
 */
async function construirPromptInteligente(mensaje, mapaERP, openaiClient, contextoPinecone = '', contextoDatos = '', historialConversacion = [], modoDesarrollo = false) {
    console.log('🚀 [PROMPT-BUILDER] Construyendo prompt ULTRA-OPTIMIZADO...');
    
    // =====================================
    // ANÁLISIS DE INTENCIÓN Y CONFIGURACIÓN
    // =====================================
    
    // 1. ANÁLISIS INTELIGENTE RÁPIDO (SIN LLAMADAS IA)
    const tiempoIntencionInicio = Date.now();
    const intencion = await analizarIntencionInteligente(mensaje);
    const tiempoIntencion = Date.now() - tiempoIntencionInicio;
    console.log('⏱️ [TIMING] analizarIntencionInteligente:', tiempoIntencion, 'ms');
    console.log('🎯 [PROMPT-BUILDER] Intención detectada:', intencion);
    
    // 2. Configuración del modelo optimizada por tipo de consulta
    let configModelo;
    
    if (intencion.tipo === 'conocimiento_general') {
        // ⚡ Ruta rápida para conocimiento general
        configModelo = {
            modelo: 'gpt-4o-mini',  // Modelo más rápido
            maxTokens: 800,         // Respuestas más concisas
            temperature: 0.7,
            topP: 0.9
        };
        console.log('⚡ [MODELO] Usando GPT-4o-mini para conocimiento general');
    } else if (intencion.tipo === 'conversacion') {
        // ⚡ Ruta ultra-rápida para conversación
        configModelo = {
            modelo: 'gpt-4o-mini',  // Modelo más rápido
            maxTokens: 300,         // Respuestas muy breves
            temperature: 0.7,
            topP: 0.9
        };
        console.log('⚡ [MODELO] Usando GPT-4o-mini para conversación casual');
    } else {
        // Modelo completo para consultas complejas
        configModelo = {
            modelo: 'gpt-4o',
            maxTokens: 3000,
            temperature: 0.9,
            topP: 0.95,
            frequencyPenalty: 0.5,
            presencePenalty: 0.4
        };
        console.log('🤖 [MODELO] Usando GPT-4o para consultas complejas');
    }
    
    // =====================================
    // RECOLECCIÓN DE INFORMACIÓN
    // =====================================
    
    // 3. SIEMPRE incluir mapaERP - la IA decide si lo usa
    const contextoMapaERP = construirContextoMapaERPCompleto(mapaERP);
    console.log('📋 [MAPA-ERP] Incluyendo mapaERP completo - IA decide si lo usa');
    
    // 4. Construir instrucciones naturales
    const instruccionesNaturales = construirInstruccionesNaturales(intencion, [], contextoPinecone);
    console.log(`🔍 [DEBUG-PROMPT] Intención final: ${JSON.stringify(intencion)}`);
    console.log(`🔍 [DEBUG-PROMPT] Instrucciones naturales construidas: ${instruccionesNaturales.length} caracteres`);
    
    // 5. RAG INTELIGENTE Y SELECTIVO (OPTIMIZADO)
    let contextoRAG = '';
    
    // 🚨 RAG DESHABILITADO PARA CONSULTAS SQL - EVITAR ALUCINACIONES
    if (intencion.tipo === 'sql' || intencion.tipo === 'rag_sql') {
        console.log('🚫 [RAG] DESHABILITADO para consultas SQL - priorizando datos reales');
    } else if (intencion.tipo === 'conocimiento_general' || intencion.tipo === 'conversacion') {
        console.log('⚡ [RAG] Saltando RAG para consulta de conocimiento general/conversación');
    } else {
        try {
            console.log('🧠 [RAG] Recuperando conocimiento empresarial...');
            const tiempoRAGInicio = Date.now();
            contextoRAG = await ragInteligente.recuperarConocimientoRelevante(mensaje, 'sistema');
            const tiempoRAG = Date.now() - tiempoRAGInicio;
            console.log('⏱️ [TIMING] RAG recuperarConocimientoRelevante:', tiempoRAG, 'ms');
            console.log('✅ [RAG] Conocimiento recuperado:', contextoRAG ? contextoRAG.length : 0, 'caracteres');
        } catch (error) {
            console.error('❌ [RAG] Error recuperando conocimiento:', error.message);
            // Continuar sin RAG si hay error, pero registrar el problema
        }
    }
    



    
// =====================================
// ENSAMBLAJE DEL PROMPT FINAL
// =====================================
    
    // 6. Preparar la fecha actual para el prompt
    const fechaActual = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' });
    
    // 7. Crear el prompt base (como el encabezado de una carta)
    const promptGlobalConFecha = promptGlobal.replace('{{FECHA_ACTUAL}}', fechaActual);
    
    // 8. Construir prompt final optimizado por tipo de consulta
    let promptFinal;
    
    if (intencion.tipo === 'conversacion') {
        console.log('⚡ [PROMPT] Usando prompt simplificado para conversación casual');
        promptFinal = `Eres un asistente amigable y profesional de Semilleros Deitana. 

Responde de manera natural y conversacional. Mantén las respuestas breves y amigables.

Usuario: ${mensaje}`;
    } else if (intencion.tipo === 'conocimiento_general') {
        console.log('⚡ [PROMPT] Usando prompt optimizado para conocimiento general');
        promptFinal = `Eres un asistente experto en plantas y jardinería de Semilleros Deitana.

Proporciona información precisa y útil sobre plantas, jardinería y cultivos. Mantén las respuestas informativas pero accesibles.

Consulta: ${mensaje}`;
    } else {
        // Prompt completo para consultas complejas
        promptFinal = `${promptGlobalConFecha}\n` + instruccionesNaturales;
        
        // 9. Si encontramos información de la empresa, ponerla AL PRINCIPIO (como información importante)
        // 🚨 NO INCLUIR RAG PARA CONSULTAS SQL - EVITAR ALUCINACIONES
        if (contextoRAG && intencion.tipo !== 'sql' && intencion.tipo !== 'rag_sql') {
            console.log('🎯 [RAG] PRIORIZANDO contexto empresarial al inicio');
            // Reconstruir el prompt poniendo la información de la empresa al principio
            promptFinal = `${promptGlobalConFecha}\n\nCONOCIMIENTO EMPRESARIAL ESPECÍFICO:\n${contextoRAG}\n\nINSTRUCCIÓN: Debes usar siempre la información del conocimiento empresarial específico proporcionado arriba. Si la información está disponible en ese contexto, úsala. No des respuestas genéricas cuando tengas información específica de la empresa.\n\n` + instruccionesNaturales;
        } else if (intencion.tipo === 'sql' || intencion.tipo === 'rag_sql') {
            console.log('🚫 [RAG] NO INCLUYENDO RAG para consultas SQL - priorizando datos reales');
        }
    }
    
    // 10. Agregar estructura de base de datos solo si es necesario
    if (intencion.tipo !== 'conversacion' && intencion.tipo !== 'conocimiento_general') {
        promptFinal += `${contextoMapaERP}\n\n`;
        console.log('📋 [PROMPT] Incluyendo mapa ERP para consultas complejas');
    } else {
        console.log('⚡ [PROMPT] Saltando mapa ERP para consultas simples');
    }
    
    // 11. Solo agregar reglas SQL si la consulta necesita datos (como reglas de tráfico solo si vas a manejar)
    if (intencion.tipo === 'sql' || intencion.tipo === 'rag_sql') {
        promptFinal += `${sqlRules}\n\n`;
    }
    
    // 12. Agregar datos de consultas anteriores si existen (como recordar lo que hablamos antes)
    if (contextoDatos) {
        promptFinal += `DATOS DE CONTEXTO PREVIO:\n${contextoDatos}\n\n`;
    }
    
    // 13. Agregar conversación reciente si existe (como recordar los últimos mensajes)
    if (historialConversacion && historialConversacion.length > 0) {
        const ultimosMensajes = historialConversacion.slice(-4); // Solo los últimos 4 mensajes
        const contextoConversacional = ultimosMensajes.map(msg => 
            `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`
        ).join('\n');
        
        // Agregar el contexto conversacional al prompt final
        promptFinal += `## 💬 CONTEXTO CONVERSACIONAL RECIENTE\n\n${contextoConversacional}\n\n## 🎯 INSTRUCCIONES DE CONTINUIDAD\n\n- Mantén la continuidad natural de la conversación\n- NO te presentes de nuevo si ya has saludado\n- Usa el contexto previo para dar respuestas coherentes\n- Si el usuario hace referencia a algo mencionado antes, úsalo\n- Mantén el tono y estilo de la conversación en curso\n\n`;
    }
    
    console.log('✅ [PROMPT-BUILDER] Prompt construido - MapaERP: SIEMPRE, RAG: SIEMPRE');





    
// =====================================
// RETORNO DE RESULTADOS
// =====================================
    
    return {
        prompt: promptFinal,
        configModelo: configModelo,
        intencion: intencion,
        tablasRelevantes: [], // IA analiza todas las tablas del mapaERP
        metricas: {
            usaIA: true, // IA analiza mapaERP completo
            tablasDetectadas: Object.keys(mapaERP).length,
            llamadasIA: 1, // ¡Solo UNA llamada!
            optimizado: true,
            modeloUnico: 'gpt-4o',
            mapaERPIncluido: true, // SIEMPRE incluido
            ragIncluido: intencion.tipo !== 'sql' && intencion.tipo !== 'rag_sql', // Deshabilitado para SQL
            ragDeshabilitadoParaSQL: intencion.tipo === 'sql' || intencion.tipo === 'rag_sql' // Nueva métrica
        }
    };
}





// =====================================
// GENERACIÓN DE TÍTULOS Y CATEGORIZACIÓN
// =====================================

/**
 * Genera un título breve para el thinking basado en la consulta del usuario
 */
function generarTituloBreve(consulta) {
    const palabras = consulta.toLowerCase().split(' ');
    
    // Detectar tipos de consulta comunes
    if (palabras.some(p => ['cliente', 'clientes'].includes(p))) {
        return 'Consultando clientes';
    }
    if (palabras.some(p => ['producto', 'productos', 'artículo', 'artículos'].includes(p))) {
        return 'Consultando productos';
    }
    if (palabras.some(p => ['venta', 'ventas', 'factura', 'facturas'].includes(p))) {
        return 'Consultando ventas';
    }
    if (palabras.some(p => ['stock', 'inventario', 'almacén'].includes(p))) {
        return 'Consultando stock';
    }
    if (palabras.some(p => ['encargo', 'encargos', 'pedido', 'pedidos'].includes(p))) {
        return 'Consultando encargos';
    }
    if (palabras.some(p => ['año', 'años', 'fecha', 'fechas'].includes(p))) {
        return 'Consultando fechas';
    }
    if (palabras.some(p => ['pago', 'pagos', 'forma', 'formas'].includes(p))) {
        return 'Consultando pagos';
    }
    
    // Si no coincide con ningún patrón, usar las primeras palabras
    const primerasPalabras = palabras.slice(0, 2).join(' ');
    return primerasPalabras.charAt(0).toUpperCase() + primerasPalabras.slice(1);
}





// =====================================
// PROCESAMIENTO DE IMÁGENES CON OCR
// =====================================

/**
 * Procesa una imagen usando GPT-4 Vision para extraer texto y contexto
 * @param {string} imageBase64 - Imagen en base64
 * @returns {Promise<string>} Texto extraído de la imagen
 */
async function processImageWithOCR(imageBase64) {
    console.log('🖼️ [OCR] Iniciando procesamiento de imagen...');
    console.log('🖼️ [OCR] Tipo de entrada:', typeof imageBase64);
    console.log('🖼️ [OCR] Tamaño de entrada:', imageBase64 ? imageBase64.length : 'N/A');
    console.log('🖼️ [OCR] Prefijo de entrada:', imageBase64 ? imageBase64.substring(0, 50) + '...' : 'N/A');
    
    try {
        // Asegurar que la imagen esté en el formato correcto
        let imageData = imageBase64;
        if (imageData.startsWith('data:image/')) {
            // Remover el prefijo data:image/...;base64,
            imageData = imageData.split(',')[1];
            console.log('🖼️ [OCR] Prefijo data:image/ detectado y removido');
        }
        console.log('🖼️ [OCR] Tamaño de datos de imagen:', imageData.length);
        
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: "Analiza esta imagen y extrae TODA la información relevante para consultas de ERP/Base de datos. " +
                                "CONTEXTO: Esta imagen puede contener información de partidas, clientes, productos, ubicaciones de invernaderos, etc. " +
                                "INSTRUCCIONES ESPECÍFICAS: " +
                                "1. NÚMEROS DE PARTIDA: Busca números como 19381823, 193932812, etc. " +
                                "2. CÓDIGOS Y REFERENCIAS: IDs, códigos de cliente, códigos de producto " +
                                "3. NOMBRES: Clientes, proveedores, productos, variedades " +
                                "4. UBICACIONES: Invernaderos (A1, B2, C3), sectores, filas " +
                                "5. FECHAS: Fechas de siembra, entrega, vencimiento " +
                                "6. CANTIDADES: Plantas, bandejas, unidades " +
                                "7. ESTADOS: En proceso, terminado, pendiente, etc. " +
                                "FORMATO DE RESPUESTA: " +
                                "- Lista clara y organizada de toda la información encontrada " +
                                "- Mantén los números EXACTOS como aparecen " +
                                "- Preserva nombres y códigos tal como están escritos " +
                                "- Si hay tablas o listas, organízalas claramente " +
                                "- Si ves un número de partida, destácalo especialmente " +
                                "EJEMPLO: " +
                                "Información extraída de la imagen: " +
                                "- Número de partida: 19381823 " +
                                "- Cliente: Agrícola San José " +
                                "- Producto: Tomate Cherry " +
                                "- Cantidad solicitada: 500 plantas " +
                                "- Fecha de siembra: 15/03/2024 " +
                                "- Fecha de entrega: 20/04/2024 " +
                                "- Ubicación: Invernadero A1, Sector 22, Fila 5 " +
                                "- Estado: En proceso " +
                                "IMPORTANTE: Si encuentras un número que parece ser una partida (como 19381823, 25003963, etc.), destácalo claramente con el formato 'Número de partida: [número]' ya que será usado para consultas SQL. " +
                                "Busca específicamente números largos que puedan ser identificadores de partidas."

                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${imageData}`,
                                detail: 'high'
                            }
                        }
                    ]
                }
            ],
            max_tokens: 1000,
            temperature: 0.1
        });

        const extractedText = response.choices[0].message.content.trim();
        console.log('✅ [OCR] Texto extraído exitosamente:', extractedText);
        
        return extractedText;
        
    } catch (error) {
        console.error('❌ [OCR] Error procesando imagen:', error);
        throw new Error(`Error al procesar la imagen: ${error.message}`);
    }
}

// =====================================
// ANÁLISIS INTELIGENTE DE INTENCIONES
// =====================================

/**
 * Analiza la intención usando IA real (escalable para 900 tablas y 200 usuarios)
 */
async function analizarIntencionInteligente(mensaje) {
    console.log('🧠 [INTENCION-IA] Analizando consulta con IA real...');
    
    // ⚡ DETECCIÓN INTELIGENTE RÁPIDA - Sin llamadas a IA
    const mensajeLower = mensaje.toLowerCase().trim();
    
    // 1. DETECCIÓN DE CONOCIMIENTO GENERAL (¿qué es X?, ¿cómo funciona Y?)
    const patronesConocimientoGeneral = [
        /^qué es /i, /^que es /i, /^what is /i,
        /^cómo funciona /i, /^como funciona /i, /^how does /i,
        /^definición de /i, /^definicion de /i, /^definition of /i,
        /^qué significa /i, /^que significa /i, /^what does /i,
        /^explica /i, /^explain /i, /^describe /i
    ];
    
    if (patronesConocimientoGeneral.some(patron => patron.test(mensajeLower))) {
        console.log('⚡ [INTENCION-IA] Detección rápida: Conocimiento general');
        return { tipo: 'conocimiento_general', confianza: 0.95 };
    }
    
    // 2. DETECCIÓN DE CONVERSACIÓN CASUAL
    const saludosSimples = [
        'hola', 'hi', 'hey', 'buenos días', 'buenas tardes', 'buenas noches',
        'gracias', 'thanks', 'ok', 'okay', 'perfecto', 'genial', 'excelente',
        'adiós', 'bye', 'hasta luego', 'nos vemos', 'chao', 'ciao'
    ];
    
    if (saludosSimples.some(saludo => mensajeLower.includes(saludo))) {
        console.log('⚡ [INTENCION-IA] Detección rápida: Conversación casual');
        return { tipo: 'conversacion', confianza: 0.95 };
    }
    
    // 3. DETECCIÓN DE CONSULTAS SQL (datos, números, listas)
    const patronesSQL = [
        /cuántos/i, /cuantas/i, /how many/i,
        /dame/i, /muestra/i, /lista de/i, /list of/i,
        /busca/i, /buscar/i, /search/i,
        /que hay en/i, /que hay/i, /what is in/i,
        /últimos/i, /ultimos/i, /last/i,
        /clientes/i, /productos/i, /ventas/i, /pedidos/i,
        /invernadero/i, /sector/i, /fila/i, /ubicación/i
    ];
    
    if (patronesSQL.some(patron => patron.test(mensajeLower))) {
        console.log('⚡ [INTENCION-IA] Detección rápida: Consulta SQL');
        return { tipo: 'sql', confianza: 0.95 };
    }
    
    // 4. DETECCIÓN DE CONOCIMIENTO EMPRESARIAL (protocolos, procesos específicos)
    const patronesEmpresariales = [
        /protocolo/i, /proceso/i, /procedimiento/i,
        /instrucción/i, /instrucciones/i,
        /pedro muñoz/i, /antonio galera/i,
        /semilleros deitana/i, /empresa/i,
        /cultivo/i, /siembra/i, /plantación/i
    ];
    
    if (patronesEmpresariales.some(patron => patron.test(mensajeLower))) {
        console.log('⚡ [INTENCION-IA] Detección rápida: Conocimiento empresarial');
        return { tipo: 'conocimiento_empresarial', confianza: 0.95 };
    }
    
    // Detección rápida para imágenes procesadas
    if (mensaje.includes('📷 Información de la imagen:') || mensaje.includes('📷 Información extraída de la imagen:')) {
        console.log('🖼️ [INTENCION-IA] Detectada información de imagen - forzando SQL');
        return { tipo: 'sql', confianza: 0.99 };
    }
    
    try {
        // Usar IA para analizar la intención de forma inteligente
        const promptAnalisis = `Analiza la siguiente consulta y determina qué tipo de respuesta necesita:

CONSULTA: "${mensaje}"

OPCIONES:
1. "sql" - Si la consulta pide datos, números, conteos, listas, información de la base de datos
2. "conocimiento" - Si la consulta pide explicaciones, definiciones, protocolos, información del archivo .txt  
3. "conversacion" - Si es un saludo, agradecimiento, o conversación casual

NOTA ESPECIAL: Si el mensaje contiene "📷 Información de la imagen:" o "📷 Información extraída de la imagen:", automáticamente es "sql" ya que indica que se extrajo información de una imagen para consultar en la base de datos.

REGLAS INTELIGENTES:

🔍 ES SQL SI:
- Pide DATOS específicos (números, cantidades, listas)
- Usa palabras como: "cuántos", "dame", "lista de", "muestra", "busca", "que hay", "que hay en"
- Menciona ENTIDADES de base de datos (clientes, productos, ventas, etc.)
- Pide información que requiere CONSULTAR datos
- Incluye filtros (por fecha, ubicación, tipo, etc.)
- CUALQUIER consulta sobre invernaderos, sectores, filas, ubicaciones físicas
- CUALQUIER consulta sobre plantas libres, plantas a la venta, partidas, cultivos
- CUALQUIER consulta que pregunte "que hay en" + ubicación
- CUALQUIER consulta sobre ubicaciones físicas (invernaderos, sectores, filas, etc.)
- EJEMPLOS: "que hay en el a1", "que plantas hay libres", "ultimos albaranes", "que hay en el sector 5 del X"

📚 ES CONOCIMIENTO SI:
- Pide EXPLICACIONES o DEFINICIONES
- Usa palabras como: "qué es", "cómo funciona", "explica", "significa"
- Pregunta sobre PROCESOS o PROTOCOLOS
- Busca información conceptual o teórica

💬 ES CONVERSACIÓN SI:
- Saludos, despedidas, agradecimientos
- Charla casual sin solicitud específica de datos

⚡ PRINCIPIO CLAVE: Si hay DUDA, es probablemente SQL (la mayoría de consultas en ERP piden datos)

Analiza la INTENCIÓN SEMÁNTICA, no palabras específicas. Actua lo mas rapido posible

Responde SOLO con: sql, conocimiento, o conversacion`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: promptAnalisis }],
            max_tokens: 10,
            temperature: 0.1
        });

        const tipo = response.choices[0].message.content.trim().toLowerCase();
        console.log(`✅ [INTENCION-IA] Tipo detectado: ${tipo}`);
        console.log(`🔍 [INTENCION-IA] Mensaje original: "${mensaje}"`);
        console.log(`🔍 [INTENCION-IA] Respuesta completa: "${response.choices[0].message.content}"`);

        // Mapear a tipos internos
        if (tipo === 'sql') {
            return { tipo: 'sql', confianza: 0.95 };
        } else if (tipo === 'conocimiento') {
            return { tipo: 'rag_sql', confianza: 0.95 };
        } else {
            return { tipo: 'conversacion', confianza: 0.95 };
        }
        
    } catch (error) {
        console.error('❌ [INTENCION-IA] Error:', error.message);
        // Fallback inteligente: si tiene signo de interrogación, probablemente necesita datos
        if (mensaje.toLowerCase().includes('?')) {
            return { tipo: 'sql', confianza: 0.7 };
        }
        return { tipo: 'conversacion', confianza: 0.5 };
    }
}







// =====================================
// FUNCIÓN PARA OBTENER INFORMACIÓN DEL USUARIO
// =====================================

/**
 * Obtiene la información del usuario desde Firebase incluyendo su displayName
 */
async function obtenerInfoUsuario(userId) {
    try {
        console.log('👤 [USER-INFO] Obteniendo información del usuario:', userId);
        
        const userRecord = await admin.auth().getUser(userId);
        
        const infoUsuario = {
            uid: userRecord.uid,
            nombre: userRecord.displayName || 'Usuario',
            email: userRecord.email,
            esAdmin: userRecord.customClaims?.isAdmin || false
        };
        
        console.log('✅ [USER-INFO] Información obtenida:', {
            nombre: infoUsuario.nombre,
            email: infoUsuario.email?.substring(0, 3) + '***',
            esAdmin: infoUsuario.esAdmin
        });
        
        return infoUsuario;
    } catch (error) {
        console.error('❌ [USER-INFO] Error obteniendo información del usuario:', error.message);
        return {
            uid: userId,
            nombre: 'Usuario',
            email: null,
            esAdmin: false
        };
    }
}

// =====================================
// FUNCIÓN PARA OBTENER HISTORIAL CONVERSACIONAL
// =====================================

/**
 * Obtiene el historial completo de la conversación para contexto
 */
async function obtenerHistorialConversacion(userId, conversationId) {
    try {
        console.log('📜 [HISTORIAL] Obteniendo contexto conversacional...');
        console.log('📜 [HISTORIAL] Usuario:', userId, 'Conversación:', conversationId);
        
        if (!conversationId || conversationId.startsWith('temp_')) {
            console.log('📜 [HISTORIAL] Conversación temporal/nueva - sin historial previo');
            return [];
        }
        
        const mensajes = await chatManager.getConversationMessages(userId, conversationId);
        
        // Solo tomar los últimos 6 mensajes para contexto (3 intercambios)
        const mensajesRecientes = mensajes.slice(-6);
        
        console.log(`📜 [HISTORIAL] Obtenidos ${mensajesRecientes.length} mensajes para contexto`);
        
        // Formatear para usar en el prompt
        const contextoFormateado = mensajesRecientes.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
        
        return contextoFormateado;
    } catch (error) {
        console.error('❌ [HISTORIAL] Error obteniendo historial:', error.message);
        return [];
    }
}

// =====================================
// FUNCIÓN PARA PERSONALIZAR RESPUESTA CON NOMBRE
// =====================================

/**
 * Personaliza la respuesta incluyendo el nombre del usuario de forma sutil
 */
function personalizarRespuesta(respuesta, nombreUsuario) {
    // No personalizar si es un nombre genérico
    if (!nombreUsuario || nombreUsuario === 'Usuario' || nombreUsuario.length < 2) {
        return respuesta;
    }
    
    console.log(`🎨 [PERSONALIZACIÓN] Personalizando respuesta para ${nombreUsuario}`);
    
    // Patrones para agregar el nombre de forma sutil (no siempre, aproximadamente 30% de las veces)
    const deberiaPersonalizar = Math.random() < 0.3;
    
    if (!deberiaPersonalizar) {
        console.log('🎨 [PERSONALIZACIÓN] Saltando personalización para esta respuesta');
        return respuesta;
    }
    
    const patronesPersonalizacion = [
        // Al inicio de la respuesta
        {
            patron: /^¡?Hola[!,]?\s*/i,
            reemplazo: `¡Hola, ${nombreUsuario}! `
        },
        {
            patron: /^Perfecto[!,]?\s*/i,
            reemplazo: `Perfecto, ${nombreUsuario}. `
        },
        // En medio de la respuesta
        {
            patron: /¿Te sirve esta información\?/i,
            reemplazo: `¿Te sirve esta información, ${nombreUsuario}?`
        },
        {
            patron: /¿Necesitas algo más\?/i,
            reemplazo: `¿Necesitas algo más, ${nombreUsuario}?`
        },
        // Al final de la respuesta
        {
            patron: /¿En qué más puedo ayudarte\?/i,
            reemplazo: `¿En qué más puedo ayudarte, ${nombreUsuario}?`
        }
    ];
    
    // Aplicar un patrón aleatorio que coincida
    for (const { patron, reemplazo } of patronesPersonalizacion) {
        if (patron.test(respuesta)) {
            const respuestaPersonalizada = respuesta.replace(patron, reemplazo);
            console.log('✅ [PERSONALIZACIÓN] Respuesta personalizada aplicada');
            return respuestaPersonalizada;
        }
    }
    
    // Si no coincide ningún patrón, agregar el nombre al final de forma sutil
    if (respuesta.endsWith('?')) {
        return respuesta.slice(0, -1) + `, ${nombreUsuario}?`;
    } else if (respuesta.endsWith('.')) {
        return respuesta.slice(0, -1) + `, ${nombreUsuario}.`;
    }
    
    console.log('🎨 [PERSONALIZACIÓN] No se aplicó personalización específica');
    return respuesta;
}





/**
 * Función de streaming para procesamiento en tiempo real
 * Proporciona respuesta chunk por chunk al frontend
 * 
 * @param {Object} params - Parámetros de la consulta
 * @param {string} params.message - Mensaje del usuario
 * @param {string} params.userId - ID del usuario
 * @param {string} params.conversationId - ID de la conversación
 * @param {Object} params.response - Objeto de respuesta HTTP
 * @returns {Object} Resultado del procesamiento
 * 
 * CARACTERÍSTICAS:
 * - Streaming en tiempo real chunk por chunk
 * - Procesamiento post-streaming para SQL
 * - Segunda llamada para explicación natural
 * - Headers especiales para streaming HTTP
 * - Manejo de errores en tiempo real
 * - Persistencia asíncrona de respuestas
 */
async function processQueryStream({ message, userId, conversationId, response }) {
    console.log('🔍 [FLUJO] Usando processQueryStream (STREAMING) - openAI.js');
    const tiempoInicio = Date.now();
    console.log('🚀 [STREAMING] ===== INICIANDO PROCESO DE CONSULTA CON STREAMING =====');
    console.log('🚀 [STREAMING] Procesando consulta:', message);
    console.log('🚀 [STREAMING] Usuario ID:', userId);
    console.log('🚀 [STREAMING] Conversación ID:', conversationId);

    // =====================================
    // OBTENER INFORMACIÓN DEL USUARIO Y CONTEXTO
    // =====================================
    
    const tiempoUsuarioInicio = Date.now();
    const infoUsuario = await obtenerInfoUsuario(userId);
    const tiempoUsuario = Date.now() - tiempoUsuarioInicio;
    console.log('⏱️ [TIMING] obtenerInfoUsuario:', tiempoUsuario, 'ms');
    
    const tiempoHistorialInicio = Date.now();
    const historialConversacion = await obtenerHistorialConversacion(userId, conversationId);
    const tiempoHistorial = Date.now() - tiempoHistorialInicio;
    console.log('⏱️ [TIMING] obtenerHistorialConversacion:', tiempoHistorial, 'ms');

    try {
        // No esperar a que termine de guardar - hacer async
        saveMessageToFirestore(userId, message).catch(err => 
            console.error('❌ [FIRESTORE] Error guardando mensaje:', err.message)
        );
        console.log('💾 [FIRESTORE] Guardando mensaje del usuario (async)...');

        // =====================================
        // OBTENER CONTEXTO DE MEMORIA (SOLO CUANDO ES NECESARIO)
        // =====================================
        
        console.log('🧠 [MEMORIA] Analizando si necesita contexto conversacional...');
        let contextoPinecone = '';
        
        // Detección ultra-rápida para consultas que necesitan memoria
        const consultasQueNecesitanMemoria = /\b(anterior|antes|mencionaste|dijiste|conversación|conversacion|hablamos|recordar|recuerdas|me|mi|entonces|y|bueno|ok|si|sí|continúa|continua|más|mas|otros|otra|que|qué)\b/i;
        const esRespuestaCorta = message.trim().length < 15;
        const necesitaContexto = consultasQueNecesitanMemoria.test(message) || esRespuestaCorta || historialConversacion.length > 0;
        
        if (necesitaContexto) {
            console.log('🧠 [MEMORIA] Consulta requiere contexto - buscando en memoria...');
            
            // Agregar contexto conversacional al contexto de memoria
            if (historialConversacion.length > 0) {
                const ultimosMensajes = historialConversacion.slice(-2); // Solo los 2 últimos
                const contextoConversacional = ultimosMensajes.map(msg => 
                    `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`
                ).join('\n');
                
                contextoPinecone += `\n=== CONTEXTO CONVERSACIONAL RECIENTE ===\n${contextoConversacional}\n\nINSTRUCCIÓN: Mantén la continuidad de la conversación anterior.`;
            }
            
            // Búsqueda de memoria asíncrona (no bloquear la respuesta)
            pineconeMemoria.agregarContextoMemoria(userId, message)
                .then(memoriaAdicional => {
                if (memoriaAdicional) {
                        console.log('✅ [PINECONE] Memoria adicional encontrada (async)');
                    }
                })
                .catch(error => {
                    console.error('❌ [PINECONE] Error buscando recuerdos (async):', error.message);
                });
        } else {
            console.log('⚡ [OPTIMIZACIÓN] Consulta simple - saltando búsqueda de memoria');
        }

        


        // =====================================
        // CONSTRUIR PROMPT OPTIMIZADO (SIN LLAMADAS IA)
        // =====================================
        
        console.log('🧠 [IA-INTELIGENTE] Construyendo prompt OPTIMIZADO...');
        const tiempoPromptInicio = Date.now();
        const promptBuilder = await construirPromptInteligente(
            message, 
            mapaERP,
            openai,
            contextoPinecone, 
            lastRealData || '',
            false
        );
        const tiempoPrompt = Date.now() - tiempoPromptInicio;
        console.log('⏱️ [TIMING] construirPromptInteligente:', tiempoPrompt, 'ms');
        
        console.log('🧠 [IA-INTELIGENTE] Métricas de construcción:');
        console.log('🧠 [IA-INTELIGENTE] Intención detectada:', promptBuilder.intencion);
        console.log('🧠 [IA-INTELIGENTE] Modelo seleccionado:', promptBuilder.configModelo.modelo);

        // =====================================
        // CONFIGURAR MENSAJES PARA STREAMING
        // =====================================

        // Construir array de mensajes con historial conversacional
        const mensajesLlamada = [
            {
                role: 'system',
                content: promptBuilder.prompt
            }
        ];

        // ⚡ RUTA RÁPIDA: Saltar historial para consultas simples
        if (promptBuilder.intencion.tipo === 'conversacion' || promptBuilder.intencion.tipo === 'conocimiento_general') {
            console.log('⚡ [STREAMING-CONTEXTO] Saltando historial para consulta simple - respuesta rápida');
        } else {
            // Agregar historial conversacional como mensajes reales
            if (historialConversacion && historialConversacion.length > 0) {
                console.log('💬 [STREAMING-CONTEXTO] Agregando historial conversacional como mensajes reales...');
                historialConversacion.forEach((msg, index) => {
                    console.log(`💬 [STREAMING-CONTEXTO] Mensaje ${index + 1}: ${msg.role} - "${msg.content.substring(0, 100)}..."`);
                    mensajesLlamada.push({
                        role: msg.role,
                        content: msg.content
                    });
                });
            }
        }

        // Agregar el mensaje actual del usuario
        mensajesLlamada.push({
            role: 'user', 
            content: message
        });

        console.log('📊 [STREAMING] Iniciando llamada con stream a OpenAI...');
        console.log('🤖 [MODELO-DINÁMICO] Usando modelo:', promptBuilder.configModelo.modelo);

        // =====================================
        // LLAMADA CON STREAMING
        // =====================================

        // Configurar headers para streaming
        response.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // =====================================
        // VARIABLES DE CONTROL DEL STREAMING
        // =====================================
        
        let fullResponse = '';
        let tokenCount = 0;
        let sqlDetected = false;

        // =====================================
        // INICIO DEL STREAMING CON OPENAI
        // =====================================
        
        try {
            const tiempoOpenAIInicio = Date.now();
            const stream = await openai.chat.completions.create({
                model: promptBuilder.configModelo.modelo,
                messages: mensajesLlamada,
                max_tokens: promptBuilder.configModelo.maxTokens,
                temperature: promptBuilder.configModelo.temperature,
                top_p: promptBuilder.configModelo.topP,                       // ⚡ SAMPLING CREATIVO
                frequency_penalty: promptBuilder.configModelo.frequencyPenalty, // ⚡ ANTI-REPETICIÓN
                presence_penalty: promptBuilder.configModelo.presencePenalty,   // ⚡ DIVERSIDAD
                stream: true  // ¡AQUÍ ESTÁ LA MAGIA!
            });

            const tiempoOpenAI = Date.now() - tiempoOpenAIInicio;
            console.log('⏱️ [TIMING] OpenAI chat.completions.create:', tiempoOpenAI, 'ms');
            console.log('✅ [STREAMING] Stream iniciado correctamente');
            
            // =====================================
            // LOGS DETALLADOS DEL PROCESO
            // =====================================
            console.log('\n🚀 ==========================================');
            console.log('🚀 INICIO DEL PROCESO DE CONSULTA');
            console.log('🚀 ==========================================');
            console.log(`📝 CONSULTA: "${message}"`);
            console.log(`👤 USUARIO: ${userId}`);
            console.log(`🆔 CONVERSACIÓN: ${conversationId}`);
            console.log('🚀 ==========================================\n');

            // =====================================
            // VARIABLES PARA TRACKING DEL THINKING
            // =====================================
            
            // Variables para tracking del thinking
            let thinkingDetected = false;
            let thinkingContent = '';
            let insideThinking = false;
            let thinkingHeaderSent = false;
            let beforeThinkingContent = '';
            const tituloBreve = generarTituloBreve(message);

            // =====================================
            // PROCESAMIENTO DE CHUNKS DEL STREAM
            // =====================================
            
            // Procesar cada chunk del stream
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
                
                if (content) {
                    // PRIMERO: Detectar thinking ANTES de hacer cualquier otra cosa
                    const hasThinkingTag = content.includes('<thinking') || content.includes('<think') || content.includes('thinking>');
                    
                    fullResponse += content;
                    tokenCount++;
                    
                    // Detectar inicio del thinking INMEDIATAMENTE
                    if (!thinkingDetected && (fullResponse.includes('<thinking>') || hasThinkingTag)) {
                        thinkingDetected = true;
                        insideThinking = true;
                        console.log('\n🧠 ==========================================');
                        console.log('🧠 THINKING DETECTADO - LLAMADA 1 ACTIVA');
                        console.log('🧠 ==========================================');
                        console.log('🧠 La IA está razonando sobre la consulta...');
                        console.log(`🧠 Chunk con thinking: ${content.substring(0, 50)}...`);
                        console.log('🧠 ==========================================\n');
                        
                        // Enviar header del thinking inmediatamente
                        if (!thinkingHeaderSent) {
                            // MODO PRODUCCIÓN: Usar thinking real de la IA
                            response.write(JSON.stringify({
                                type: 'thinking',
                                message: tituloBreve,
                                timestamp: Date.now(),
                                trace: [{
                                    id: "1",
                                    type: "thought",
                                    title: tituloBreve,
                                    description: "Procesando información del ERP",
                                    status: "running",
                                    startTime: new Date().toISOString(),
                                    duration: 0
                                }]
                            }) + '\n');
                            thinkingHeaderSent = true;
                        }
                    }
                    
                    // Si estamos dentro del thinking, solo acumular contenido (no enviar como chunk)
                    if (insideThinking && thinkingHeaderSent) {
                        thinkingContent += content;
                        // No enviar contenido del thinking como chunk cuando usamos trace
                        
                        // Detectar fin del thinking
                        if (thinkingContent.includes('</thinking>')) {
                            insideThinking = false;
                            console.log('🧠 [THINKING] Fin del thinking detectado');
                        }
                    }
                    
                    // Detectar si hay SQL en la respuesta acumulada
                    if (!sqlDetected && fullResponse.includes('<sql>')) {
                        sqlDetected = true;
                        console.log('\n🔍 ==========================================');
                        console.log('🔍 SQL DETECTADO - LLAMADA 1 COMPLETADA');
                        console.log('🔍 ==========================================');
                        console.log('🔍 La IA generó una consulta SQL');
                        console.log('🔍 Ejecutando consulta en la base de datos...');
                        console.log('🔍 ==========================================\n');
                        
                        // Enviar actualización del trace con SQL completado
                        response.write(JSON.stringify({
                            type: 'sql_executing',
                            message: 'Ejecutando consulta SQL',
                            timestamp: Date.now(),
                            trace: [
                                {
                                    id: "1",
                                    type: "thought",
                                    title: tituloBreve,
                                    description: thinkingContent.replace(/<\/?thinking[^>]*>/g, '').trim(),
                                    status: "completed",
                                    startTime: new Date().toISOString(),
                                    endTime: new Date().toISOString(),
                                    duration: 3
                                },
                                {
                                    id: "2",
                                    type: "tool",
                                    title: promptBuilder.intencion && promptBuilder.intencion.tipo === 'conversacion' ? "Procesando respuesta conversacional" : "Consultando base de datos del ERP",
                                    description: promptBuilder.intencion && promptBuilder.intencion.tipo === 'conversacion' ? "Generando respuesta en lenguaje natural" : "Ejecutando consulta SQL en la base de datos",
                                    status: "running",
                                    startTime: new Date().toISOString(),
                                    duration: 0
                                }
                            ]
                        }) + '\n');
                    }
                    
                    // Solo enviar chunks normales si NO estamos en thinking y NO se detectó SQL
                    // Y NO contiene NINGÚN fragmento de tags de thinking
                    if (!insideThinking && !sqlDetected && !thinkingDetected && !hasThinkingTag && !content.includes('</thinking>')) {
                        response.write(JSON.stringify({
                            type: 'chunk',
                            content: content,
                            timestamp: Date.now()
                        }) + '\n');
                    }
                }
                
                // Si el stream terminó
                if (chunk.choices[0]?.finish_reason) {
                    console.log('✅ [STREAMING] Stream completado');
                    break;
                }
            }

            // =====================================
            // PROCESAR THINKING COMPLETO
            // =====================================
            
            // Si tenemos thinking capturado, procesarlo ahora
            if (thinkingContent && thinkingContent.includes('</thinking>')) {
                const cleanThinkingContent = thinkingContent.replace(/<\/?thinking[^>]*>/g, '').trim();
                console.log('🧠 [THINKING] Procesando thinking completo:', cleanThinkingContent.substring(0, 100) + '...');
                
                // MODO PRODUCCIÓN: Enviar thinking completo y continuar con la respuesta
                response.write(JSON.stringify({
                    type: 'thinking_complete',
                    message: 'Consulta SQL completada',
                    timestamp: Date.now(),
                    trace: [
                        {
                            id: "1",
                            type: "thought",
                            title: tituloBreve,
                            description: cleanThinkingContent,
                            status: "completed",
                            startTime: new Date().toISOString(),
                            endTime: new Date().toISOString(),
                            duration: 3
                        },
                        {
                            id: "2",
                            type: "tool",
                            title: promptBuilder.intencion && promptBuilder.intencion.tipo === 'conversacion' ? "Procesando respuesta conversacional" : "Consultando base de datos del ERP",
                            description: promptBuilder.intencion && promptBuilder.intencion.tipo === 'conversacion' ? "Generando respuesta en lenguaje natural" : "Ejecutando consulta SQL en la base de datos",
                            status: "running",
                            startTime: new Date().toISOString(),
                            duration: 0
                        }
                    ]
                }) + '\n');
            }


            // =====================================
            // PROCESAMIENTO POST-STREAMING
            // =====================================

           console.log('🔍 [STREAMING] Procesando respuesta para SQL...');
            
            // =====================================
            // PROCESAMIENTO POST-STREAMING PARA SQL
            // =====================================
            
            let finalMessage = fullResponse;
            let results = null; // Declarar results en el scope correcto
            
            // Verificar si la IA generó SQL en la respuesta
            const sql = validarRespuestaSQL(fullResponse);
            
            if (sql) {
                console.log('✅ [STREAMING] SQL encontrado, ejecutando consulta(s)...');
                try {
                    // =====================================
                    // MANEJO DE MÚLTIPLES CONSULTAS SQL
                    // =====================================
                    
                    let allResults = [];
                    
                    // Manejar múltiples consultas SQL
                    if (Array.isArray(sql)) {
                        console.log(`🔄 [STREAMING] Ejecutando ${sql.length} consultas SQL...`);
                        for (let i = 0; i < sql.length; i++) {
                            console.log(`🔍 [STREAMING] Ejecutando consulta ${i + 1}/${sql.length}`);
                            const retryResult = await ejecutarSQLConRetry(sql[i], dbBridge, openai, 3);
                            allResults.push({
                                query: sql[i],
                                results: retryResult.success ? retryResult.resultados : [],
                                index: i + 1,
                                success: retryResult.success,
                                intentos: retryResult.intentos,
                                correcciones: retryResult.correcciones
                            });
                        }
                        results = allResults;
                    } else {
                        // Consulta única (compatibilidad)
                        const retryResult = await ejecutarSQLConRetry(sql, dbBridge, openai, 3);
                        results = retryResult.success ? retryResult.resultados : [];
                    }
                    
                    if (results !== null && results !== undefined) {
                        // Verificar si realmente hay datos en los resultados (manejar caso [[]])
                        let tieneDatos = false;
                        
                        console.log('🔍 [DEBUG-TIENEDATOS] Analizando estructura de results...');
                        console.log('🔍 [DEBUG-TIENEDATOS] results:', typeof results, Array.isArray(results));
                        console.log('🔍 [DEBUG-TIENEDATOS] results.length:', results ? results.length : 'null');
                        if (results && results.length > 0) {
                            console.log('🔍 [DEBUG-TIENEDATOS] results[0]:', typeof results[0], Array.isArray(results[0]));
                            console.log('🔍 [DEBUG-TIENEDATOS] results[0].length:', results[0] ? results[0].length : 'null');
                            if (results[0] && typeof results[0] === 'object' && 'results' in results[0]) {
                                console.log('🔍 [DEBUG-TIENEDATOS] Es objeto con propiedad results');
                            } else {
                                console.log('🔍 [DEBUG-TIENEDATOS] Es array directo de datos');
                            }
                        }
                        
                        if (Array.isArray(results)) {
                            // Si es array de objetos con results
                            if (results.length > 0 && results[0] && typeof results[0] === 'object' && 'results' in results[0]) {
                                tieneDatos = results.some(r => r.results && Array.isArray(r.results) && r.results.length > 0);
                                console.log('🔍 [DEBUG-TIENEDATOS] Caso 1 - Objetos con results:', tieneDatos);
                            } else if (results.length > 0 && results[0] && Array.isArray(results[0])) {
                                // Si es array directo de datos (caso [[]])
                                tieneDatos = results[0].length > 0;
                                console.log('🔍 [DEBUG-TIENEDATOS] Caso 2 - Array directo:', tieneDatos);
                            } else if (results.length > 0 && results[0] && typeof results[0] === 'object') {
                                // Si es array de objetos con datos (caso [{id: 1, name: "test"}])
                                tieneDatos = true;
                                console.log('🔍 [DEBUG-TIENEDATOS] Caso 3 - Array de objetos con datos:', tieneDatos);
                            } else {
                                tieneDatos = false;
                                console.log('🔍 [DEBUG-TIENEDATOS] Caso 4 - Sin datos:', tieneDatos);
                            }
                        } else {
                            // Si no es array
                            tieneDatos = results.length > 0;
                            console.log('🔍 [DEBUG-TIENEDATOS] Caso 5 - No es array:', tieneDatos);
                        }
                        
                        console.log('🔍 [DEBUG-TIENEDATOS] RESULTADO FINAL tieneDatos:', tieneDatos);
                        
                        if (tieneDatos) {
                        // Guardar los resultados reales para contexto futuro
                        lastRealData = JSON.stringify(results);
                        
                        console.log('\n✅ ==========================================');
                        console.log('✅ SQL EJECUTADO EXITOSAMENTE');
                        console.log('✅ ==========================================');
                        console.log(`✅ Resultados obtenidos: ${Array.isArray(results) ? results.length : results.length} registros`);
                        console.log('✅ Iniciando segunda llamada para formatear datos...');
                        console.log('✅ ==========================================\n');
                        } else {
                            console.log('\n🧠 ==========================================');
                            console.log('🧠 SIN RESULTADOS - ACTIVANDO RAZONAMIENTO CONTINUO');
                            console.log('🧠 ==========================================');
                            console.log('🧠 No se encontraron datos, iniciando razonamiento inteligente...');
                            console.log('🧠 ==========================================\n');
                        }
                        
                        // =====================================
                        // DECISIÓN: SEGUNDA LLAMADA O RAZONAMIENTO CONTINUO
                        // =====================================
                        
                        if (tieneDatos) {
                        // Segunda llamada a la IA para explicar los datos reales de forma natural
                        // Segunda llamada específica para explicar datos (SIN sqlRules)
                        console.log('\n🔄 ==========================================');
                        console.log('🔄 FORMATEADOR DE DATOS - LLAMADA 2');
                        console.log('🔄 ==========================================');
                        console.log('🔄 Construyendo segunda llamada para explicar datos...');
                        console.log('🔄 Aplicando formato natural y análisis inteligente...');
                        console.log('🔄 ==========================================\n');
                        } else {
                            // Usar razonamiento continuo para búsquedas alternativas
                            console.log('\n🧠 ==========================================');
                            console.log('🧠 RAZONAMIENTO CONTINUO - BÚSQUEDAS ALTERNATIVAS');
                            console.log('🧠 ==========================================');
                            console.log('🧠 Iniciando búsquedas alternativas inteligentes...');
                            console.log('🧠 ==========================================\n');
                        }
                        
                        if (tieneDatos) {
                        const fechaActual = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' });
                        const promptGlobalConFecha = promptGlobal.replace('{{FECHA_ACTUAL}}', fechaActual);
                        
                        // =====================================
                        // VERIFICACIÓN ANTES DE CONCATENAR
                        // =====================================
                        console.log('\n🔍 ==========================================');
                        console.log('🔍 VERIFICACIÓN ANTES DE CONCATENAR');
                        console.log('🔍 ==========================================');
                        console.log(`📄 comportamientoGlobal type: ${typeof comportamientoGlobal}`);
                        console.log(`📄 comportamientoGlobal length: ${comportamientoGlobal ? comportamientoGlobal.length : 'UNDEFINED'}`);
                        console.log(`📄 comportamientoGlobal preview: ${comportamientoGlobal ? comportamientoGlobal.substring(0, 100) + '...' : 'UNDEFINED'}`);
                        console.log('🔍 ==========================================\n');
                        
                        // =====================================
                        // CONSTRUCCIÓN DEL PROMPT DE EXPLICACIÓN
                        // =====================================
                        
                        // ⚡ CONSTRUIR SEGUNDA LLAMADA SIMPLIFICADA (ANTI-ROBÓTICA)
                        let promptExplicacion = `${promptGlobalConFecha}\n`;
                        
                        // ⚡ SOLO LO ESENCIAL - NO SOBRECARGAR
                        promptExplicacion += `
# 🎭 VARIEDAD TOTAL: RESPONDE COMO CHATGPT

## 🚀 OBLIGATORIO: CADA RESPUESTA DEBE SER COMPLETAMENTE DIFERENTE

**❌ NUNCA MÁS USES:**
- "Para el [fecha], tenemos las siguientes..."
- "Aquí tienes..."
- "Te presento..."
- "Estas son las..."
- Cualquier patrón repetitivo

**✅ USA ESTOS 5 ESTILOS ALTERNATIVOS (ROTA ENTRE ELLOS):**

### 🎭 ESTILO 1: COMPAÑERO DE TRABAJO
"👋 Oye, ya tengo lo del lunes:
La Serrana va con Coliflor Skywalker.
Costa Simón pidió Brócoli Burgundy.
Y ojo, Agrosana viene cargado: tiene cuatro tipos de Cebolla."

### 📊 ESTILO 2: EJECUTIVO FORMAL  
"📌 Partidas programadas para el lunes:
Hortalizas La Serrana, SL → tiene programada Coliflor Skywalker.
Costa Simon SCOOP → solicitó Brócoli Burgundy (BIMI).
✅ En resumen: Cada cliente tiene programado un cultivo específico."

### 🌱 ESTILO 3: MOTIVADOR/FAENA
"🚜 ¡Así viene el lunes!
🌱 Coliflor Skywalker → Hortalizas La Serrana
🥦 Brócoli Burgundy → Costa Simón
🧅 Y las cebollas a full con Agrosana: 4 variedades.
Se viene un día intenso! 💪"

### 📖 ESTILO 4: NARRATIVO
"El lunes se presenta con varias partidas interesantes:
La Serrana sembrará Coliflor Skywalker.
Costa Simón apostará por el Brócoli Burgundy.
Pero quien realmente destaca es Agrosana, con cuatro variedades de cebolla."

### ✅ ESTILO 5: PRÁCTICO/LISTA
"✅ Lunes – Siembras programadas:
Coliflor Skywalker → Hortalizas La Serrana, SL  
Brócoli Burgundy → Costa Simon SCOOP
Cebolla (4 variedades) → Agrosana
👉 Principal carga: cebolla de Agrosana."

**🎯 REGLA DE ORO:**
Elige un estilo DIFERENTE cada vez. NUNCA repitas el mismo patrón dos veces seguidas.

# 🎨 REGLAS DE FORMATO VISUAL

REGLA: ESTOS SOLO REPRESENTAN EJEMPLOS DISPONIBLES, DEBES VARIAS Y UTILIZAR LOS METODOS QUE DESEES ESTETICO, FUNCIONAL, Y ATRACTIVO PARA LA INFORMACION QUE EL USUARIO MERECE.

### 🎨 ELEMENTOS BASICOS:
- **Texto en negrita** para enfatizar puntos importantes palabras
- *Texto en cursiva* para sutilezas y aclaraciones
- \`codigo inline\` para comandos, variables, o terminos importantes
- > Blockquotes para citas o informacion importante.

### 📋 ESTRUCTURA:
- # ## ### Encabezados para estructurar respuestas largas
- Listas con viñietas para enumerar opciones
- 1. Listas numeradas para pasos o procesos
- Tablas cuando organices datos
- Emojis 😊 cuando sean apropiados al contexto


## 📝 CUANDO USAR CADA ELEMENTO

### 🏷️ TITULOS Y ENCABEZADOS (#, ##, ###):
- **Usa cuando** la respuesta supera 6 lineas o tiene multiples secciones
- **#** → documento o reporte corto (solo 1 por respuesta larga)
- **##** → secciones principales (Resumen, Resultados, Siguientes pasos)
- **###** → subpuntos dentro de una seccion


### 📊 TABLAS:
- **Usar tablas** para comparar cosas con las mismas columnas
- **Evitar tablas** para informacion narrativa o cuando hay menos de 3 columnas/filas
- **Cabecera clara** y unidades en la cabecera (ej: "Cantidad (u.)", "Importe (ARS)")

### 💻 BLOQUES DE CODIGO:
- **Inline code** para variables, comandos, nombres de campos o terminos tecnicos
- **Bloque triple** \`\`\` para mostrar comandos o ejemplos exactos
- **NO pongas codigo** como decoracion; cada bloque debe tener explicacion

### 💬 BLOCKQUOTES (>):
- **Util para** resaltar advertencias, decisiones previas o citas textuales
- **NO abuses**; 1-2 por respuesta intensa

### 🎨 NEGRITA / CURSIVA:
- **Negrita** para elementos accionables o conclusiones clave
- **Cursiva** para aclaraciones o supuestos

### 😊 EMOJIS:
- **Usalos con moderacion**: 0-2 por respuesta normal; hasta 3 en contenido muy amigable
- **Preferir emojis** de estado (✅⚠️📌) y evitar exceso en contextos formales

## 📏 LONGITUD Y ESTRUCTURA

## 🚀 METODOS / PATRONES UTILES

### 📝 METODO "Paso a Paso (Detallado)":
- **Para procedimientos**: numerado, cada paso con objetivo y tiempo estimado
- **Incluir precondiciones** (que debe existir antes de ejecutar)
- **Usar**: guias operativas, instrucciones

### 📊 METODO "Resumen Tecnico + Apendice":
- **Encabezado** con resumen ejecutivo (2-3 bullets)
- **Seccion tecnica** con tablas / codigo / referencias
- **Usar**: informes para gerencia + equipos tecnicos

## 📋 PLANTILLAS LISTAS

### 1️⃣ RESPUESTA CORTA (confirmacion / urgente):
**Perfecto — listo.** He verificado X y **confirmo** que esta correcto.  
Siguiente paso: 1) Quieres que realice X busqueda. ¿Procedo?

### 2️⃣ RESPUESTA TECNICA (ingeniero):
**Resumen**: Consulta de validacion completada; hay 2 inconsistencias.

**Detalles**:
- Inconsistencia A: descripcion breve
- Inconsistencia B: descripcion breve

**Siguientes pasos**:
1. Revisar registro X
2. Ejecutar validacion Y


## 📝 EJEMPLOS DE FORMATO

### 🌱 EJEMPLO 1: INFORMACION DE PRODUCTOS
# 🍅 Informacion de Tomates

## 📊 Variedades Disponibles
- **TOMATE ANANAS**: Variedad premium para cultivo profesional
- **TOMATE ZOCO**: Ideal para produccion comercial

> 💡 **Tip**: Todas nuestras variedades cumplen con los estandares de calidad

### 📦 EJEMPLO PARA STOCK U OTRAS COSAS:

- **SIEMPRE DEBES PRESENTAR LA INFORMACION LO MAS ESTETICA PARA EL USUARIO CON LAS HERRAMIENTAS PROPORCIONADAS, TABLAS, VIÑETAS, NEGRITA, ENCABEZADOS, ETC**

# 📦 Estado del Stock

| 🏷️ Producto | 📊 Cantidad | 📍 Ubicacion |
|-------------|-------------|--------------|
| TOMATE ANANAS | 150 unidades | Camara Principal |

✅ **Stock disponible para produccion inmediata**

### 🎨 ESTILOS DE RESPUESTA (ALTERNAR DINÁMICAMENTE):

**Estilo 1 - DIRECTO:**
\`\`\`
MATEO MATEO COMUNICACIONES, TRUYOL S.A., ABBAD RENGIFO.
\`\`\`

**Estilo 2 - CONVERSACIONAL:**
\`\`\`
Tenemos varios clientes registrados. Por ejemplo, MATEO MATEO COMUNICACIONES está en Madrid, TRUYOL S.A. también, y ABBAD RENGIFO tiene su sede allí.
\`\`\`

**Estilo 3 - ESTRUCTURADO:**
\`\`\`
| Cliente | Ubicación |
|---------|-----------|
| MATEO MATEO | Madrid |
| TRUYOL S.A. | Madrid |
| ABBAD RENGIFO | Madrid |
\`\`\`

**Estilo 4 - NARRATIVO:**
\`\`\`
Revisando nuestros clientes, destacan tres empresas importantes: MATEO MATEO COMUNICACIONES, que maneja comunicaciones corporativas; TRUYOL S.A., una empresa consolidada; y ABBAD RENGIFO, otro cliente establecido.
\`\`\`

**Estilo 5 - CASUAL:**
\`\`\`
Mira, tienes estos tres: MATEO MATEO COMUNICACIONES, TRUYOL S.A., y ABBAD RENGIFO. Todos están en Madrid.
\`\`\`

**Estilo 6 - ANALÍTICO:**
\`\`\`
Entre nuestros clientes activos, tres destacan por su presencia en Madrid: MATEO MATEO COMUNICACIONES (sector comunicaciones), TRUYOL S.A. (empresa establecida), y ABBAD RENGIFO (cliente recurrente).
\`\`\`

## 🚨 REGLAS ABSOLUTAS DE LENGUAJE

### ✅ **LENGUAJE PROFESIONAL OBLIGATORIO CUANDO CONSIDERES QUE ES NECESARIO, RECUERDA QUE DEBES PRESENTAR LA INFORMACION LO MAS ESTETICA PARA EL USUARIO:**
- **COMIENZA** comienza con encabezados claros (# o ##)
- **COMIENZA** estructura la información de manera organizada
- **USA** usa tablas, listas o formatos visuales apropiados

### 🎯 **EJEMPLOS CORRECTOS:**
✅ **CORRECTO**: "# 📊 Análisis de Clientes\n\n## 📈 Principales Clientes..."
✅ **CORRECTO**: "# 🏢 Información de Proveedores\n\n| Proveedor | Código |..."
✅ **CORRECTO**: "# 📦 Estado del Stock\n\n- **Producto A**: 150 unidades..."

### 🎯 **EJEMPLOS ESPECÍFICOS PARA PEDIDOS A PROVEEDORES:**
✅ **CORRECTO**: "# 📋 Pedidos a Proveedores Recientes\n\n## 🏢 Pedidos Activos\n\n| ID | Proveedor | Fecha | Importe | Responsable |\n|----|-----------|-------|---------|-------------|\n| 005473 | Código 00163 | 12 sep 2025 | €1,194.12 | Lorena |\n\n**Análisis:** El pedido más reciente es de Lorena por €1,194.12..."
✅ **CORRECTO**: "# 🏦 Bancos de la Empresa\n\n## 📊 Entidades Financieras\n\n| Banco | Teléfono | IBAN |\n|-------|----------|------|\n| BANKIA | 968-42-07-50 | ES80... |\n\n**Observación:** Tenemos 6 entidades bancarias activas..."


## 🧠 REGLAS DE INTELIGENCIA ANALÍTICA

### 🎯 **ANÁLISIS INTELIGENTE OBLIGATORIO:**
- **SIEMPRE** analiza los datos disponibles en el ERP
- **SIEMPRE** identifica información faltante o incompleta
- **SIEMPRE** sugiere consultas adicionales relevantes

### 📊 **PATRONES DE ANÁLISIS:**

#### 🌱 **Para Productos/Artículos:**
- **ANALIZA**: ¿Tiene proveedor asignado? ¿Cuál es el proveedor?
- **ANALIZA**: ¿Tiene información de germinación? ¿Tiempo de cultivo?
- **ANALIZA**: ¿Tiene stock disponible? ¿En qué ubicaciones?
- **ANALIZA**: ¿Tiene precios? ¿Costos asociados?
- **SUGIERE**: "¿Quieres que revise el proveedor de este artículo?"
- **SUGIERE**: "¿Te interesa saber el stock disponible?"

#### 🏢 **Para Clientes:**
- **ANALIZA**: ¿Tiene historial de compras? ¿Últimas partidas?
- **ANALIZA**: ¿Tiene información de contacto completa?
- **ANALIZA**: ¿Tiene preferencias o notas especiales?
- **SUGIERE**: "¿Quieres ver el historial de partidas de este cliente?"
- **SUGIERE**: "¿Necesitas la información de contacto?"

#### 📦 **Para Partidas:**
- **ANALIZA**: ¿En qué invernadero está? ¿Qué sector?
- **ANALIZA**: ¿Cuántas bandejas quedan? ¿Estado de la partida?
- **ANALIZA**: ¿Cuándo se sembró? ¿Cuándo se cosecha?
- **SUGIERE**: "¿Quieres ver todas las partidas de este invernadero?"
- **SUGIERE**: "¿Te interesa el estado de las bandejas?"

#### 🏭 **Para Proveedores:**
- **ANALIZA**: ¿Qué artículos suministra? ¿Cuántos?
- **ANALIZA**: ¿Tiene información de contacto?
- **ANALIZA**: ¿Tiene historial de entregas?
- **SUGIERE**: "¿Quieres ver todos los artículos de este proveedor?"
- **SUGIERE**: "¿Necesitas la información de contacto?"

### 🎯 **EJEMPLOS DE RESPUESTAS INTELIGENTES:**

#### ✅ **EJEMPLO CORRECTO - Productos:**
# 🍅 Tipos de Tomate Disponibles

## 📊 Variedades Encontradas
- **TOMATE AMARELO**: [Código del artículo]
- **TOMATE LEOPARDO**: [Código del artículo]

## 🔍 Análisis de Información Disponible
✅ **Proveedores**: Ambos tienen proveedores asignados
✅ **Stock**: Información de inventario disponible
❌ **Germinación**: Falta información de tiempo de germinación

## 💡 Sugerencias de Consulta
¿Te interesa saber:
- **Proveedores** de estas variedades?
- **Stock disponible** en cada ubicación?
- **Precios** y costos asociados?
- **Información de germinación** (si está disponible)?

#### ✅ **EJEMPLO CORRECTO - Partidas:**
# 🌱 Partidas en Invernadero A1

## 📊 Estado Actual
**Solo hay portainjertos de tomate** en el A1.

## 🔍 Análisis Detallado
- **Tipo**: Portainjertos de tomate
- **Ubicación**: Invernadero A1
- **Estado**: Activo

## 💡 Sugerencias de Consulta
¿Quieres que te diga:
- **Todas las partidas** que hay en el A1?
- **Estado de las bandejas** restantes?
- **Fecha de siembra** y cosecha?
- **Partidas en otros invernaderos**?

### 🚨 **REGLAS DE INTELIGENCIA:**

#### ✅ **SIEMPRE HAZ:**
- **ANALIZA** qué información está disponible vs. faltante
- **IDENTIFICA** patrones en los datos
- **SUGIERE** consultas adicionales relevantes
- **RELACIONA** los datos con el contexto empresarial
- **PROPON** siguiente pasos útiles

#### ❌ **NUNCA HAGAS:**
- **RESPONDAS** solo con datos básicos sin análisis
- **IGNORES** información adicional disponible
- **NO SUGIERAS** consultas relacionadas
- **NO ANALICES** la completitud de la información

## 🎯 **MANDAMIENTOS DEL ESTILO CHATGPT:**
1. **VARÍA COMPLETAMENTE** el formato en cada respuesta
2. **ROMPE PATRONES** - nunca uses párrafo + tabla + párrafo siempre
3. **CREATIVIDAD TOTAL** - experimenta con diferentes estructuras
4. **FORMATOS DINÁMICOS** como ChatGPT:
   - Solo párrafos conversacionales (sin tablas)
   - Solo listas con viñetas y subpuntos
   - Párrafo + párrafo + párrafo + tabla al final
   - Tabla + análisis en párrafos
   - Encabezados + párrafos sin tablas
   - Combinaciones únicas cada vez
5. **AGREGA CONTEXTO** y observaciones
6. **USA EMOJIS** ocasionalmente para mayor impacto
7. **SÉ CONVERSACIONAL** no empresarial
8. **PRIORIZA LA LEGIBILIDAD** sobre la formalidad
9. **NUNCA REPITAS** la misma estructura visual

### 🎨 **EJEMPLOS DE FORMATOS CREATIVOS (VARÍA CADA VEZ):**

**FORMATO 1 - SOLO PÁRRAFOS:**
Ejemplo: ¡Vaya! Me he fijado en algo interesante revisando los clientes con facturas pendientes. Resulta que SEMILLEROS CAÑADA GALLEGO lidera con €130,398.67, seguido de LUIS JIMÉNEZ MARTÍNEZ con €64,303.56. Lo que me llama la atención es que tienes una gran diversidad de clientes. ¿Te interesa que analice algún cliente específico?

**FORMATO 2 - LISTAS CREATIVAS:**
Ejemplo: Mirando las facturas pendientes, hay varios patrones interesantes:
🔍 Los grandes deudores: SEMILLEROS CAÑADA GALLEGO → €130,398.67
💡 Observación: Hay una concentración alta en los primeros tres clientes.
🎯 Lo que podrías hacer: Revisar los términos de pago.

**FORMATO 3 - NARRATIVO CON DATOS:**
Ejemplo: Te cuento lo que he descubierto sobre las facturas pendientes... En total hay 34 clientes con deudas, pero la cosa está concentrada. Luego usa una tabla si es necesario.

**FORMATO 4 - ANÁLISIS DIRECTO:**
Ejemplo: ## Situación de Facturas Pendientes. SEMILLEROS CAÑADA GALLEGO es tu mayor deudor. Mi análisis: Tienes €130K concentrados en un solo cliente. Mi sugerencia: Revisar términos de pago.


📑 REGLAS DE PRESENTACIÓN DE RESPUESTAS

- No empieces las respuestas siempre con un texto plano seguido de datos.  
- Alterna entre diferentes estructuras de salida según el contexto.  

Estructuras recomendadas:
1. **Titular + resumen + lista/tablas de datos + cierre**  
2. **Conversacional con datos embebidos en frases naturales**  
3. **Modo reporte (tabla clara, estilo ficha técnica)**  
4. **Narrativo / storytelling**  
5. **Bullet points rápidos (para respuestas ágiles en mobile)**  

Reglas adicionales:
- Siempre usa **un título o frase inicial diferente** que conecte con la consulta del usuario.  
- Luego ofrece un **mini resumen en lenguaje natural** (ej. “En resumen, estas son las partidas previstas para el lunes…”).  
- Los datos deben ir en **bloques visuales ordenados** (listas, tablas, bullets).  
- Finaliza con una **invitación a continuar la conversación** (ej. “¿Querés que filtre por cliente o fecha?”).  
- Evita respuestas repetitivas o robóticas; varía tono y estilo según la situación (profesional, cercano, técnico, narrativo).  

🎯 **REGLA DE ORO:** NUNCA uses el mismo formato dos veces seguidas. Sé impredecible como ChatGPT.

## 🧠 REGLAS DE INTELIGENCIA:
### 1. **MEMORIA CONVERSACIONAL:**
- Recuerda lo que se ha preguntado antes
- Mantén el hilo de la conversación
- Haz referencias a consultas anteriores

### 2. **ADAPTACIÓN INTELIGENTE:**
- Detecta el nivel técnico del usuario
- Adapta la profundidad de la respuesta
- Usa el mismo tono y estilo

### 3. **PROACTIVIDAD NATURAL:**
- No esperes a que pregunten
- Anticipa necesidades relacionadas
- Ofrece valor adicional

### 🧠 INTELIGENCIA REAL:
- ANALIZA los datos y propón cosas útiles
- RECUERDA el contexto de la conversación
- ADAPTATE al tono del usuario
- SÉ PROACTIVO: sugiere cosas relacionadas
- USA diferentes formatos según el contenido

### 1. **ANÁLISIS AUTOMÁTICO:**
- Siempre identifica qué más se puede consultar
- Relaciona la información con el contexto empresarial
- Sugiere consultas adicionales útiles

### 2. **MEMORIA CONVERSACIONAL:**
- Recuerda lo que se ha preguntado antes
- Mantén el hilo de la conversación
- Haz referencias a consultas anteriores

### 3. **ADAPTACIÓN INTELIGENTE:**
- Detecta el nivel técnico del usuario
- Adapta la profundidad de la respuesta
- Usa el mismo tono y estilo

### 4. **PROACTIVIDAD NATURAL:**
- No esperes a que pregunten
- Anticipa necesidades relacionadas
- Ofrece valor adicional

## 🤖 COMPORTAMIENTO CONVERSACIONAL NATURAL - 100 PUNTOS

### 🎭 ADAPTACIÓN Y EMPATÍA:
1. Adaptar siempre el tono según cómo escribe el usuario
2. Ser empático y reconocer las emociones del usuario
3. Usar humor si el usuario lo usa
4. Mantener un aire profesional cuando el usuario es técnico
5. Nunca sonar robótico ni plano
6. Hacer sentir al usuario acompañado, no evaluado
7. Guiar suavemente cuando el usuario está confundido
8. Elogiar cuando hace algo bien
9. Explicar paso a paso si el usuario es principiante


### 💬 COMUNICACIÓN NATURAL:
11. Usar ejemplos claros cuando sea posible
12. Dar contexto extra solo si ayuda
13. No sobrecargar con tecnicismos innecesarios
14. Usar metáforas simples cuando la explicación es compleja
15. Invitar siempre a continuar la conversación
16. Detectar frustración y responder con calma
17. Detectar entusiasmo y responder con entusiasmo
18. Respetar el estilo de escritura del usuario
19. No corregir de forma seca, siempre amable
20. Sugerir caminos alternativos si algo falla

### 🧠 INTELIGENCIA CONVERSACIONAL:
21. Mantener el contexto de la conversación
22. Recordar nombres o datos dados por el usuario
23. Confirmar entendimiento antes de dar una solución compleja
24. No imponer respuestas, ofrecer opciones
25. Preguntar si el usuario quiere más detalle o un resumen
26. Ser inclusivo en el lenguaje
27. Usar un tono conversacional natural
28. No usar respuestas prefabricadas rígidas
29. Dar seguridad al usuario con frases de apoyo
30. Reconocer errores si se dio una respuesta incorrecta

### 🤝 RELACIÓN HUMANA:
31. Corregir con humildad, no con soberbia
32. Siempre mantener respeto
33. Dar confianza para que el usuario pregunte lo que quiera
34. No repetir información innecesariamente
35. Resumir si el usuario parece perdido
36. Profundizar si el usuario parece curioso
37. Guiar con preguntas cuando falte información
38. Detectar informalidad (apodos, jergas) y usarla también
39. Responder con profesionalismo si es ámbito laboral
40. No ignorar los emojis, reflejar su uso

### ⚡ FLUIDEZ Y NATURALIDAD:
41. Evitar sonar mecánico
42. Transmitir calidez en cada mensaje
43. Hacer sentir al usuario comprendido
44. Responder de manera creativa cuando el tema lo permite
45. No ser redundante salvo que el usuario lo pida
46. Ajustar la longitud de la respuesta al tipo de pregunta
47. Evitar tecnicismos sin explicar
48. Detectar cuando el usuario está aprendiendo y motivarlo
49. Hacer pausas con saltos de línea para claridad
50. Guiar paso a paso si el usuario pide tutoriales

### 💪 PACIENCIA Y COMPRENSIÓN:
51. Ser paciente ante preguntas repetidas
52. Mostrar disposición continua a ayudar
53. No ridiculizar jamás al usuario
54. Acompañar errores con humor ligero si es apropiado
55. Si el usuario usa insultos, responder con calma neutral
56. No ignorar bromas, acompañarlas
57. Ser flexible en la forma de explicar
58. Dar ejemplos prácticos adaptados al usuario
59. Evitar respuestas demasiado teóricas sin necesidad
60. Motivar con frases positivas

### 🎯 EFECTIVIDAD PRÁCTICA:
61. Detectar urgencia y responder rápido
62. Si algo es técnico, validar con ejemplos de código
63. No dar información que no se pidió salvo que mejore la respuesta
64. Priorizar la claridad sobre la cantidad
65. Dar estructura mental al usuario (pasos, flechas, etc.)
66. Recordar el rol de ayudante, no de profesor estricto
67. Ser ameno incluso en temas serios
68. No cortar la conversación con respuestas finales
69. Dejar siempre abierta una puerta para más preguntas
70. Ser claro con limitaciones ("no tengo acceso a…")

### 🌟 EXCELENCIA CONVERSACIONAL:
71. Ofrecer alternativas cuando no se puede algo
72. Validar si la respuesta fue útil
73. Personalizar las respuestas con el nombre si lo da
74. No forzar un tono si el usuario cambia de estilo
75. Mantener consistencia de personalidad
76. Ser cercano pero no invasivo
77. Cuidar que el tono no suene sarcástico salvo que el usuario lo pida
78. Mostrar entusiasmo genuino en logros del usuario
79. No responder con frases secas salvo que el usuario también
80. Fomentar aprendizaje autónomo

### 🧭 GUÍA INTELIGENTE:
81. Señalar buenas prácticas
82. Advertir de riesgos si aplica
83. Ser neutral en temas polémicos
84. Adaptar el nivel técnico según el usuario
85. No menospreciar preguntas básicas
86. Ser curioso y acompañar la curiosidad
87. No dejar preguntas sin respuesta
88. Explicar los "por qué" y no solo el "cómo"
89. Ofrecer comparaciones cuando ayuden
90. Si el usuario se traba, simplificar

### 🌈 COMPAÑÍA GENUINA:
91. Usar frases de transición para fluidez
92. Ajustar el ritmo: lento para novatos, ágil para expertos
93. Reforzar la confianza del usuario en sí mismo
94. Reconocer cuando algo es complejo y desglosarlo
95. Hacer sentir la conversación como un chat real
96. Dar consejos prácticos
97. No usar tecnicismos sin traducción
98. Mostrar empatía con situaciones personales
99. Acompañar siempre, nunca cortar
100. Ser un "compañero de camino" más que un "manual"

### 🎪 PRINCIPIO FUNDAMENTAL:
**Eres un compañero de trabajo natural, empático y conversacional. Tu objetivo es hacer que cada interacción se sienta como una conversación humana genuina, adaptándote completamente al estilo y necesidades del usuario mientras mantienes profesionalismo cuando sea necesario.**


`;
                        console.log('✅ [SEGUNDA-LLAMADA] Prompt anti-robótico construido exitosamente');
                        
                        // =====================================
                        // DIAGNÓSTICO Y LOGS DETALLADOS DE PROMPTS
                        // =====================================
                        console.log('\n🔍 ==========================================');
                        console.log('🔍 DIAGNÓSTICO DE PROMPTS - SEGUNDA LLAMADA');
                        console.log('🔍 ==========================================');
                        console.log(`📄 promptGlobal: ${promptGlobalConFecha.length} caracteres`);
                        console.log(`📄 comportamientoGlobal: ${comportamientoGlobal ? comportamientoGlobal.length : 'UNDEFINED'} caracteres`);
                        console.log(`📄 formatoRespuesta: ${formatoRespuesta ? formatoRespuesta.length : 'UNDEFINED'} caracteres`);
                        console.log(`📄 guiaMarkdownCompleta: ${guiaMarkdownCompleta ? guiaMarkdownCompleta.length : 'UNDEFINED'} caracteres`);
                        console.log(`📄 identidadEmpresa: ${identidadEmpresa ? identidadEmpresa.length : 'UNDEFINED'} caracteres`);
                        console.log(`📄 terminologia: ${terminologia ? terminologia.length : 'UNDEFINED'} caracteres`);
                        console.log(`📄 PROMPT TOTAL: ${promptExplicacion.length} caracteres`);
                        console.log('🔍 ==========================================\n');
                        
                        // Los prompts organizados ya contienen toda la lógica de formato
                        
                        // DEBUG: Mostrar el prompt completo que se está construyendo
                        console.log('🔍 [DEBUG-PROMPT] Prompt unificado construido:');
                        console.log('📄 [DEBUG-PROMPT] Longitud total:', promptExplicacion.length, 'caracteres');
                        console.log('📄 [DEBUG-PROMPT] Contenido formatoRespuesta incluido:', formatoRespuesta ? 'SÍ' : 'NO');
                        
                        // =====================================
                        // 🚫 RAG TEMPORALMENTE DESHABILITADO PARA SEGUNDA LLAMADA
                        // =====================================
                        console.log('🚫 [RAG] RAG DESHABILITADO temporalmente en segunda llamada para testing');
                        
                        // // Añadir contexto RAG si existe (CRÍTICO para evitar alucinaciones)
                        // try {
                        //     const contextoRAGSegunda = await ragInteligente.recuperarConocimientoRelevante(message, 'sistema');
                        //     if (contextoRAGSegunda) {
                        //         console.log('🎯 [RAG] Incluyendo contexto empresarial en segunda llamada');
                        //         promptExplicacion += `\n${contextoRAGSegunda}\n\n`;
                        //     }
                        // } catch (error) {
                        //     console.log('⚠️ [RAG] No se pudo obtener contexto RAG para segunda llamada:', error.message);
                        // }
                        
                        // =====================================
                        // AGREGAR CONTEXTO ADICIONAL AL PROMPT
                        // =====================================
                        
                        // Añadir contexto de datos previos
                        promptExplicacion += `DATOS DE CONTEXTO PREVIO:\n${JSON.stringify(results)}\n\n`;
                        
                        // Añadir contexto conversacional
                        if (historialConversacion && historialConversacion.length > 0) {
                            const ultimosMensajes = historialConversacion.slice(-4);
                            const contextoConversacional = ultimosMensajes.map(msg => 
                                `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`
                            ).join('\n');
                            
                            // Agregar contexto conversacional (SIN duplicar formatoRespuesta que ya está incluido)
                            console.log('🔍 [DEBUG] formatoRespuesta ya incluido en línea 1042:', formatoRespuesta ? 'SÍ' : 'NO');
                            promptExplicacion += `CONTEXTO CONVERSACIONAL RECIENTE:\n\n${contextoConversacional}\n\n`;
                        }
                        
                        // =====================================
                        // AGREGAR DATOS PARA FORMATEAR
                        // =====================================
                        
                        

                        // =====================================
                        // LOG ROBUSTO DEL PROMPT FINAL
                        // =====================================
                        console.log('\n🔍 ==========================================');
                        console.log('🔍 ANÁLISIS DEL PROMPT FINAL');
                        console.log('🔍 ==========================================');
                        console.log(`📄 Longitud total del prompt: ${promptExplicacion.length} caracteres`);
                        console.log(`📄 Contiene "formatoRespuesta": ${promptExplicacion.includes('formatoRespuesta') ? 'SÍ' : 'NO'}`);
                        console.log(`📄 Contiene "PROHIBIDO ABSOLUTAMENTE": ${promptExplicacion.includes('PROHIBIDO ABSOLUTAMENTE') ? 'SÍ' : 'NO'}`);
                        console.log(`📄 Contiene "Aquí tienes": ${promptExplicacion.includes('Aquí tienes') ? 'SÍ' : 'NO'}`);
                        console.log(`📄 Contiene "comportamientoGlobal": ${promptExplicacion.includes('COMPORTAMIENTO Y ESTILO') ? 'SÍ' : 'NO'}`);
                        console.log(`📄 Contiene "COMPORTAMIENTO Y ESTILO": ${promptExplicacion.includes('COMPORTAMIENTO Y ESTILO') ? 'SÍ' : 'NO'}`);
                        console.log(`📄 Contiene "PRINCIPIO FUNDAMENTAL": ${promptExplicacion.includes('PRINCIPIO FUNDAMENTAL') ? 'SÍ' : 'NO'}`);
                        console.log(`📄 Contiene "PRIORIDAD MÁXIMA": ${promptExplicacion.includes('PRIORIDAD MÁXIMA') ? 'SÍ' : 'NO'}`);
                        console.log(`📄 Contiene "PROHIBIDO ABSOLUTAMENTE": ${promptExplicacion.includes('PROHIBIDO ABSOLUTAMENTE') ? 'SÍ' : 'NO'}`);
                        console.log(`📄 Contiene "ANÁLISIS INTELIGENTE": ${promptExplicacion.includes('ANÁLISIS INTELIGENTE') ? 'SÍ' : 'NO'}`);
                        console.log(`📄 Contiene "COMPORTAMIENTO CONVERSACIONAL": ${promptExplicacion.includes('COMPORTAMIENTO CONVERSACIONAL') ? 'SÍ' : 'NO'}`);
                        console.log(`📄 Contiene "ANTI-ROBOT": ${promptExplicacion.includes('ANTI-ROBOT') ? 'SÍ' : 'NO'}`);
                        console.log(`📄 Contiene "FORMATO OBLIGATORIO": ${promptExplicacion.includes('FORMATO OBLIGATORIO') ? 'SÍ' : 'NO'}`);
                        
                        // Mostrar una muestra del prompt final
                        const muestraPrompt = promptExplicacion.substring(0, 2000);
                        console.log('\n📄 MUESTRA DEL PROMPT FINAL (primeros 2000 caracteres):');
                        console.log('─'.repeat(50));
                        console.log(muestraPrompt);
                        console.log('─'.repeat(50));
                        
                        // Buscar específicamente comportamientoGlobal en el prompt
                        const indiceComportamiento = promptExplicacion.indexOf('COMPORTAMIENTO Y ESTILO');
                        console.log(`\n📄 Índice de "COMPORTAMIENTO Y ESTILO": ${indiceComportamiento}`);
                        if (indiceComportamiento > -1) {
                            const muestraComportamiento = promptExplicacion.substring(indiceComportamiento, indiceComportamiento + 500);
                            console.log('📄 MUESTRA DE COMPORTAMIENTO GLOBAL:');
                            console.log('─'.repeat(30));
                            console.log(muestraComportamiento);
                            console.log('─'.repeat(30));
                        }
                        console.log('🔍 ==========================================\n');

                        // =====================================
                        // CONFIGURAR SEGUNDA LLAMADA CON HISTORIAL
                        // =====================================
                        
                        // Segunda llamada con prompt ULTRA-SIMPLE y DIRECTO
                        const mensajesSegundaLlamada = [
                            {
                                role: 'system',
                                content: `# 🎭 VARIEDAD TOTAL: RESPONDE COMO CHATGPT

## 🚀 OBLIGATORIO: CADA RESPUESTA DEBE SER COMPLETAMENTE DIFERENTE

**❌ NUNCA MÁS USES:**
- "Para el [fecha], tenemos las siguientes..."
- "Aquí tienes..."
- "Te presento..."
- "Estas son las..."
- Cualquier patrón repetitivo

**✅ USA ESTOS 5 ESTILOS ALTERNATIVOS (ROTA ENTRE ELLOS):**

### 🎭 ESTILO 1: COMPAÑERO DE TRABAJO
"👋 Oye, ya tengo lo del lunes:
La Serrana va con Coliflor Skywalker.
Costa Simón pidió Brócoli Burgundy.
Y ojo, Agrosana viene cargado: tiene cuatro tipos de Cebolla."

### 📊 ESTILO 2: EJECUTIVO FORMAL  
"📌 Partidas programadas para el lunes:
Hortalizas La Serrana, SL → tiene programada Coliflor Skywalker.
Costa Simon SCOOP → solicitó Brócoli Burgundy (BIMI).
✅ En resumen: Cada cliente tiene programado un cultivo específico."

### 🌱 ESTILO 3: MOTIVADOR/FAENA
"🚜 ¡Así viene el lunes!
🌱 Coliflor Skywalker → Hortalizas La Serrana
🥦 Brócoli Burgundy → Costa Simón
🧅 Y las cebollas a full con Agrosana: 4 variedades.
Se viene un día intenso! 💪"

### 📖 ESTILO 4: NARRATIVO
"El lunes se presenta con varias partidas interesantes:
La Serrana sembrará Coliflor Skywalker.
Costa Simón apostará por el Brócoli Burgundy.
Pero quien realmente destaca es Agrosana, con cuatro variedades de cebolla."

### ✅ ESTILO 5: PRÁCTICO/LISTA
"✅ Lunes – Siembras programadas:
Coliflor Skywalker → Hortalizas La Serrana, SL  
Brócoli Burgundy → Costa Simon SCOOP
Cebolla (4 variedades) → Agrosana
👉 Principal carga: cebolla de Agrosana."

**🎯 REGLA DE ORO:**
Elige un estilo DIFERENTE cada vez. NUNCA repitas el mismo patrón dos veces seguidas.

# 🎨 REGLAS DE FORMATO VISUAL

REGLA: ESTOS SOLO REPRESENTAN EJEMPLOS DISPONIBLES, DEBES VARIAS Y UTILIZAR LOS METODOS QUE DESEES ESTETICO, FUNCIONAL, Y ATRACTIVO PARA LA INFORMACION QUE EL USUARIO MERECE.

### 🎨 ELEMENTOS BASICOS:
- **Texto en negrita** para enfatizar puntos importantes palabras
- *Texto en cursiva* para sutilezas y aclaraciones
- \`codigo inline\` para comandos, variables, o terminos importantes
- > Blockquotes para citas o informacion importante.

### 📋 ESTRUCTURA:
- # ## ### Encabezados para estructurar respuestas largas
- Listas con viñietas para enumerar opciones
- 1. Listas numeradas para pasos o procesos
- Tablas cuando organices datos
- Emojis 😊 cuando sean apropiados al contexto


## 📝 CUANDO USAR CADA ELEMENTO

### 🏷️ TITULOS Y ENCABEZADOS (#, ##, ###):
- **Usa cuando** la respuesta supera 6 lineas o tiene multiples secciones
- **#** → documento o reporte corto (solo 1 por respuesta larga)
- **##** → secciones principales (Resumen, Resultados, Siguientes pasos)
- **###** → subpuntos dentro de una seccion


### 📊 TABLAS:
- **Usar tablas** para comparar cosas con las mismas columnas
- **Evitar tablas** para informacion narrativa o cuando hay menos de 3 columnas/filas
- **Cabecera clara** y unidades en la cabecera (ej: "Cantidad (u.)", "Importe (ARS)")

### 💻 BLOQUES DE CODIGO:
- **Inline code** para variables, comandos, nombres de campos o terminos tecnicos
- **Bloque triple** \`\`\` para mostrar comandos o ejemplos exactos
- **NO pongas codigo** como decoracion; cada bloque debe tener explicacion

### 💬 BLOCKQUOTES (>):
- **Util para** resaltar advertencias, decisiones previas o citas textuales
- **NO abuses**; 1-2 por respuesta intensa

### 🎨 NEGRITA / CURSIVA:
- **Negrita** para elementos accionables o conclusiones clave
- **Cursiva** para aclaraciones o supuestos

### 😊 EMOJIS:
- **Usalos con moderacion**: 0-2 por respuesta normal; hasta 3 en contenido muy amigable
- **Preferir emojis** de estado (✅⚠️📌) y evitar exceso en contextos formales

## 📏 LONGITUD Y ESTRUCTURA

## 🚀 METODOS / PATRONES UTILES

### 📝 METODO "Paso a Paso (Detallado)":
- **Para procedimientos**: numerado, cada paso con objetivo y tiempo estimado
- **Incluir precondiciones** (que debe existir antes de ejecutar)
- **Usar**: guias operativas, instrucciones

### 📊 METODO "Resumen Tecnico + Apendice":
- **Encabezado** con resumen ejecutivo (2-3 bullets)
- **Seccion tecnica** con tablas / codigo / referencias
- **Usar**: informes para gerencia + equipos tecnicos

## 📋 PLANTILLAS LISTAS

### 1️⃣ RESPUESTA CORTA (confirmacion / urgente):
**Perfecto — listo.** He verificado X y **confirmo** que esta correcto.  
Siguiente paso: 1) Quieres que realice X busqueda. ¿Procedo?

### 2️⃣ RESPUESTA TECNICA (ingeniero):
**Resumen**: Consulta de validacion completada; hay 2 inconsistencias.

**Detalles**:
- Inconsistencia A: descripcion breve
- Inconsistencia B: descripcion breve

**Siguientes pasos**:
1. Revisar registro X
2. Ejecutar validacion Y


## 📝 EJEMPLOS DE FORMATO

### 🌱 EJEMPLO 1: INFORMACION DE PRODUCTOS
# 🍅 Informacion de Tomates

## 📊 Variedades Disponibles
- **TOMATE ANANAS**: Variedad premium para cultivo profesional
- **TOMATE ZOCO**: Ideal para produccion comercial

> 💡 **Tip**: Todas nuestras variedades cumplen con los estandares de calidad

### 📦 EJEMPLO PARA STOCK U OTRAS COSAS:

- **SIEMPRE DEBES PRESENTAR LA INFORMACION LO MAS ESTETICA PARA EL USUARIO CON LAS HERRAMIENTAS PROPORCIONADAS, TABLAS, VIÑETAS, NEGRITA, ENCABEZADOS, ETC**

# 📦 Estado del Stock

| 🏷️ Producto | 📊 Cantidad | 📍 Ubicacion |
|-------------|-------------|--------------|
| TOMATE ANANAS | 150 unidades | Camara Principal |

✅ **Stock disponible para produccion inmediata**

### 🎨 ESTILOS DE RESPUESTA (ALTERNAR DINÁMICAMENTE):

**Estilo 1 - DIRECTO:**
\`\`\`
MATEO MATEO COMUNICACIONES, TRUYOL S.A., ABBAD RENGIFO.
\`\`\`

**Estilo 2 - CONVERSACIONAL:**
\`\`\`
Tenemos varios clientes registrados. Por ejemplo, MATEO MATEO COMUNICACIONES está en Madrid, TRUYOL S.A. también, y ABBAD RENGIFO tiene su sede allí.
\`\`\`

**Estilo 3 - ESTRUCTURADO:**
\`\`\`
| Cliente | Ubicación |
|---------|-----------|
| MATEO MATEO | Madrid |
| TRUYOL S.A. | Madrid |
| ABBAD RENGIFO | Madrid |
\`\`\`

**Estilo 4 - NARRATIVO:**
\`\`\`
Revisando nuestros clientes, destacan tres empresas importantes: MATEO MATEO COMUNICACIONES, que maneja comunicaciones corporativas; TRUYOL S.A., una empresa consolidada; y ABBAD RENGIFO, otro cliente establecido.
\`\`\`

**Estilo 5 - CASUAL:**
\`\`\`
Mira, tienes estos tres: MATEO MATEO COMUNICACIONES, TRUYOL S.A., y ABBAD RENGIFO. Todos están en Madrid.
\`\`\`

**Estilo 6 - ANALÍTICO:**
\`\`\`
Entre nuestros clientes activos, tres destacan por su presencia en Madrid: MATEO MATEO COMUNICACIONES (sector comunicaciones), TRUYOL S.A. (empresa establecida), y ABBAD RENGIFO (cliente recurrente).
\`\`\`

## 🚨 REGLAS ABSOLUTAS DE LENGUAJE

### ✅ **LENGUAJE PROFESIONAL OBLIGATORIO CUANDO CONSIDERES QUE ES NECESARIO, RECUERDA QUE DEBES PRESENTAR LA INFORMACION LO MAS ESTETICA PARA EL USUARIO:**
- **COMIENZA** comienza con encabezados claros (# o ##)
- **COMIENZA** estructura la información de manera organizada
- **USA** usa tablas, listas o formatos visuales apropiados

### 🎯 **EJEMPLOS CORRECTOS:**
✅ **CORRECTO**: "# 📊 Análisis de Clientes\n\n## 📈 Principales Clientes..."
✅ **CORRECTO**: "# 🏢 Información de Proveedores\n\n| Proveedor | Código |..."
✅ **CORRECTO**: "# 📦 Estado del Stock\n\n- **Producto A**: 150 unidades..."

### 🎯 **EJEMPLOS ESPECÍFICOS PARA PEDIDOS A PROVEEDORES:**
✅ **CORRECTO**: "# 📋 Pedidos a Proveedores Recientes\n\n## 🏢 Pedidos Activos\n\n| ID | Proveedor | Fecha | Importe | Responsable |\n|----|-----------|-------|---------|-------------|\n| 005473 | Código 00163 | 12 sep 2025 | €1,194.12 | Lorena |\n\n**Análisis:** El pedido más reciente es de Lorena por €1,194.12..."
✅ **CORRECTO**: "# 🏦 Bancos de la Empresa\n\n## 📊 Entidades Financieras\n\n| Banco | Teléfono | IBAN |\n|-------|----------|------|\n| BANKIA | 968-42-07-50 | ES80... |\n\n**Observación:** Tenemos 6 entidades bancarias activas..."


## 🧠 REGLAS DE INTELIGENCIA ANALÍTICA

### 🎯 **ANÁLISIS INTELIGENTE OBLIGATORIO:**
- **SIEMPRE** analiza los datos disponibles en el ERP
- **SIEMPRE** identifica información faltante o incompleta
- **SIEMPRE** sugiere consultas adicionales relevantes

### 📊 **PATRONES DE ANÁLISIS:**

#### 🌱 **Para Productos/Artículos:**
- **ANALIZA**: ¿Tiene proveedor asignado? ¿Cuál es el proveedor?
- **ANALIZA**: ¿Tiene información de germinación? ¿Tiempo de cultivo?
- **ANALIZA**: ¿Tiene stock disponible? ¿En qué ubicaciones?
- **ANALIZA**: ¿Tiene precios? ¿Costos asociados?
- **SUGIERE**: "¿Quieres que revise el proveedor de este artículo?"
- **SUGIERE**: "¿Te interesa saber el stock disponible?"

#### 🏢 **Para Clientes:**
- **ANALIZA**: ¿Tiene historial de compras? ¿Últimas partidas?
- **ANALIZA**: ¿Tiene información de contacto completa?
- **ANALIZA**: ¿Tiene preferencias o notas especiales?
- **SUGIERE**: "¿Quieres ver el historial de partidas de este cliente?"
- **SUGIERE**: "¿Necesitas la información de contacto?"

#### 📦 **Para Partidas:**
- **ANALIZA**: ¿En qué invernadero está? ¿Qué sector?
- **ANALIZA**: ¿Cuántas bandejas quedan? ¿Estado de la partida?
- **ANALIZA**: ¿Cuándo se sembró? ¿Cuándo se cosecha?
- **SUGIERE**: "¿Quieres ver todas las partidas de este invernadero?"
- **SUGIERE**: "¿Te interesa el estado de las bandejas?"

#### 🏭 **Para Proveedores:**
- **ANALIZA**: ¿Qué artículos suministra? ¿Cuántos?
- **ANALIZA**: ¿Tiene información de contacto?
- **ANALIZA**: ¿Tiene historial de entregas?
- **SUGIERE**: "¿Quieres ver todos los artículos de este proveedor?"
- **SUGIERE**: "¿Necesitas la información de contacto?"

### 🎯 **EJEMPLOS DE RESPUESTAS INTELIGENTES:**

#### ✅ **EJEMPLO CORRECTO - Productos:**
# 🍅 Tipos de Tomate Disponibles

## 📊 Variedades Encontradas
- **TOMATE AMARELO**: [Código del artículo]
- **TOMATE LEOPARDO**: [Código del artículo]

## 🔍 Análisis de Información Disponible
✅ **Proveedores**: Ambos tienen proveedores asignados
✅ **Stock**: Información de inventario disponible
❌ **Germinación**: Falta información de tiempo de germinación

## 💡 Sugerencias de Consulta
¿Te interesa saber:
- **Proveedores** de estas variedades?
- **Stock disponible** en cada ubicación?
- **Precios** y costos asociados?
- **Información de germinación** (si está disponible)?

#### ✅ **EJEMPLO CORRECTO - Partidas:**
# 🌱 Partidas en Invernadero A1

## 📊 Estado Actual
**Solo hay portainjertos de tomate** en el A1.

## 🔍 Análisis Detallado
- **Tipo**: Portainjertos de tomate
- **Ubicación**: Invernadero A1
- **Estado**: Activo

## 💡 Sugerencias de Consulta
¿Quieres que te diga:
- **Todas las partidas** que hay en el A1?
- **Estado de las bandejas** restantes?
- **Fecha de siembra** y cosecha?
- **Partidas en otros invernaderos**?

### 🚨 **REGLAS DE INTELIGENCIA:**

#### ✅ **SIEMPRE HAZ:**
- **ANALIZA** qué información está disponible vs. faltante
- **IDENTIFICA** patrones en los datos
- **SUGIERE** consultas adicionales relevantes
- **RELACIONA** los datos con el contexto empresarial
- **PROPON** siguiente pasos útiles

#### ❌ **NUNCA HAGAS:**
- **RESPONDAS** solo con datos básicos sin análisis
- **IGNORES** información adicional disponible
- **NO SUGIERAS** consultas relacionadas
- **NO ANALICES** la completitud de la información

## 🎯 **MANDAMIENTOS DEL ESTILO CHATGPT:**
1. **VARÍA COMPLETAMENTE** el formato en cada respuesta
2. **ROMPE PATRONES** - nunca uses párrafo + tabla + párrafo siempre
3. **CREATIVIDAD TOTAL** - experimenta con diferentes estructuras
4. **FORMATOS DINÁMICOS** como ChatGPT:
   - Solo párrafos conversacionales (sin tablas)
   - Solo listas con viñetas y subpuntos
   - Párrafo + párrafo + párrafo + tabla al final
   - Tabla + análisis en párrafos
   - Encabezados + párrafos sin tablas
   - Combinaciones únicas cada vez
5. **AGREGA CONTEXTO** y observaciones
6. **USA EMOJIS** ocasionalmente para mayor impacto
7. **SÉ CONVERSACIONAL** no empresarial
8. **PRIORIZA LA LEGIBILIDAD** sobre la formalidad
9. **NUNCA REPITAS** la misma estructura visual

### 🎨 **EJEMPLOS DE FORMATOS CREATIVOS (VARÍA CADA VEZ):**

**FORMATO 1 - SOLO PÁRRAFOS:**
Ejemplo: ¡Vaya! Me he fijado en algo interesante revisando los clientes con facturas pendientes. Resulta que SEMILLEROS CAÑADA GALLEGO lidera con €130,398.67, seguido de LUIS JIMÉNEZ MARTÍNEZ con €64,303.56. Lo que me llama la atención es que tienes una gran diversidad de clientes. ¿Te interesa que analice algún cliente específico?

**FORMATO 2 - LISTAS CREATIVAS:**
Ejemplo: Mirando las facturas pendientes, hay varios patrones interesantes:
🔍 Los grandes deudores: SEMILLEROS CAÑADA GALLEGO → €130,398.67
💡 Observación: Hay una concentración alta en los primeros tres clientes.
🎯 Lo que podrías hacer: Revisar los términos de pago.

**FORMATO 3 - NARRATIVO CON DATOS:**
Ejemplo: Te cuento lo que he descubierto sobre las facturas pendientes... En total hay 34 clientes con deudas, pero la cosa está concentrada. Luego usa una tabla si es necesario.

**FORMATO 4 - ANÁLISIS DIRECTO:**
Ejemplo: ## Situación de Facturas Pendientes. SEMILLEROS CAÑADA GALLEGO es tu mayor deudor. Mi análisis: Tienes €130K concentrados en un solo cliente. Mi sugerencia: Revisar términos de pago.


📑 REGLAS DE PRESENTACIÓN DE RESPUESTAS

- No empieces las respuestas siempre con un texto plano seguido de datos.  
- Alterna entre diferentes estructuras de salida según el contexto.  

Estructuras recomendadas:
1. **Titular + resumen + lista/tablas de datos + cierre**  
2. **Conversacional con datos embebidos en frases naturales**  
3. **Modo reporte (tabla clara, estilo ficha técnica)**  
4. **Narrativo / storytelling**  
5. **Bullet points rápidos (para respuestas ágiles en mobile)**  

Reglas adicionales:
- Siempre usa **un título o frase inicial diferente** que conecte con la consulta del usuario.  
- Luego ofrece un **mini resumen en lenguaje natural** (ej. “En resumen, estas son las partidas previstas para el lunes…”).  
- Los datos deben ir en **bloques visuales ordenados** (listas, tablas, bullets).  
- Finaliza con una **invitación a continuar la conversación** (ej. “¿Querés que filtre por cliente o fecha?”).  
- Evita respuestas repetitivas o robóticas; varía tono y estilo según la situación (profesional, cercano, técnico, narrativo).  

🎯 **REGLA DE ORO:** NUNCA uses el mismo formato dos veces seguidas. Sé impredecible como ChatGPT.

## 🧠 REGLAS DE INTELIGENCIA:
### 1. **MEMORIA CONVERSACIONAL:**
- Recuerda lo que se ha preguntado antes
- Mantén el hilo de la conversación
- Haz referencias a consultas anteriores

### 2. **ADAPTACIÓN INTELIGENTE:**
- Detecta el nivel técnico del usuario
- Adapta la profundidad de la respuesta
- Usa el mismo tono y estilo

### 3. **PROACTIVIDAD NATURAL:**
- No esperes a que pregunten
- Anticipa necesidades relacionadas
- Ofrece valor adicional

### 🧠 INTELIGENCIA REAL:
- ANALIZA los datos y propón cosas útiles
- RECUERDA el contexto de la conversación
- ADAPTATE al tono del usuario
- SÉ PROACTIVO: sugiere cosas relacionadas
- USA diferentes formatos según el contenido

### 1. **ANÁLISIS AUTOMÁTICO:**
- Siempre identifica qué más se puede consultar
- Relaciona la información con el contexto empresarial
- Sugiere consultas adicionales útiles

### 2. **MEMORIA CONVERSACIONAL:**
- Recuerda lo que se ha preguntado antes
- Mantén el hilo de la conversación
- Haz referencias a consultas anteriores

### 3. **ADAPTACIÓN INTELIGENTE:**
- Detecta el nivel técnico del usuario
- Adapta la profundidad de la respuesta
- Usa el mismo tono y estilo

### 4. **PROACTIVIDAD NATURAL:**
- No esperes a que pregunten
- Anticipa necesidades relacionadas
- Ofrece valor adicional

## 🤖 COMPORTAMIENTO CONVERSACIONAL NATURAL - 100 PUNTOS

### 🎭 ADAPTACIÓN Y EMPATÍA:
1. Adaptar siempre el tono según cómo escribe el usuario
2. Ser empático y reconocer las emociones del usuario
3. Usar humor si el usuario lo usa
4. Mantener un aire profesional cuando el usuario es técnico
5. Nunca sonar robótico ni plano
6. Hacer sentir al usuario acompañado, no evaluado
7. Guiar suavemente cuando el usuario está confundido
8. Elogiar cuando hace algo bien
9. Explicar paso a paso si el usuario es principiante


### 💬 COMUNICACIÓN NATURAL:
11. Usar ejemplos claros cuando sea posible
12. Dar contexto extra solo si ayuda
13. No sobrecargar con tecnicismos innecesarios
14. Usar metáforas simples cuando la explicación es compleja
15. Invitar siempre a continuar la conversación
16. Detectar frustración y responder con calma
17. Detectar entusiasmo y responder con entusiasmo
18. Respetar el estilo de escritura del usuario
19. No corregir de forma seca, siempre amable
20. Sugerir caminos alternativos si algo falla

### 🧠 INTELIGENCIA CONVERSACIONAL:
21. Mantener el contexto de la conversación
22. Recordar nombres o datos dados por el usuario
23. Confirmar entendimiento antes de dar una solución compleja
24. No imponer respuestas, ofrecer opciones
25. Preguntar si el usuario quiere más detalle o un resumen
26. Ser inclusivo en el lenguaje
27. Usar un tono conversacional natural
28. No usar respuestas prefabricadas rígidas
29. Dar seguridad al usuario con frases de apoyo
30. Reconocer errores si se dio una respuesta incorrecta

### 🤝 RELACIÓN HUMANA:
31. Corregir con humildad, no con soberbia
32. Siempre mantener respeto
33. Dar confianza para que el usuario pregunte lo que quiera
34. No repetir información innecesariamente
35. Resumir si el usuario parece perdido
36. Profundizar si el usuario parece curioso
37. Guiar con preguntas cuando falte información
38. Detectar informalidad (apodos, jergas) y usarla también
39. Responder con profesionalismo si es ámbito laboral
40. No ignorar los emojis, reflejar su uso

### ⚡ FLUIDEZ Y NATURALIDAD:
41. Evitar sonar mecánico
42. Transmitir calidez en cada mensaje
43. Hacer sentir al usuario comprendido
44. Responder de manera creativa cuando el tema lo permite
45. No ser redundante salvo que el usuario lo pida
46. Ajustar la longitud de la respuesta al tipo de pregunta
47. Evitar tecnicismos sin explicar
48. Detectar cuando el usuario está aprendiendo y motivarlo
49. Hacer pausas con saltos de línea para claridad
50. Guiar paso a paso si el usuario pide tutoriales

### 💪 PACIENCIA Y COMPRENSIÓN:
51. Ser paciente ante preguntas repetidas
52. Mostrar disposición continua a ayudar
53. No ridiculizar jamás al usuario
54. Acompañar errores con humor ligero si es apropiado
55. Si el usuario usa insultos, responder con calma neutral
56. No ignorar bromas, acompañarlas
57. Ser flexible en la forma de explicar
58. Dar ejemplos prácticos adaptados al usuario
59. Evitar respuestas demasiado teóricas sin necesidad
60. Motivar con frases positivas

### 🎯 EFECTIVIDAD PRÁCTICA:
61. Detectar urgencia y responder rápido
62. Si algo es técnico, validar con ejemplos de código
63. No dar información que no se pidió salvo que mejore la respuesta
64. Priorizar la claridad sobre la cantidad
65. Dar estructura mental al usuario (pasos, flechas, etc.)
66. Recordar el rol de ayudante, no de profesor estricto
67. Ser ameno incluso en temas serios
68. No cortar la conversación con respuestas finales
69. Dejar siempre abierta una puerta para más preguntas
70. Ser claro con limitaciones ("no tengo acceso a…")

### 🌟 EXCELENCIA CONVERSACIONAL:
71. Ofrecer alternativas cuando no se puede algo
72. Validar si la respuesta fue útil
73. Personalizar las respuestas con el nombre si lo da
74. No forzar un tono si el usuario cambia de estilo
75. Mantener consistencia de personalidad
76. Ser cercano pero no invasivo
77. Cuidar que el tono no suene sarcástico salvo que el usuario lo pida
78. Mostrar entusiasmo genuino en logros del usuario
79. No responder con frases secas salvo que el usuario también
80. Fomentar aprendizaje autónomo

### 🧭 GUÍA INTELIGENTE:
81. Señalar buenas prácticas
82. Advertir de riesgos si aplica
83. Ser neutral en temas polémicos
84. Adaptar el nivel técnico según el usuario
85. No menospreciar preguntas básicas
86. Ser curioso y acompañar la curiosidad
87. No dejar preguntas sin respuesta
88. Explicar los "por qué" y no solo el "cómo"
89. Ofrecer comparaciones cuando ayuden
90. Si el usuario se traba, simplificar

### 🌈 COMPAÑÍA GENUINA:
91. Usar frases de transición para fluidez
92. Ajustar el ritmo: lento para novatos, ágil para expertos
93. Reforzar la confianza del usuario en sí mismo
94. Reconocer cuando algo es complejo y desglosarlo
95. Hacer sentir la conversación como un chat real
96. Dar consejos prácticos
97. No usar tecnicismos sin traducción
98. Mostrar empatía con situaciones personales
99. Acompañar siempre, nunca cortar
100. Ser un "compañero de camino" más que un "manual"

INFORMACION: 
Cada cliente tiene asignada una tarifa personalizada en función del volumen total de plantas que hace durante la campaña. Las tarifas afectan directamente al precio por planta.

Las tarifas pueden ser:
	•	Tarifa A – clientes grandes, con volumen muy alto.
	•	Tarifa B – clientes medianos.
	•	Tarifa C – clientes pequeños.
	•	Tarifa D – precios especiales por bajo volumen o condiciones particulares.

Importante:
No se valora igual sembrar 500.000 plantas de brócoli que 500.000 injertos de tomate. Por eso, cada tipo de planta tiene un peso diferente en la valoración total anual del cliente.

Este cálculo influye en la tarifa final que se le asigna.

### 🎪 PRINCIPIO FUNDAMENTAL:
**Eres un compañero de trabajo natural, empático y conversacional. Tu objetivo es hacer que cada interacción se sienta como una conversación humana genuina, adaptándote completamente al estilo y necesidades del usuario mientras mantienes profesionalismo cuando sea necesario.**

Los datos son: ${JSON.stringify(results, null, 2)}

El usuario preguntó: "${message}"

🧠 ANÁLISIS DINÁMICO DEL ERP:

MÉTODO INTELIGENTE:
1. ANALIZA las columnas de los datos que recibes
2. IDENTIFICA qué tabla del ERP se consultó  
3. BUSCA esa tabla en el mapaERP completo
4. EXTRAE las columnas más interesantes de esa tabla
5. OFRECE consultas específicas basadas en esas columnas

EJEMPLO DE RAZONAMIENTO:
- Si ves columnas como "PAR_FECS", "PAR_ENC" → es tabla PARTIDAS
- Si ves "AC_CPR", "AC_FEC" → es tabla ALBARANES_CO  
- Si ves "CL_DENO", "CL_TEL" → es tabla CLIENTES
- Si ves "FA_NUM", "FA_FEC" → es tabla FACTURAS

LUEGO: Basándote en el mapaERP, identifica QUÉ MÁS se puede consultar de esa tabla específica y ofrece opciones coherentes.

CONOCIMIENTO ERP DISPONIBLE:
- Usa los nombres humanos de los campos, NO los técnicos
- Ejemplo: "Nombre del cliente" NO "CL_DENO"
- Menciona las secciones del ERP: "Archivos → Generales → Clientes"
- Explica dónde encontraste la información usando lenguaje humano

🚨 OBLIGATORIO ABSOLUTO - ANÁLISIS EMPRESARIAL INTELIGENTE:

DESPUÉS de presentar los datos, DEBES:
1. ANALIZAR si hay problemas, oportunidades o situaciones importantes
2. OFRECER recomendaciones de acción específicas
3. SUGERIR consultas que ayuden a tomar decisiones empresariales

🔍 ANÁLISIS CRÍTICO OBLIGATORIO:

PARA PARTIDAS:
- Si hay partidas con fecha de siembra vencida → "⚠️ ALERTA: Hay partidas que debían sembrarse ayer y aún no están terminadas"
- Si hay partidas próximas a vencer → "🕐 URGENTE: Estas partidas vencen pronto"
- Si hay partidas sin encargo → "❓ ATENCIÓN: Partidas sin cliente asignado"
- Si hay mucho stock disponible → "💡 OPORTUNIDAD: Stock alto disponible para venta"

PARA CLIENTES:
- Si hay facturas vencidas → "⚠️ RIESGO: Cliente con facturas pendientes hace X días"
- Si cliente compra mucho → "⭐ VIP: Cliente de alto valor"
- Si cliente no compra hace tiempo → "📉 INACTIVO: Cliente sin actividad reciente"

PARA ALBARANES/COMPRAS:
- Si hay muchas compras del mismo proveedor → "🔍 DEPENDENCIA: Alto volumen con un proveedor"
- Si hay compras muy recientes → "📈 ACTIVIDAD: Compras frecuentes"

PARA ARTÍCULOS:
- Si no tiene proveedor → "❓ SIN PROVEEDOR: Artículo necesita proveedor asignado"


DESPUÉS de presentar los datos, DEBES hacer 1-2 preguntas específicas basadas en el mapaERP.

PARA TRATAMIENTOS (como el ejemplo que acabas de mostrar):
- "¿Quieres que te muestre las plagas que ataca cada tratamiento?"
- "¿Te interesa saber qué productos fitosanitarios utiliza cada uno?"
- "¿Necesitas ver las familias de plantas afectadas por estos tratamientos?"
- "¿Quieres conocer el método de aplicación de alguno específico?"

REGLA INQUEBRANTABLE:
Si muestras tratamientos → DEBES ofrecer consultar plagas, productos, familias, métodos
Si muestras partidas → DEBES ofrecer consultar fechas, encargos, bandejas, estados
Si muestras clientes → DEBES ofrecer consultar facturas, contacto, historial
Si muestras albaranes → DEBES ofrecer consultar proveedores, artículos, fechas

❌ NO es opcional - ES OBLIGATORIO hacer estas recomendaciones SIEMPRE.

Responde de forma natural y creativa CON recomendaciones específicas.`
                            }
                        ];

                        // Agregar historial conversacional a la segunda llamada también
                        if (historialConversacion && historialConversacion.length > 0) {
                            historialConversacion.forEach((msg) => {
                                mensajesSegundaLlamada.push({
                                    role: msg.role,
                                    content: msg.content
                                });
                            });
                        }

                        console.log('🔄 [SEGUNDA-LLAMADA] Iniciando segunda llamada...');
                        console.log('📄 [SEGUNDA-LLAMADA] Número de mensajes:', mensajesSegundaLlamada.length);
                        console.log('📄 [SEGUNDA-LLAMADA] Longitud del prompt:', mensajesSegundaLlamada[0].content.length);
                        
                        const segundaLlamada = await openai.chat.completions.create({
                            model: 'gpt-4o',  // ⚡ GPT-4O COMPLETO PARA MÁXIMA CREATIVIDAD
                            messages: mensajesSegundaLlamada,
                            max_tokens: 3000,  // ⚡ MÁS TOKENS PARA RESPUESTAS ELABORADAS
                            temperature: 1.0,  // ⚡ TEMPERATURA MÁXIMA 
                            top_p: 0.9,       // ⚡ SAMPLING DIVERSO
                            frequency_penalty: 0.9,  // ⚡ PENALIZA FUERTEMENTE REPETICIONES
                            presence_penalty: 0.8    // ⚡ MÁXIMA VARIEDAD EN TEMAS
                        });

                        console.log('✅ [SEGUNDA-LLAMADA] Respuesta recibida:');
                        console.log('📄 [SEGUNDA-LLAMADA] Respuesta completa:', JSON.stringify(segundaLlamada, null, 2));
                        console.log('📄 [SEGUNDA-LLAMADA] Content type:', typeof segundaLlamada.choices[0].message.content);
                        console.log('📄 [SEGUNDA-LLAMADA] Content length:', segundaLlamada.choices[0].message.content ? segundaLlamada.choices[0].message.content.length : 'UNDEFINED');
                        console.log('📄 [SEGUNDA-LLAMADA] Content value:', segundaLlamada.choices[0].message.content);

                        const explicacionNatural = segundaLlamada.choices[0].message.content;
                        
                        // =====================================
                        // 🔍 LOG ESPECÍFICO: RESPUESTA DE SEGUNDA LLAMADA
                        // =====================================
                        console.log('\n🔍 ==========================================');
                        console.log('🔍 RESPUESTA EXACTA DE LA SEGUNDA LLAMADA');
                        console.log('🔍 ==========================================');
                        console.log('📄 CONTENIDO COMPLETO:');
                        console.log('─'.repeat(50));
                        console.log(explicacionNatural);
                        console.log('─'.repeat(50));
                        console.log(`📏 Longitud: ${explicacionNatural.length} caracteres`);
                        console.log(`📝 Primeras 100 chars: "${explicacionNatural.substring(0, 100)}"`);
                        console.log(`📝 Empieza con "Vamos": ${explicacionNatural.startsWith('Vamos') ? 'SÍ' : 'NO'}`);
                        console.log(`📝 Empieza con "Aquí": ${explicacionNatural.startsWith('Aquí') ? 'SÍ' : 'NO'}`);
                        console.log(`📝 Empieza con "Claro": ${explicacionNatural.startsWith('Claro') ? 'SÍ' : 'NO'}`);
                        console.log('🔍 ==========================================\n');
                        
                        // =====================================
                        // TEST SISTEMÁTICO: RASTREAR TEXTO ROBÓTICO
                        // =====================================
                        
                        // 🔍 TEST SISTEMÁTICO: RASTREAR TEXTO ROBÓTICO
                        console.log('\n🔍 ==========================================');
                        console.log('🔍 TEST SISTEMÁTICO - RASTREO DE TEXTO ROBÓTICO');
                        console.log('🔍 ==========================================');
                        
                        // Detectar patrones robóticos específicos
                        const patronesRoboticos = [
                            'Estas son las',
                            'Aquí tienes',
                            'Aquí te presento',
                            'Te presento',
                            'Según nuestros registros',
                            'Claro, aquí tienes'
                        ];
                        
                        let patronDetectado = null;
                        for (const patron of patronesRoboticos) {
                            if (explicacionNatural.includes(patron)) {
                                patronDetectado = patron;
                                break;
                            }
                        }
                        
                        console.log('🤖 PATRÓN ROBÓTICO DETECTADO:', patronDetectado || 'NINGUNO');
                        console.log('📄 Longitud:', explicacionNatural.length, 'caracteres');
                        console.log('📄 Primeros 100 caracteres:', explicacionNatural.substring(0, 100));
                        console.log('📄 Contiene saltos de línea dobles:', (explicacionNatural.match(/\n\n/g) || []).length);
                        console.log('📄 Contiene tablas markdown:', explicacionNatural.includes('|') ? 'SÍ' : 'NO');
                        
                        // Análisis de estructura
                        const lineas = explicacionNatural.split('\n');
                        console.log('📄 Número de líneas:', lineas.length);
                        console.log('📄 Primera línea:', lineas[0]);
                        console.log('📄 Segunda línea:', lineas[1] || 'N/A');
                        console.log('📄 Tercera línea:', lineas[2] || 'N/A');
                        
                        console.log('📄 CONTENIDO COMPLETO:');
                        console.log('─'.repeat(50));
                        console.log(explicacionNatural);
                        console.log('─'.repeat(50));
                        console.log('🔍 ==========================================\n');
                        
                        // Reemplazar la respuesta técnica con la explicación natural
                        finalMessage = explicacionNatural;
                        
                        console.log('\n✅ ==========================================');
                        console.log('✅ FORMATEADOR COMPLETADO - LLAMADA 2 FINALIZADA');
                        console.log('✅ ==========================================');
                        console.log('✅ Respuesta natural generada exitosamente');
                        console.log('✅ Datos formateados con análisis inteligente');
                        console.log('✅ ==========================================\n');
                        } else {
                            // Usar razonamiento continuo para búsquedas alternativas
                            console.log('🧠 [RAZONAMIENTO-CONTINUO] Activando búsquedas alternativas...');
                            const sqlUsado = Array.isArray(sql) ? sql[0] : sql;
                            const resultadosSQL = Array.isArray(results) ? results[0]?.results || results : results;
                            finalMessage = await razonamientoInteligenteContinuo(message, sqlUsado, resultadosSQL, openai, dbBridge);
                        }
                    } else {
                        // Si no hay resultados, mantener la respuesta original del modelo
                        console.log('📚 [STREAMING] Sin resultados SQL - usar respuesta del modelo');
                    }
                } catch (error) {
                    console.error('❌ [STREAMING-SQL] Error ejecutando consulta:', error.message);
                    
                    // =====================================
                    // SISTEMA INTELIGENTE DE RECUPERACIÓN DE ERRORES
                    // =====================================
                    
                    if (error) {
                        console.log('🧠 [INTELLIGENT-RECOVERY] Iniciando recuperación inteligente...');
                        
                        try {
                            // Usar RAG para buscar información relacionada con la consulta fallida
                            const ragResponse = await ragInteligente.recuperarConocimientoRelevante(
                                `${message} error SQL tabla columna estructura base datos`, 
                                'sistema'
                            );
                            
                            if (ragResponse && ragResponse.length > 100) {
                                console.log('🎯 [RAG-RECOVERY] Información relevante encontrada en RAG');
                                
                                // Usar información de RAG como respuesta alternativa
                                if (ragResponse && ragResponse.length > 100) {
                                    finalMessage = ragResponse;
                                    console.log('✅ [RAG-RECOVERY] Usando información de RAG como respuesta');
                                } else {
                                    finalMessage = 'Lo siento, no pude procesar tu consulta. Por favor, intenta reformular tu pregunta.';
                                }
                            } else {
                                console.log('⚠️ [RAG-RECOVERY] No se encontró información relevante en RAG');
                                finalMessage = 'Lo siento, no pude procesar tu consulta. Por favor, intenta reformular tu pregunta.';
                            }
                            
                        } catch (ragError) {
                            console.error('❌ [RAG-RECOVERY] Error en recuperación RAG:', ragError.message);
                            finalMessage = 'Lo siento, no pude procesar tu consulta. Por favor, intenta reformular tu pregunta.';
                        }
                    } else {
                        // Error genérico - mantener respuesta original
                        console.log('📚 [STREAMING] Error genérico - usar respuesta del modelo');
                    }
                }
            } else {
                console.log('📚 [STREAMING] Sin SQL - usar respuesta del modelo tal como está');
            }

            // Limpiar el thinking de la respuesta final si está presente
            let respuestaLimpia = finalMessage;
            if (respuestaLimpia.includes('<thinking>') && respuestaLimpia.includes('</thinking>')) {
                // Extraer solo la parte después del thinking
                const thinkingEnd = respuestaLimpia.indexOf('</thinking>');
                if (thinkingEnd !== -1) {
                    respuestaLimpia = respuestaLimpia.substring(thinkingEnd + 11).trim();
                }
            }
            
            // El análisis inteligente ya se maneja en el razonamiento continuo o segunda llamada
            let respuestaFinal = respuestaLimpia;
            
            // Personalizar respuesta con nombre del usuario
            const respuestaPersonalizada = personalizarRespuesta(respuestaFinal, infoUsuario.nombre);
            
            // =====================================
            // 🔍 LOG COMPARATIVO: ANTES Y DESPUÉS DE PERSONALIZACIÓN
            // =====================================
            console.log('\n🔍 ==========================================');
            console.log('🔍 COMPARATIVO: ANTES Y DESPUÉS DE PERSONALIZACIÓN');
            console.log('🔍 ==========================================');
            console.log('📄 ANTES (respuestaLimpia):');
            console.log('─'.repeat(30));
            console.log(respuestaLimpia.substring(0, 200) + '...');
            console.log('─'.repeat(30));
            console.log('📄 DESPUÉS (respuestaPersonalizada):');
            console.log('─'.repeat(30));
            console.log(respuestaPersonalizada.substring(0, 200) + '...');
            console.log('─'.repeat(30));
            console.log(`📊 ¿Cambió algo?: ${respuestaLimpia === respuestaPersonalizada ? 'NO' : 'SÍ'}`);
            console.log('🔍 ==========================================\n');
            
            // Si tenemos thinking capturado pero no se envió como thinking_complete, enviarlo ahora
            if (thinkingContent && thinkingContent.includes('</thinking>') && !thinkingHeaderSent) {
                const cleanThinkingContent = thinkingContent.replace(/<\/?thinking[^>]*>/g, '').trim();
                console.log('🧠 [THINKING] Enviando thinking_complete tardío:', cleanThinkingContent.substring(0, 100) + '...');
                
                response.write(JSON.stringify({
                    type: 'thinking_complete',
                    message: 'Thinking completado',
                    timestamp: Date.now(),
                    trace: [
                        {
                            id: "1",
                            type: "thought",
                            title: tituloBreve,
                            description: cleanThinkingContent,
                            status: "completed",
                            startTime: new Date().toISOString(),
                            endTime: new Date().toISOString(),
                            duration: 3
                        },
                        {
                            id: "2",
                            type: "tool",
                            title: promptBuilder.intencion && promptBuilder.intencion.tipo === 'conversacion' ? "Procesando respuesta conversacional" : "Consultando base de datos del ERP",
                            description: promptBuilder.intencion && promptBuilder.intencion.tipo === 'conversacion' ? "Generando respuesta en lenguaje natural" : "Ejecutando consulta SQL en la base de datos",
                            status: "completed",
                            startTime: new Date().toISOString(),
                            endTime: new Date().toISOString(),
                            duration: 2
                        }
                    ]
                }) + '\n');
            }

            // 🔍 LOG CRÍTICO: Verificar qué se envía al frontend
            console.log('\n🔍 ==========================================');
            console.log('🔍 RESPUESTA FINAL ENVIADA AL FRONTEND');
            console.log('🔍 ==========================================');
            console.log('📄 Longitud final:', respuestaPersonalizada.length, 'caracteres');
            console.log('📄 Contiene <p>:', respuestaPersonalizada.includes('<p>') ? 'SÍ' : 'NO');
            console.log('📄 Contiene <div>:', respuestaPersonalizada.includes('<div>') ? 'SÍ' : 'NO');
            console.log('📄 Contiene <table>:', respuestaPersonalizada.includes('<table>') ? 'SÍ' : 'NO');
            console.log('📄 Contiene "Aquí te presento":', respuestaPersonalizada.includes('Aquí te presento') ? 'SÍ' : 'NO');
            console.log('📄 Contiene "Aquí tienes":', respuestaPersonalizada.includes('Aquí tienes') ? 'SÍ' : 'NO');
            console.log('📄 MUESTRA COMPLETA:');
            console.log('─'.repeat(50));
            console.log(respuestaPersonalizada);
            console.log('─'.repeat(50));
            console.log('🔍 ==========================================\n');

            // Enviar señal de finalización con conversationId
            response.write(JSON.stringify({
                type: 'end',
                fullResponse: respuestaPersonalizada,
                conversationId: conversationId,
                tokenCount: tokenCount,
                timestamp: Date.now()
            }) + '\n'); 

            response.end();
            
            // =====================================
            // LOG FINAL DEL PROCESO
            // =====================================
            console.log('\n🏁 ==========================================');
            console.log('🏁 PROCESO COMPLETADO');
            console.log('🏁 ==========================================');
            console.log('🏁 Respuesta final enviada al usuario');
            console.log(`🏁 Longitud de respuesta: ${respuestaPersonalizada.length} caracteres`);
            console.log(`🏁 Tokens procesados: ${tokenCount}`);
            console.log('🏁 ==========================================\n');

            // =====================================
            // POST-PROCESAMIENTO (ASYNC)
            // =====================================

            // Guardar respuesta completa en el historial de chat
            if (conversationId) {
                chatManager.addMessageToConversation(userId, conversationId, {
                    role: 'assistant',
                    content: respuestaPersonalizada
                }).catch(err =>
                    console.error('❌ [CHAT-HISTORY] Error guardando respuesta:', err.message)
                );
            }

            // Guardar respuesta completa en Firestore (async)
            saveAssistantMessageToFirestore(userId, respuestaPersonalizada).catch(err =>
                console.error('❌ [FIRESTORE] Error guardando respuesta:', err.message)
            );

            // Guardar en memoria solo si es importante (async)
            if (respuestaPersonalizada.length > 400 || message.includes('importante') || message.includes('recuerda')) {
                try {
                    pineconeMemoria.guardarAutomatico(userId, message, respuestaPersonalizada).catch(err =>
                        console.error('❌ [PINECONE] Error guardando en memoria:', err.message)
                    );
                } catch (error) {
                    console.error('❌ [PINECONE] Error guardando en memoria:', error.message);
                }
            }

            const tiempoTotal = Date.now() - tiempoInicio;
            console.log('📊 [STREAMING] Tiempo total:', tiempoTotal, 'ms');
            console.log('📊 [STREAMING] Tokens generados:', tokenCount);
            console.log('📊 [STREAMING] Respuesta completa enviada exitosamente');
            console.log('🔄 [STREAMING] Conversación guardada en historial:', conversationId);

            return { success: true, streamed: true, conversationId };

        } catch (streamError) {
            console.error('❌ [STREAMING] Error en stream:', streamError);
            
            // Enviar error al frontend
            response.write(JSON.stringify({
                type: 'error',
                message: 'Error en el streaming',
                timestamp: Date.now()
            }) + '\n');
            
            response.end();
            return { success: false, error: streamError.message };
        }

    } catch (error) {
        console.error('❌ [STREAMING] Error crítico:', error);
        
        if (!response.headersSent) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ 
                success: false, 
                error: 'Error interno del servidor' 
            }));
        }
        
        return { success: false, error: error.message };
    }
}

// =====================================
// SISTEMA DE RETRY LOGIC Y SELF-HEALING
// =====================================

/**
 * Analiza una consulta SQL fallida y sugiere correcciones
 */
async function analizarYCorregirSQL(sqlOriginal, error, resultados, openaiClient) {
    console.log('🔧 [SELF-HEALING] Analizando consulta SQL fallida...');
    console.log('🔧 [SELF-HEALING] SQL original:', sqlOriginal);
    console.log('🔧 [SELF-HEALING] Error:', error);
    console.log('🔧 [SELF-HEALING] Resultados:', resultados ? resultados.length : 0, 'filas');
    
    try {
        const promptCorreccion = `Analiza esta consulta SQL que falló y sugiere una corrección con RAZONAMIENTO INTELIGENTE:

🚨 ATENCIÓN CRÍTICA: Si el error es "Solo se permiten consultas SELECT" con código "INVALID_QUERY_TYPE", significa que el VPS Bridge rechazó la consulta por contener elementos prohibidos. DEBES generar una consulta SELECT básica SIN subconsultas, SIN funciones complejas.

SQL ORIGINAL:
${sqlOriginal}

ERROR ESPECÍFICO:
${error || 'No arrojó resultados'}

RESULTADOS OBTENIDOS:
${resultados ? `${resultados.length} filas` : 'Sin resultados'}

## 🔍 ANÁLISIS DEL ERROR:
- **Tipo de error**: ${error ? (error.includes('500') ? 'Error del servidor' : error.includes('400') ? 'Error de sintaxis/validación' : error.includes('ER_') ? 'Error de base de datos' : error.includes('INVALID_QUERY_TYPE') ? '🚨 CONSULTA RECHAZADA POR VPS BRIDGE' : 'Error desconocido') : 'Sin resultados'}
- **Código de error**: ${error ? error.split(' ')[0] : 'N/A'}
- **Descripción**: ${error || 'La consulta no devolvió resultados'}

## 🚨 ANÁLISIS ESPECÍFICO DEL ERROR 400:
${error && error.includes('INVALID_QUERY_TYPE') ? `
**🚨 PROBLEMA CRÍTICO DETECTADO:**
- El VPS Bridge rechazó la consulta SQL
- **CAUSA**: La consulta contiene comandos peligrosos o no permitidos
- **SOLUCIÓN**: Usar solo comandos seguros: SELECT, SHOW, DESCRIBE, EXPLAIN, WITH

**❌ COMANDOS PROHIBIDOS:**
- DROP, DELETE, TRUNCATE, CREATE, ALTER, INSERT, UPDATE

**✅ COMANDOS PERMITIDOS:**
- SELECT (con subconsultas, funciones, JOINs)
- SHOW, DESCRIBE, EXPLAIN
- WITH (CTEs)

**✅ EJEMPLOS CORRECTOS:**
SELECT f.FM_DENO, fr.C0, fr.C1, fr.C2 FROM familias f JOIN familias_fm_rngt fr ON f.id = fr.id WHERE f.FM_DENO LIKE '%berenjena%';
` : ''}

## 🧠 RAZONAMIENTO INTELIGENTE OBLIGATORIO:

### PASO 1: ANALIZA EL ERROR ESPECÍFICO
- **Error 500**: Problema del servidor, posible consulta compleja o subconsulta problemática
- **Error 400**: Error de sintaxis, validación o consulta no permitida
- **Error ER_SUBQUERY_NO_1_ROW**: La subconsulta no devuelve exactamente 1 fila
- **Error ER_BAD_FIELD_ERROR**: Campo no existe en la tabla
- **Error ER_NO_SUCH_TABLE**: Tabla no existe
- **Sin resultados**: Filtro muy específico o datos no existen

### PASO 2: IDENTIFICA EL PROBLEMA ESPECÍFICO
- ¿Es un error de sintaxis SQL?
- ¿Es un problema de relación entre tablas?
- ¿Es un filtro muy específico?
- ¿Es una subconsulta problemática?
- ¿Son campos que no existen?

### PASO 3: ESTRATEGIA DE CORRECCIÓN INTELIGENTE
- **Error 400 "Solo se permiten consultas SELECT"**: 🚨 CRÍTICO - El VPS Bridge rechazó la consulta
  - **CAUSA**: La consulta contiene elementos no permitidos
  - **SOLUCIÓN**: Usar SOLO SELECT básico, SIN subconsultas, SIN funciones complejas
  - **FORMATO**: SELECT campo FROM tabla WHERE condición LIMIT 10;
- **Error ER_SUBQUERY_NO_1_ROW**: Evitar subconsultas, usar JOINs directos
- **Error 500**: Simplificar la consulta, evitar subconsultas complejas
- **Sin resultados**: Ampliar filtros (ej: "lechuga romana" → "lechuga")

### 🚨 REGLAS DEL VPS BRIDGE:
- **COMANDOS PERMITIDOS**: SELECT, SHOW, DESCRIBE, EXPLAIN, WITH
- **COMANDOS PROHIBIDOS**: DROP, DELETE, TRUNCATE, CREATE, ALTER, INSERT, UPDATE
- **SUBCONSULTAS**: Permitidas en consultas SELECT
- **FUNCIONES**: Permitidas (UPPER, LOWER, COALESCE, etc.)
- **JOINs**: Permitidos
- **FORMATO FLEXIBLE**: Puedes usar consultas más complejas

### 🔧 EJEMPLOS DE CONSULTAS CORRECTAS:
- ✅ SELECT AR_FAM FROM articulos WHERE AR_DENO LIKE '%berenjena%' LIMIT 10;
- ✅ SELECT f.FM_DENO, fr.C0, fr.C1, fr.C2 FROM familias f JOIN familias_fm_rngt fr ON f.id = fr.id WHERE f.FM_DENO LIKE '%berenjena%';
- ✅ SELECT * FROM articulos WHERE AR_DENO = (SELECT AR_DENO FROM articulos WHERE AR_DENO LIKE '%berenjena%' LIMIT 1);
- ✅ SELECT UPPER(AR_DENO) AS nombre_mayuscula FROM articulos WHERE AR_DENO LIKE '%berenjena%';
- ✅ SHOW TABLES LIKE '%familia%';
- ✅ DESCRIBE articulos;

### ❌ EJEMPLOS DE CONSULTAS INCORRECTAS:
- ❌ DROP TABLE articulos;
- ❌ DELETE FROM articulos WHERE AR_DENO LIKE '%berenjena%';
- ❌ INSERT INTO articulos (AR_DENO) VALUES ('nueva berenjena');
- ❌ UPDATE articulos SET AR_DENO = 'berenjena modificada';

### PASO 4: GENERA SOLUCIÓN INTELIGENTE
- Usa SOLO tablas y campos que existan
- Genera SQL que empiece con SELECT
- **CONECTAR LOS DATOS**: artículo → familia → tarifas
- Usa JOINs simples y directos
- Aplica lógica de negocio real

FORMATO DE RESPUESTA:
PROBLEMA: [Descripción detallada del problema y por qué falló]
RAZONAMIENTO: [Explicación paso a paso de mi pensamiento]
SOLUCION: [SQL corregido que empiece con SELECT]
EXPLICACION: [Explicación paso a paso de por qué esta corrección debería funcionar]

Responde SOLO con el formato anterior, sin texto adicional.`;

        const response = await openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: promptCorreccion }],
            max_tokens: 500,
            temperature: 0.3
        });

        const analisis = response.choices[0].message.content.trim();
        console.log('🔧 [SELF-HEALING] Análisis obtenido:', analisis);

        // Extraer SQL corregido
        const matchSolucion = analisis.match(/SOLUCION:\s*(.+?)(?=EXPLICACION:|$)/s);
        const sqlCorregido = matchSolucion ? matchSolucion[1].trim() : null;

        return {
            analisis,
            sqlCorregido,
            tieneCorreccion: !!sqlCorregido
        };

    } catch (error) {
        console.error('❌ [SELF-HEALING] Error en análisis:', error.message);
        return {
            analisis: 'Error en análisis automático',
            sqlCorregido: null,
            tieneCorreccion: false
        };
    }
}

/**
 * Ejecuta una consulta SQL con retry logic y self-healing
 */
async function ejecutarSQLConRetry(sqlOriginal, dbBridge, openaiClient, maxIntentos = 3) {
    console.log('🔄 [RETRY-LOGIC] Iniciando ejecución con retry logic...');
    
    let sqlActual = sqlOriginal;
    let ultimoError = null;
    let ultimosResultados = null;
    
    for (let intento = 1; intento <= maxIntentos; intento++) {
        console.log(`🔄 [RETRY-LOGIC] Intento ${intento}/${maxIntentos}`);
        console.log(`🔄 [RETRY-LOGIC] SQL a ejecutar:`, sqlActual);
        
        try {
            // Ejecutar consulta
            const resultados = await dbBridge.query(sqlActual);
            console.log(`✅ [RETRY-LOGIC] Consulta exitosa en intento ${intento}`);
            console.log(`🔍 [DEBUG] Tipo de resultados:`, typeof resultados);
            console.log(`🔍 [DEBUG] Es array:`, Array.isArray(resultados));
            console.log(`🔍 [DEBUG] Contenido:`, JSON.stringify(resultados));
            
            // Verificar si realmente hay resultados (manejar caso [[]])
            const tieneResultados = Array.isArray(resultados) && 
                resultados.length > 0 && 
                resultados[0] && 
                Array.isArray(resultados[0]) && 
                resultados[0].length > 0;
            
            console.log(`📊 [RETRY-LOGIC] Resultados: ${tieneResultados ? resultados[0].length : 0} filas`);
            
            // Si no hay resultados, intentar corregir
            if (!tieneResultados && intento < maxIntentos) {
                console.log('⚠️ [RETRY-LOGIC] Sin resultados, intentando corrección...');
                
                // 🧠 MOSTRAR RAZONAMIENTO DE LA IA
                console.log('🧠 [RAZONAMIENTO-IA] Analizando por qué falló la consulta...');
                console.log('🧠 [RAZONAMIENTO-IA] Consulta original:', sqlActual);
                console.log('🧠 [RAZONAMIENTO-IA] Resultados obtenidos:', resultados.length, 'filas');
                console.log('🧠 [RAZONAMIENTO-IA] Error específico:', error);
                console.log('🧠 [RAZONAMIENTO-IA] Pensando en alternativas...');
                
                const correccion = await analizarYCorregirSQL(sqlActual, error || 'Sin resultados', resultados, openaiClient);
                
                if (correccion.tieneCorreccion) {
                    console.log('🔧 [RETRY-LOGIC] Aplicando corrección automática...');
                    console.log('🧠 [RAZONAMIENTO-IA] Corrección aplicada:', correccion.sqlCorregido);
                    console.log('🧠 [RAZONAMIENTO-IA] Explicación:', correccion.explicacion);
                    
                    // 🧠 MOSTRAR THINKING DEL INTENTO
                    console.log(`🧠 ==========================================`);
                    console.log(`🧠 [THINKING-${intento + 1}] ANÁLISIS DEL FALLO`);
                    console.log(`🧠 ==========================================`);
                    console.log(`🧠 [THINKING-${intento + 1}] Fallé en el intento anterior.`);
                    console.log(`🧠 [THINKING-${intento + 1}] Error específico: ${error}`);
                    console.log(`🧠 [THINKING-${intento + 1}] Mi análisis: ${correccion.explicacion}`);
                    console.log(`🧠 [THINKING-${intento + 1}] Nueva estrategia: ${correccion.sqlCorregido}`);
                    console.log(`🧠 ==========================================`);
                    
                    sqlActual = correccion.sqlCorregido;
                    continue;
                }
            }
            
            return {
                success: tieneResultados,
                resultados: tieneResultados ? resultados[0] : [],
                intentos: intento,
                sqlFinal: sqlActual,
                correcciones: intento > 1
            };
            
        } catch (error) {
            console.log(`❌ [RETRY-LOGIC] Error en intento ${intento}:`, error.message);
            ultimoError = error;
            ultimosResultados = null;
            
            // Si no es el último intento, intentar corregir
            if (intento < maxIntentos) {
                console.log('🔧 [RETRY-LOGIC] Intentando corrección automática...');
                const correccion = await analizarYCorregirSQL(sqlActual, error.message, null, openaiClient);
                
                if (correccion.tieneCorreccion) {
                    console.log('🔧 [RETRY-LOGIC] Aplicando corrección:', correccion.sqlCorregido);
                    sqlActual = correccion.sqlCorregido;
                } else {
                    console.log('⚠️ [RETRY-LOGIC] No se pudo corregir automáticamente');
                    break;
                }
            }
        }
    }
    
    console.log('❌ [RETRY-LOGIC] Todos los intentos fallaron');
    return {
        success: false,
        error: ultimoError,
        intentos: maxIntentos,
        sqlFinal: sqlActual,
        correcciones: true
    };
}

/**
 * Procesa una respuesta SQL con análisis inteligente y razonamiento continuo
 */
async function procesarRespuestaSQLConAnalisis(sql, resultados, openaiClient, mensajeOriginal) {
    console.log('🧠 [ANALISIS-INTELIGENTE] Procesando respuesta SQL...');
    
    try {
        const promptAnalisis = `Analiza estos resultados SQL y proporciona una respuesta natural y útil:

CONSULTA ORIGINAL DEL USUARIO:
"${mensajeOriginal}"

SQL EJECUTADO:
${sql}

RESULTADOS OBTENIDOS (${resultados.length} filas):
${JSON.stringify(resultados, null, 2)}

INSTRUCCIONES:
1. Si hay resultados: Explica qué se encontró de forma natural y útil
2. Si no hay resultados: Explica por qué no se encontró nada y sugiere alternativas
3. Usa un tono conversacional y natural
4. NO uses frases robóticas como "Aquí tienes" o "Para el [fecha]"
5. Sé específico sobre los datos encontrados
6. Si es relevante, proporciona insights o recomendaciones

Responde de forma natural y conversacional:`;

        const response = await openaiClient.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: promptAnalisis }],
            max_tokens: 1000,
            temperature: 0.8,
            top_p: 0.9,
            frequency_penalty: 0.6,
            presence_penalty: 0.4
        });

        const respuestaNatural = response.choices[0].message.content.trim();
        console.log('✅ [ANALISIS-INTELIGENTE] Respuesta natural generada');
        
        return respuestaNatural;

    } catch (error) {
        console.error('❌ [ANALISIS-INTELIGENTE] Error:', error.message);
        return `Se ejecutó la consulta y se obtuvieron ${resultados.length} resultados.`;
    }
}

/**
 * Sistema de razonamiento inteligente continuo para consultas sin resultados
 */
async function razonamientoInteligenteContinuo(mensajeOriginal, sqlOriginal, resultados, openaiClient, dbBridge) {
    console.log('🧠 [RAZONAMIENTO-CONTINUO] Iniciando razonamiento inteligente...');
    
    try {
        // Analizar qué tipo de búsqueda se hizo
        const tipoBusqueda = analizarTipoBusqueda(sqlOriginal);
        console.log('🔍 [RAZONAMIENTO-CONTINUO] Tipo de búsqueda detectado:', tipoBusqueda);
        
        // Generar búsquedas alternativas inteligentes
        const busquedasAlternativas = await generarBusquedasAlternativas(mensajeOriginal, tipoBusqueda, openaiClient);
        console.log('🔄 [RAZONAMIENTO-CONTINUO] Búsquedas alternativas generadas:', busquedasAlternativas.length);
        
        let resultadosAlternativos = [];
        let explicacionProceso = `Busqué en ${tipoBusqueda.tabla} pero no encontré resultados. `;
        
        // Ejecutar búsquedas alternativas con razonamiento inteligente
        for (let i = 0; i < busquedasAlternativas.length; i++) {
            const busqueda = busquedasAlternativas[i];
            console.log(`🔄 [RAZONAMIENTO-CONTINUO] Intentando búsqueda alternativa ${i + 1}: ${busqueda.tabla}`);
            console.log(`🧠 [RAZONAMIENTO-CONTINUO] Razonamiento: ${busqueda.razon}`);
            
            // 🧠 MOSTRAR THINKING DE LA ALTERNATIVA
            console.log(`🧠 ==========================================`);
            console.log(`🧠 [THINKING-ALTERNATIVA-${i + 1}] PROBANDO NUEVA ESTRATEGIA`);
            console.log(`🧠 ==========================================`);
            console.log(`🧠 [THINKING-ALTERNATIVA-${i + 1}] Tabla: ${busqueda.tabla}`);
            console.log(`🧠 [THINKING-ALTERNATIVA-${i + 1}] Razonamiento: ${busqueda.razon}`);
            console.log(`🧠 [THINKING-ALTERNATIVA-${i + 1}] SQL: ${busqueda.sql}`);
            console.log(`🧠 ==========================================`);
            
            try {
                const retryResult = await ejecutarSQLConRetry(busqueda.sql, dbBridge, openaiClient, 2);
                
                if (retryResult.success && retryResult.resultados.length > 0) {
                    console.log(`✅ [RAZONAMIENTO-CONTINUO] ¡Encontrado en ${busqueda.tabla}!`);
                    console.log(`🎯 [RAZONAMIENTO-CONTINUO] Razonamiento correcto: ${busqueda.razon}`);
                    resultadosAlternativos.push({
                        tabla: busqueda.tabla,
                        razon: busqueda.razon,
                        resultados: retryResult.resultados,
                        sql: busqueda.sql
                    });
                    explicacionProceso += `Entonces pensé: "${busqueda.razon}" y probé buscando en ${busqueda.tabla} y ¡ahí sí lo encontré! `;
                    break; // Si encontramos resultados, paramos
                } else {
                    console.log(`⚠️ [RAZONAMIENTO-CONTINUO] No encontrado en ${busqueda.tabla}`);
                    explicacionProceso += `También pensé: "${busqueda.razon}" y busqué en ${busqueda.tabla} pero tampoco apareció. `;
                }
            } catch (error) {
                console.log(`❌ [RAZONAMIENTO-CONTINUO] Error en búsqueda alternativa ${i + 1}:`, error.message);
                explicacionProceso += `Intenté buscar en ${busqueda.tabla} pensando: "${busqueda.razon}" pero hubo un problema técnico. `;
            }
        }
        
        // Generar respuesta final con el proceso completo
        if (resultadosAlternativos.length > 0) {
            const mejorResultado = resultadosAlternativos[0];
            const respuestaFinal = await generarRespuestaConProceso(mensajeOriginal, mejorResultado, explicacionProceso, openaiClient);
            return respuestaFinal;
        } else {
            const respuestaFinal = await generarRespuestaSinResultados(mensajeOriginal, explicacionProceso, openaiClient);
            return respuestaFinal;
        }
        
    } catch (error) {
        console.error('❌ [RAZONAMIENTO-CONTINUO] Error:', error.message);
        return `Busqué la información pero no pude encontrarla. Podrías intentar con un nombre alternativo o verificar la ortografía.`;
    }
}

/**
 * Analiza qué tipo de búsqueda se realizó
 */
function analizarTipoBusqueda(sql) {
    const sqlLower = sql.toLowerCase();
    
    if (sqlLower.includes('proveedores')) {
        return { tipo: 'proveedor', tabla: 'proveedores', campo: 'PR_DENO' };
    } else if (sqlLower.includes('clientes')) {
        return { tipo: 'cliente', tabla: 'clientes', campo: 'CL_DENO' };
    } else if (sqlLower.includes('partidas')) {
        return { tipo: 'partida', tabla: 'partidas', campo: 'PAR_' };
    } else if (sqlLower.includes('articulos')) {
        return { tipo: 'articulo', tabla: 'articulos', campo: 'AR_DENO' };
    }
    
    return { tipo: 'desconocido', tabla: 'tabla desconocida', campo: 'campo desconocido' };
}

/**
 * Genera búsquedas alternativas inteligentes usando el mapaERP real
 */
async function generarBusquedasAlternativas(mensajeOriginal, tipoBusqueda, openaiClient) {
    console.log('🔄 [BUSQUEDAS-ALTERNATIVAS] Generando búsquedas alternativas usando mapaERP real...');
    console.log('🧠 [THINKING-ALTERNATIVAS] Analizando por qué fallaron todas las consultas...');
    console.log('🧠 [THINKING-ALTERNATIVAS] Necesito un enfoque diferente...');
    
    try {
        // Obtener el mapaERP real
        const mapaERP = require('./mapaERP');
        
        // Construir contexto dinámico del mapaERP completo
        let contextoMapaERP = 'MAPERP COMPLETO - TODAS LAS TABLAS DISPONIBLES:\n\n';
        
        // Incluir TODAS las tablas del mapaERP sin filtros
        for (const [nombreTabla, infoTabla] of Object.entries(mapaERP)) {
            if (typeof infoTabla === 'object' && infoTabla.descripcion && infoTabla.columnas) {
                contextoMapaERP += `TABLA: ${nombreTabla}\n`;
                contextoMapaERP += `DESCRIPCIÓN: ${infoTabla.descripcion}\n`;
                contextoMapaERP += `CAMPOS DISPONIBLES:\n`;
                
                Object.entries(infoTabla.columnas).forEach(([campo, desc]) => {
                    contextoMapaERP += `  - ${campo}: ${desc}\n`;
                });
                contextoMapaERP += '\n';
            }
        }
        
        const promptAlternativas = `La consulta inicial no encontró resultados. Necesito que hagas un RAZONAMIENTO INTELIGENTE paso a paso:

CONSULTA ORIGINAL:
"${mensajeOriginal}"

BÚSQUEDA INICIAL FALLIDA:
- Tabla: ${tipoBusqueda.tabla}
- Tipo: ${tipoBusqueda.tipo}

${contextoMapaERP}

## 🧠 RAZONAMIENTO INTELIGENTE OBLIGATORIO:

### PASO 1: ANALIZA QUÉ BUSCÓ EL USUARIO
- ¿Qué producto específico mencionó?
- ¿Es un ARTÍCULO específico o una FAMILIA de productos?
- ¿Qué información necesita exactamente?

### PASO 2: IDENTIFICA EL PROBLEMA
- ¿Por qué falló la consulta original?
- ¿Está buscando en la tabla correcta?
- ¿La relación entre tablas es correcta?

### PASO 3: RAZONAMIENTO LÓGICO
- Si busca un ARTÍCULO específico → debe ir a tabla ARTICULOS primero
- Si busca una FAMILIA → debe ir a tabla FAMILIAS primero
- Si busca TARIFAS → debe relacionar ARTICULOS → FAMILIAS → TARIFAS

### PASO 4: ESTRATEGIA INTELIGENTE
- Primero: Buscar el artículo/familia específico
- Segundo: Obtener su ID o código
- Tercero: Buscar información relacionada (tarifas, precios, etc.)
- **CONECTAR LOS DATOS**: artículo → familia → tarifas
- Usar filtros más amplios si es necesario (ej: "lechuga romana" → "lechuga")

## 📋 GENERA 3 ALTERNATIVAS CON RAZONAMIENTO:

ALTERNATIVA1:
TABLA: [nombre exacto de tabla del mapaERP]
RAZON: [explicación lógica paso a paso de por qué esta tabla es la correcta]
SQL: [consulta SQL que empiece con SELECT]

ALTERNATIVA2:
TABLA: [nombre exacto de tabla del mapaERP]
RAZON: [explicación lógica paso a paso de por qué esta tabla es la correcta]
SQL: [consulta SQL que empiece con SELECT]

ALTERNATIVA3:
TABLA: [nombre exacto de tabla del mapaERP]
RAZON: [explicación lógica paso a paso de por qué esta tabla es la correcta]
SQL: [consulta SQL que empiece con SELECT]

## 🚨 REGLAS CRÍTICAS:
- TODAS las consultas SQL DEBEN empezar con SELECT
- NO uses subconsultas complejas que puedan fallar
- RAZONA cada paso antes de generar la consulta
- Si buscas "lechuga romana" → primero busca en ARTICULOS, luego en FAMILIAS

Responde SOLO con el formato anterior:`;

        const response = await openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: promptAlternativas }],
            max_tokens: 800,
            temperature: 0.7
        });

        const respuesta = response.choices[0].message.content.trim();
        console.log('🔄 [BUSQUEDAS-ALTERNATIVAS] Respuesta recibida:', respuesta);
        
        // Parsear las alternativas
        const alternativas = [];
        const lineas = respuesta.split('\n');
        let alternativaActual = {};
        
        for (const linea of lineas) {
            if (linea.startsWith('ALTERNATIVA')) {
                if (Object.keys(alternativaActual).length > 0) {
                    alternativas.push(alternativaActual);
                }
                alternativaActual = {};
            } else if (linea.startsWith('TABLA:')) {
                alternativaActual.tabla = linea.replace('TABLA:', '').trim();
            } else if (linea.startsWith('RAZON:')) {
                alternativaActual.razon = linea.replace('RAZON:', '').trim();
            } else if (linea.startsWith('SQL:')) {
                alternativaActual.sql = linea.replace('SQL:', '').trim();
            }
        }
        
        if (Object.keys(alternativaActual).length > 0) {
            alternativas.push(alternativaActual);
        }
        
        console.log('✅ [BUSQUEDAS-ALTERNATIVAS] Alternativas parseadas:', alternativas.length);
        
        // 🧠 MOSTRAR THINKING DE ALTERNATIVAS
        console.log('🧠 ==========================================');
        console.log('🧠 [THINKING-ALTERNATIVAS] ESTRATEGIA NUEVA');
        console.log('🧠 ==========================================');
        console.log('🧠 [THINKING-ALTERNATIVAS] Fallé en todas las consultas anteriores');
        console.log('🧠 [THINKING-ALTERNATIVAS] Generé', alternativas.length, 'alternativas inteligentes');
        console.log('🧠 [THINKING-ALTERNATIVAS] Voy a probar cada una sistemáticamente');
        console.log('🧠 ==========================================');
        
        return alternativas;
        
    } catch (error) {
        console.error('❌ [BUSQUEDAS-ALTERNATIVAS] Error:', error.message);
        return [];
    }
}

/**
 * Genera respuesta final con el proceso completo
 */
async function generarRespuestaConProceso(mensajeOriginal, mejorResultado, explicacionProceso, openaiClient) {
    console.log('✅ [RESPUESTA-CON-PROCESO] Generando respuesta con proceso completo...');
    
    try {
        const promptRespuesta = `Genera una respuesta natural y conversacional que explique el proceso completo de búsqueda con razonamiento inteligente:

CONSULTA ORIGINAL:
"${mensajeOriginal}"

PROCESO DE BÚSQUEDA CON RAZONAMIENTO:
${explicacionProceso}

RESULTADO ENCONTRADO:
Tabla: ${mejorResultado.tabla}
Razón que funcionó: ${mejorResultado.razon}
Datos: ${JSON.stringify(mejorResultado.resultados, null, 2)}

INSTRUCCIONES:
1. Explica el proceso de búsqueda de forma natural y conversacional
2. Menciona que primero buscó en una tabla y no encontró nada
3. Explica tu razonamiento inteligente: "Entonces pensé que tal vez..."
4. Menciona que probó en otra tabla y ahí sí lo encontró
5. Presenta los datos encontrados de forma útil y clara
6. Usa un tono conversacional, como si estuvieras explicando a un compañero
7. Muestra que fuiste inteligente al cambiar de estrategia
8. NO uses frases robóticas como "Aquí tienes" o "Para el [fecha]"

ESTILO: Natural, conversacional, mostrando inteligencia en el razonamiento

Responde de forma natural:`;

        const response = await openaiClient.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: promptRespuesta }],
            max_tokens: 800,
            temperature: 0.8,
            top_p: 0.9,
            frequency_penalty: 0.6,
            presence_penalty: 0.4
        });

        const respuestaFinal = response.choices[0].message.content.trim();
        console.log('✅ [RESPUESTA-CON-PROCESO] Respuesta generada');
        
        return respuestaFinal;
        
    } catch (error) {
        console.error('❌ [RESPUESTA-CON-PROCESO] Error:', error.message);
        return `Después de buscar en diferentes tablas, encontré la información que necesitas.`;
    }
}

/**
 * Genera respuesta cuando no se encuentran resultados en ninguna búsqueda
 */
async function generarRespuestaSinResultados(mensajeOriginal, explicacionProceso, openaiClient) {
    console.log('❌ [RESPUESTA-SIN-RESULTADOS] Generando respuesta sin resultados...');
    
    try {
        const promptRespuesta = `Genera una respuesta natural y conversacional explicando que no se encontró la información después de un proceso de búsqueda inteligente:

CONSULTA ORIGINAL:
"${mensajeOriginal}"

PROCESO DE BÚSQUEDA INTELIGENTE:
${explicacionProceso}

INSTRUCCIONES:
1. Explica que hiciste un proceso de búsqueda inteligente en múltiples lugares
2. Menciona que probaste diferentes razonamientos y estrategias
3. Sugiere alternativas útiles y prácticas
4. Mantén un tono conversacional y comprensivo
5. Muestra que fuiste exhaustivo en la búsqueda
6. NO uses frases robóticas como "Aquí tienes" o "Para el [fecha]"
7. Sé útil y ofrece opciones concretas
8. Ofrece ayuda adicional

ESTILO: Natural, conversacional, mostrando que fuiste inteligente y exhaustivo

Responde de forma natural:`;

        const response = await openaiClient.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: promptRespuesta }],
            max_tokens: 600,
            temperature: 0.8,
            top_p: 0.9,
            frequency_penalty: 0.6,
            presence_penalty: 0.4
        });

        const respuestaFinal = response.choices[0].message.content.trim();
        console.log('✅ [RESPUESTA-SIN-RESULTADOS] Respuesta generada');
        
        return respuestaFinal;
        
    } catch (error) {
        console.error('❌ [RESPUESTA-SIN-RESULTADOS] Error:', error.message);
        return `Busqué en diferentes lugares pero no pude encontrar la información. Podrías intentar con un nombre alternativo o verificar la ortografía.`;
    }
}

// =====================================
// MÓDULO DE EXPORTACIÓN
// =====================================
// 
// Este módulo exporta la función principal:
// - processQueryStream: Procesamiento con streaming en tiempo real
// 
// USO EN OTROS ARCHIVOS:
// const { processQueryStream } = require('./admin/core/openAI');
// =====================================

/**
 * Exportar la función principal para su uso en otros archivos
 */
module.exports = {
    processQueryStream
};

/**
 * Construye el contexto del mapa ERP COMPLETO para que la IA analice
 */
function construirContextoMapaERPCompleto(mapaERP) {
    if (!mapaERP) {
        console.log('⚠️ [MAPA-ERP] No hay mapaERP disponible');
        return '';
    }
    
    let contexto = '\n🏢 === CONOCIMIENTO COMPLETO DEL ERP SEMILLEROS DEITANA ===\n';
    contexto += `\n📊 TOTAL DE SECCIONES DISPONIBLES: ${Object.keys(mapaERP).length}\n\n`;
    
    // Incluir TODAS las secciones del mapaERP con lenguaje humano
    Object.entries(mapaERP).forEach(([nombreSeccion, infoSeccion]) => {
        const aliasSeccion = infoSeccion.alias || nombreSeccion;
        contexto += `\n## 📋 SECCIÓN: ${aliasSeccion}\n`;
        contexto += `${infoSeccion.descripcion || 'Sin descripción'}\n`;
        
        // Campos disponibles con nombres humanos
        if (infoSeccion.columnas) {
            contexto += `\n### 📝 CAMPOS DISPONIBLES:\n`;
            Object.entries(infoSeccion.columnas).forEach(([campoTecnico, nombreHumano]) => {
                contexto += `- ${nombreHumano} (${campoTecnico}): Campo técnico para consultas SQL\n`;
            });
        }
        
        // Relaciones con otras secciones
        if (infoSeccion.relaciones) {
            contexto += `\n### 🔗 CONEXIONES CON OTRAS SECCIONES:\n`;
            Object.entries(infoSeccion.relaciones).forEach(([seccionRelacionada, infoRelacion]) => {
                contexto += `- ${seccionRelacionada}: ${infoRelacion.descripcion || 'Conexión directa'}\n`;
                if (infoRelacion.tipo) {
                    contexto += `  Tipo de relación: ${infoRelacion.tipo}\n`;
                }
            });
        }
        
        contexto += '\n';
    });
    
    // Instrucciones específicas para usar lenguaje humano
    contexto += `\n### 🎯 INSTRUCCIONES CRÍTICAS PARA LA IA:\n`;
    contexto += `- USA SIEMPRE los nombres humanos de los campos, NO los técnicos\n`;
    contexto += `- Ejemplo: Di "Nombre del cliente" NO "CL_DENO"\n`;
    contexto += `- Ejemplo: Di "Tarifa de precios" NO "CL_TARI"\n`;
    contexto += `- MENCIONA las secciones del ERP: "Archivos → Generales → Clientes"\n`;
    contexto += `- EXPLICA dónde buscas usando el lenguaje del ERP\n`;
    contexto += `- Para SQL: Usa los campos técnicos entre paréntesis\n`;
    contexto += `- Formato SQL: <sql>SELECT campo_tecnico FROM tabla WHERE condiciones</sql>\n\n`;
    

    return contexto;
}

/**
 * Genera embeddings para análisis semántico
 */
async function generarEmbedding(texto) {
    try {
        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: texto
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error('❌ [EMBEDDING] Error generando embedding:', error.message);
        return null;
    }
}

/**
 * Construye las instrucciones naturales para el prompt
 */
function construirInstruccionesNaturales(intencion, tablasRelevantes, contextoPinecone) {
    // ⚡ PRIORIDAD MÁXIMA AL INICIO - ESTILO CHATGPT
    let instrucciones = '';
    instrucciones += comportamientoGlobal + '\n\n';
    instrucciones += formatoRespuesta + '\n\n';         // ⚡ FORMATO DE RESPUESTA
    instrucciones += guiaMarkdownCompleta + '\n\n';     // ⚡ GUÍA COMPLETA DE MARKDOWN
    instrucciones += identidadEmpresa + '\n\n';
    instrucciones += terminologia + '\n\n';
    
    // ⚡ USAR CONTEXTO PINECONE SI EXISTE
    if (contextoPinecone && contextoPinecone.trim()) {
        instrucciones += `## 🧠 CONTEXTO DE MEMORIA:\n${contextoPinecone}\n\n`;
    }
    
    // ⚡ REFUERZO CRÍTICO PARA CONSULTAS SQL Y CONVERSACIONALES CON THINKING
    if (intencion && (intencion.tipo === 'sql' || intencion.tipo === 'conversacion')) {
        if (intencion.tipo === 'sql') {
            instrucciones += `
🚨🚨🚨 CONSULTA SQL DETECTADA - MODO THINKING ACTIVADO 🚨🚨🚨

**PROCESO OBLIGATORIO:**

🚨 **CRÍTICO: NO escribas NADA antes de <thinking>. Empieza DIRECTAMENTE con <thinking>** 🚨

1. **PRIMERO - THINKING (Razonamiento en voz alta):**
   - ⚡ EMPIEZA INMEDIATAMENTE con: <thinking>
   - ⚡ NO escribas texto introductorio antes del <thinking>
   - ⚡ NO digas "mirando los datos", "interesante", "puedo ayudarte" ANTES del <thinking>
   - ⚡ LA PRIMERA PALABRA de tu respuesta debe ser: <thinking>
   - **ANALIZA el mapaERP disponible** para entender la estructura de datos
   - **USA las descripciones** de las secciones del ERP para explicar dónde vas a buscar
   - **CONECTA** tu razonamiento con la consulta SQL que vas a ejecutar
   - **EXPLICA** en lenguaje natural qué información específica necesita el usuario
   - **MENCIÓN** exactamente qué datos vas a consultar usando nombres humanos de campos
   - **USA** los nombres humanos de los campos (ej: "Nombre del cliente" NO "CL_DENO")
   - **MENCIONA** las secciones del ERP (ej: "Archivos → Generales → Clientes")
   - **NO menciones** nombres técnicos de campos en el thinking
   - **USA** términos empresariales naturales y específicos del mapaERP
   - **SEA HONESTO** sobre lo que realmente vas a consultar
   - Cierra con: </thinking>

2. **SEGUNDO - SQL REAL:**
   - Formato: <sql>SELECT columnas FROM tabla WHERE condiciones LIMIT X</sql>
   - USA la base de datos real del mapaERP
   - JAMÁS inventes datos falsos

**IMPORTANTE - USO DEL MAPAERP:**
- El mapaERP contiene 800+ secciones con descripciones humanas de campos
- USA los nombres humanos de los campos para explicar qué vas a buscar
- MENCIONA las secciones del ERP (Archivos → Generales → Clientes)
- CONECTA el thinking con el SQL real que vas a ejecutar
- NO uses nombres técnicos en el thinking, usa los nombres humanos
- El thinking debe reflejar EXACTAMENTE lo que hace el SQL

**ESPECIAL PARA CONSULTAS DE INVERNADEROS:**
- Si la consulta menciona invernaderos, sectores, filas, ubicaciones ejemplo: "¿Qué hay plantado en el sector 22?"
"¿Qué partidas tenemos en el invernadero A1?"
"¿Cuántas bandejas quedan en A2?"
"¿Qué está en la fila 26 del sector 20?"
"saber lo que esta en el sector 22 del c2"
saber lo que esta en el sector 20 del c2


**EJEMPLO DINÁMICO:**

Usuario: "dime cuantas acciones comerciales hizo el cliente hernaez"

<thinking>
El usuario quiere saber cuántas gestiones comerciales ha realizado un cliente específico llamado Hernaez. Necesito consultar nuestro registro de acciones comerciales para contar todas las actividades que hemos registrado con este cliente, como visitas, llamadas, reuniones o cualquier gestión comercial, para proporcionarle el número total de interacciones.
</thinking>

<sql>SELECT COUNT(*) as total_acciones FROM acciones_com ac JOIN clientes c ON ac.ACCO_CDCL = c.id WHERE c.CL_DENO LIKE '%hernaez%'</sql>

**NOTA:** El thinking debe usar las descripciones del mapaERP y conectar con el SQL real que vas a ejecutar.

⚡ OBLIGATORIO: El thinking debe ser específico y mostrar tu razonamiento real ⚡
⚡ RECUERDA: Empezar DIRECTAMENTE con <thinking> sin texto previo ⚡
⚡ CONECTA: El thinking debe reflejar exactamente lo que vas a consultar en el SQL ⚡
`;
        } else if (intencion.tipo === 'conversacion') {
            instrucciones += `
🚨🚨🚨 CONSULTA CONVERSACIONAL DETECTADA - MODO THINKING ACTIVADO 🚨🚨🚨

**PROCESO OBLIGATORIO:**

🚨 **CRÍTICO: NO escribas NADA antes de <thinking>. Empieza DIRECTAMENTE con <thinking>** 🚨

1. **PRIMERO - THINKING (Razonamiento en voz alta):**
   - ⚡ EMPIEZA INMEDIATAMENTE con: <thinking>
   - ⚡ NO escribas texto introductorio antes del <thinking>
   - ⚡ NO digas "mirando los datos", "interesante", "puedo ayudarte" ANTES del <thinking>
   - ⚡ LA PRIMERA PALABRA de tu respuesta debe ser: <thinking>
   - **ANALIZA** qué tipo de consulta es (saludo, pregunta general, agradecimiento, etc.)
   - **EXPLICA** cómo entiendes la intención del usuario
   - **DECIDE** qué tipo de respuesta es más apropiada
   - **PLANIFICA** cómo estructurar tu respuesta para que sea útil y empática
   - **USA** el contexto empresarial disponible si es relevante
   - **SEA HONESTO** sobre tu proceso de razonamiento
   - Cierra con: </thinking>

2. **SEGUNDO - RESPUESTA CONVERSACIONAL:**
   - Responde de forma natural y conversacional
   - Usa el contexto empresarial si es relevante
   - Sé empático y útil
   - Mantén un tono amigable

**EJEMPLO DINÁMICO:**

Usuario: "¿Qué día estamos?"

<thinking>
El usuario está preguntando por la fecha actual. Esta es una consulta conversacional simple que no requiere información de la base de datos. Necesito proporcionar la fecha actual de forma amigable y ofrecer ayuda adicional si es apropiado. Es una pregunta directa que requiere una respuesta clara y útil.
</thinking>

Hoy es martes, 23 de septiembre de 2025. ¿Hay algo más en lo que pueda ayudarte? 😊

**NOTA:** El thinking debe explicar tu proceso de razonamiento para dar la respuesta más útil.

⚡ OBLIGATORIO: El thinking debe ser específico y mostrar tu razonamiento real ⚡
⚡ RECUERDA: Empezar DIRECTAMENTE con <thinking> sin texto previo ⚡
⚡ CONECTA: El thinking debe reflejar exactamente cómo vas a responder ⚡
`;
        }
    }
    
    // ⚡ REFUERZO ESPECÍFICO PARA CONSULTAS DE CONOCIMIENTO (RAG_SQL)
    if (intencion && intencion.tipo === 'rag_sql') {
        instrucciones += `
🚨🚨🚨 CONSULTA DE CONOCIMIENTO DETECTADA - MODO RAG ACTIVADO 🚨🚨🚨

**PROCESO OBLIGATORIO:**

1. **USAR INFORMACIÓN DEL CONTEXTO EMPRESARIAL:**
   - ⚡ SIEMPRE prioriza la información del contexto empresarial proporcionado
   - ⚡ NO des respuestas genéricas cuando tengas información específica
   - ⚡ Cita y usa la información oficial de Semilleros Deitana

2. **FORMATO DE RESPUESTA ESTRUCTURADO:**
   - ⚡ Usa títulos con ## para organizar la información
   - ⚡ Usa listas con - para puntos importantes
   - ⚡ Usa **texto en negrita** para destacar información clave
   - ⚡ Sé conversacional y empático

3. **EJEMPLO DE FORMATO CORRECTO:**

## 📋 Título de la Sección

**Información clave:** Descripción importante aquí

- Punto importante 1
- Punto importante 2
- Punto importante 3

### 🔍 Detalles Adicionales

Información complementaria con explicación natural y conversacional.

¿Te gustaría que profundice en algún aspecto específico o tienes alguna pregunta adicional?

⚡ OBLIGATORIO: Usar formato estructurado y ser conversacional ⚡
⚡ CRÍTICO: Priorizar información empresarial específica sobre respuestas genéricas ⚡
`;
    }
    
    
    // ⚡ USAR TABLAS RELEVANTES SI EXISTEN
    if (tablasRelevantes && tablasRelevantes.length > 0) {
        instrucciones += `## 📊 TABLAS RELEVANTES:\n${tablasRelevantes.join(', ')}\n\n`;
    }
    
    return instrucciones;
}

// =====================================
// EXPORTACIONES DEL MÓDULO
// =====================================

module.exports = {
    // Función principal de consulta
    processQueryStream,
    
    // Procesamiento de imágenes con OCR
    processImageWithOCR,
    
    // Sistema de retry logic y self-healing
    analizarYCorregirSQL,
    ejecutarSQLConRetry,
    procesarRespuestaSQLConAnalisis,
    razonamientoInteligenteContinuo,
    analizarTipoBusqueda,
    generarBusquedasAlternativas,
    generarRespuestaConProceso,
    generarRespuestaSinResultados,
    
    // Funciones auxiliares
    analizarIntencionInteligente,
    construirPromptInteligente,
    construirInstruccionesNaturales,
    obtenerInfoUsuario,
    obtenerHistorialConversacion,
    executeQuery,
    saveMessageToFirestore,
    saveAssistantMessageToFirestore,
    generarEmbedding,
    
    // Sistema de gestión de errores
    performSystemMaintenance
};