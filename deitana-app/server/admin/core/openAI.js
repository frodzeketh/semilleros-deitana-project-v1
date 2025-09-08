// =====================================
// SISTEMA DE INTELIGENCIA ARTIFICIAL PARA SEMILLEROS DEITANA
// =====================================
// 
// Este archivo es el núcleo central del asistente IA empresarial que:
// - Procesa consultas naturales y las convierte en SQL
// - Integra conocimiento empresarial con datos actuales
// - Proporciona respuestas personalizadas y naturales
// - Mantiene contexto conversacional y memoria
// - Soporta streaming en tiempo real
//
// ARQUITECTURA PRINCIPAL:
// 1. Análisis de intención con IA
// 2. Construcción inteligente de prompts
// 3. Ejecución de SQL con validación
// 4. Formateo natural de respuestas
// 5. Persistencia en Firestore y Pinecone
// 6. Streaming en tiempo real
//
// AUTOR: Sistema de IA Semilleros Deitana
// VERSIÓN: 2.0 (Optimizada con una sola llamada IA)
// FECHA: 2024
// =====================================

// =====================================
// IMPORTACIONES Y CONFIGURACIÓN INICIAL
// =====================================

const { OpenAI } = require('openai');
const pool = require('../../db');
const chatManager = require('../../utils/chatManager');
const admin = require('../../firebase-admin');
const pineconeMemoria = require('../../utils/pinecone');
const comandosMemoria = require('../../utils/comandosMemoria');
const langfuseUtils = require('../../utils/langfuse');
require('dotenv').config();
const mapaERP = require('./mapaERP');
// Importaciones desde las carpetas organizadas
const {
    formatoObligatorio, 
    formatoRespuesta,
    formatoRespuestaSimple,
    formatoUltraNatural,
    guiaMarkdownCompleta,
    estiloVisualChatGPT,
    prioridadMaximaChatGPT,
    promptGlobal, 
    promptBase, 
    comportamientoGlobal,
    comportamientoChatGPT
} = require('../prompts/GLOBAL');

const { sqlRules } = require('../prompts/SQL');

const { identidadEmpresa, terminologia } = require('../prompts/DEITANA');

// Importar sistema RAG
const ragInteligente = require('../data/integrar_rag_nuevo');
const { analizarIntencionConIA } = require('../data/funcion_intencion_ia');

// Inicializar el cliente de OpenAI
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
// FUNCIONES AUXILIARES - FORMATEO Y UTILIDADES
// =====================================
// 
// Estas funciones se encargan de:
// - Formatear resultados SQL en Markdown
// - Obtener descripciones de columnas desde mapaERP
// - Determinar tablas basadas en columnas
// - Limitar y aleatorizar resultados
// - Generar respuestas naturales y conversacionales
// =====================================



/**
 * Función para formatear la respuesta final - RESPUESTAS NATURALES
 * Convierte resultados SQL en respuestas conversacionales y amigables
 * 
 * @param {Array} results - Resultados de la consulta SQL
 * @param {string} query - Consulta original del usuario
 * @returns {string} Respuesta formateada de forma natural
 * 
 * CARACTERÍSTICAS:
 * - Detecta tipo de entidad (clientes, técnicos, etc.)
 * - Genera saludos personalizados
 * - Filtra resultados válidos
 * - Capitaliza nombres automáticamente
 * - Agrega preguntas de seguimiento
 */


// =====================================
// FUNCIONES DE EJECUCIÓN Y VALIDACIÓN SQL
// =====================================
// 
// Estas funciones manejan:
// - Ejecución segura de consultas SQL
// - Validación y extracción de SQL de respuestas de IA
// - Reemplazo de nombres de tablas con nombres reales
// - Validación de tablas y columnas en mapaERP
// - Prevención de SQL injection
// - Corrección automática de sintaxis SQL
// =====================================

/**
 * Función para ejecutar consultas SQL con manejo de errores
 * @param {string} sql - Consulta SQL a ejecutar
 * @returns {Promise<Array>} Resultados de la consulta
 */
async function executeQuery(sql) {
    try {
        // Reemplazar los nombres de las tablas con sus nombres reales
        const sqlModificado = reemplazarNombresTablas(sql);
        console.log('🔍 [SQL-EXEC] Ejecutando:', sqlModificado);
        const [rows] = await pool.query(sqlModificado);
        console.log('📊 [SQL-RESULT] Filas devueltas:', rows.length);
        
        if (rows.length === 0) {
            console.log('⚠️ [SQL-RESULT] La consulta no devolvió resultados');
            return [];
        }

        return rows;
    } catch (error) {
        console.error('❌ [SQL-EXEC] Error ejecutando consulta:', error.message);
        console.error('❌ [SQL-EXEC] SQL:', sql);
        throw error;
    }
}

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

// Función para validar que la tabla existe en mapaERP






// =====================================
// FUNCIONES DE PERSISTENCIA Y ALMACENAMIENTO
// =====================================
// 
// Estas funciones gestionan:
// - Guardado de mensajes de usuario en Firestore
// - Guardado de respuestas del asistente
// - Detección de preguntas de seguimiento
// - Organización de conversaciones por usuario
// - Persistencia asíncrona para no bloquear respuestas
// =====================================

// Función auxiliar para detectar si la pregunta es de seguimiento sobre teléfono de cliente


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
// BÚSQUEDA FLEXIBLE (FUZZY SEARCH)
// =====================================
// 
// Esta función implementa búsqueda inteligente cuando SQL falla:
// - Genera variantes del término de búsqueda
// - Prueba múltiples columnas y tablas
// - Búsqueda multi-término para artículos
// - Manejo especial para tablas específicas
// - Recuperación automática cuando consultas exactas fallan
// =====================================


// =====================================
// LÓGICA DE CONSTRUCCIÓN DE PROMPT INTELIGENTE
// =====================================
// 
// Esta sección contiene la lógica unificada que antes estaba en construirPrompt.js:
// - Análisis de intención con IA (SQL, conversación, RAG+SQL)
// - Detección automática de tablas relevantes
// - Construcción de contexto de mapaERP selectivo
// - Modelo único optimizado (gpt-4o)
// - Construcción de instrucciones naturales
// - Ensamblaje final del prompt optimizado
// =====================================
// Las importaciones ya están hechas arriba desde las carpetas organizadas

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
    
    // 1. ANÁLISIS INTELIGENTE RÁPIDO (SIN LLAMADAS IA)
    const intencion = await analizarIntencionInteligente(mensaje);
    console.log('🎯 [PROMPT-BUILDER] Intención detectada:', intencion);
    
    // 2. Seleccionar modelo apropiado
    const configModelo = seleccionarModeloInteligente(intencion, []);
    
    // 3. SIEMPRE incluir mapaERP - la IA decide si lo usa
    const contextoMapaERP = construirContextoMapaERPCompleto(mapaERP);
    console.log('📋 [MAPA-ERP] Incluyendo mapaERP completo - IA decide si lo usa');
    
    // 4. Construir instrucciones naturales
    const instruccionesNaturales = construirInstruccionesNaturales(intencion, [], contextoPinecone);
    
    // 5. RAG INTELIGENTE Y SELECTIVO (OPTIMIZADO)
    let contextoRAG = '';
    
    // RAG SIEMPRE ACTIVO para evitar alucinaciones
    try {
        console.log('🧠 [RAG] Recuperando conocimiento empresarial...');
        contextoRAG = await ragInteligente.recuperarConocimientoRelevante(mensaje, 'sistema');
        console.log('✅ [RAG] Conocimiento recuperado:', contextoRAG ? contextoRAG.length : 0, 'caracteres');
    } catch (error) {
        console.error('❌ [RAG] Error recuperando conocimiento:', error.message);
        // Continuar sin RAG si hay error, pero registrar el problema
    }
    
    // 6. Ensamblar prompt final (OPTIMIZADO)
    const fechaActual = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' });
    const promptGlobalConFecha = promptGlobal.replace('{{FECHA_ACTUAL}}', fechaActual);
    let promptFinal = `${promptGlobalConFecha}\n` + instruccionesNaturales;
    
    // Priorizar contexto RAG al inicio del prompt si existe
    if (contextoRAG) {
        console.log('🎯 [RAG] PRIORIZANDO contexto empresarial al inicio');
        promptFinal = `${promptGlobalConFecha}\n\nCONOCIMIENTO EMPRESARIAL ESPECÍFICO:\n${contextoRAG}\n\nINSTRUCCIÓN: Debes usar siempre la información del conocimiento empresarial específico proporcionado arriba. Si la información está disponible en ese contexto, úsala. No des respuestas genéricas cuando tengas información específica de la empresa.\n\n` + instruccionesNaturales;
    }
    
    // Añadir estructura de datos SIEMPRE - la IA decide si la usa
    promptFinal += `${contextoMapaERP}\n\n`;
    
    // Añadir reglas SQL solo para consultas SQL
    if (intencion.tipo === 'sql' || intencion.tipo === 'rag_sql') {
        promptFinal += `${sqlRules}\n\n`;
    }
    
    // El contexto RAG ya se añadió al inicio si existe
    
    // Añadir contexto de datos previos si existe
    if (contextoDatos) {
        promptFinal += `DATOS DE CONTEXTO PREVIO:\n${contextoDatos}\n\n`;
    }
    
    // Añadir contexto conversacional de forma inteligente
    if (historialConversacion && historialConversacion.length > 0) {
        const ultimosMensajes = historialConversacion.slice(-4);
        const contextoConversacional = ultimosMensajes.map(msg => 
            `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`
        ).join('\n');
        
        promptFinal += `## 💬 CONTEXTO CONVERSACIONAL RECIENTE\n\n${contextoConversacional}\n\n## 🎯 INSTRUCCIONES DE CONTINUIDAD\n\n- Mantén la continuidad natural de la conversación\n- NO te presentes de nuevo si ya has saludado\n- Usa el contexto previo para dar respuestas coherentes\n- Si el usuario hace referencia a algo mencionado antes, úsalo\n- Mantén el tono y estilo de la conversación en curso\n\n`;
    }
    
    console.log('✅ [PROMPT-BUILDER] Prompt construido - MapaERP: SIEMPRE, RAG: SIEMPRE');
    
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
            ragIncluido: true // SIEMPRE incluido para evitar alucinaciones
        }
    };
}

/**
 * Analiza la intención usando IA real (escalable para 900 tablas y 200 usuarios)
 */
async function analizarIntencionInteligente(mensaje) {
    console.log('🧠 [INTENCION-IA] Analizando consulta con IA real...');
    
    try {
        // Usar IA para analizar la intención de forma inteligente
        const promptAnalisis = `Analiza la siguiente consulta y determina qué tipo de respuesta necesita:

CONSULTA: "${mensaje}"

OPCIONES:
1. "sql" - Si la consulta pide datos, números, conteos, listas, información de la base de datos
2. "conocimiento" - Si la consulta pide explicaciones, definiciones, protocolos, información del archivo .txt
3. "conversacion" - Si es un saludo, agradecimiento, o conversación casual

Ejemplos:
- "cuantas partidas se hicieron" → sql
- "5 técnicos" → sql
- "dime 3 vendedores" → sql
- "casas comerciales" → sql
- "lista de clientes" → sql
- "qué significa tratamientos extraordinarios" → conocimiento  
- "hola, cómo estás" → conversacion
- "explica el protocolo de germinación" → conocimiento

Responde SOLO con: sql, conocimiento, o conversacion`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: promptAnalisis }],
            max_tokens: 10,
            temperature: 0.1
        });

        const tipo = response.choices[0].message.content.trim().toLowerCase();
        console.log(`✅ [INTENCION-IA] Tipo detectado: ${tipo}`);

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
// FUNCIONES DE USUARIO Y CONTEXTO CONVERSACIONAL
// =====================================
// 
// Estas funciones gestionan:
// - Obtención de información del usuario desde Firebase
// - Recuperación de historial conversacional
// - Personalización de respuestas con nombre del usuario
// - Contexto conversacional para continuidad
// - Gestión de sesiones y conversaciones
// =====================================

// =====================================
// FUNCIÓN PRINCIPAL - MODELO GPT Y PROCESAMIENTO
// Se encarga de coordinar todo el proceso de la consulta
// =====================================

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

// =====================================
// FUNCIÓN PRINCIPAL - PROCESAMIENTO DE CONSULTAS
// =====================================
// 
// Esta es la función central que coordina todo el proceso:
// - Análisis de intención y construcción de prompt
// - Llamada única optimizada a OpenAI
// - Procesamiento por tipo (SQL, conversación, RAG+SQL)
// - Ejecución de SQL con validación
// - Formateo natural de respuestas
// - Personalización y persistencia
// - Manejo de errores y fallbacks
// =====================================



// =====================================
// FUNCIÓN STREAMING PARA TIEMPO REAL
// =====================================
// 
// Esta función proporciona respuesta en tiempo real:
// - Streaming chunk por chunk al frontend
// - Procesamiento post-streaming para SQL
// - Segunda llamada para explicación natural
// - Headers especiales para streaming HTTP
// - Manejo de errores en tiempo real
// - Persistencia asíncrona de respuestas
// =====================================

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
    const tiempoInicio = Date.now();
    console.log('🚀 [STREAMING] ===== INICIANDO PROCESO DE CONSULTA CON STREAMING =====');
    console.log('🚀 [STREAMING] Procesando consulta:', message);
    console.log('🚀 [STREAMING] Usuario ID:', userId);
    console.log('🚀 [STREAMING] Conversación ID:', conversationId);

    // =====================================
    // OBTENER INFORMACIÓN DEL USUARIO Y CONTEXTO
    // =====================================
    
    const infoUsuario = await obtenerInfoUsuario(userId);
    const historialConversacion = await obtenerHistorialConversacion(userId, conversationId);

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
        const promptBuilder = await construirPromptInteligente(
            message, 
            mapaERP,
            openai,
            contextoPinecone, 
            lastRealData || '',
            false
        );
        
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

        let fullResponse = '';
        let tokenCount = 0;
        let sqlDetected = false;

        try {
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

            console.log('✅ [STREAMING] Stream iniciado correctamente');

            // Procesar cada chunk del stream
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
                
                if (content) {
                    fullResponse += content;
                    tokenCount++;
                    
                    // Detectar si hay SQL en la respuesta acumulada
                    if (!sqlDetected && fullResponse.includes('<sql>')) {
                        sqlDetected = true;
                        console.log('🔍 [STREAMING] SQL detectado en respuesta');
                        
                        // Enviar mensaje de "pensando" en lugar del contenido con SQL
                        response.write(JSON.stringify({
                            type: 'thinking',
                            message: 'Buscando información en el ERP',
                            timestamp: Date.now()
                        }) + '\n');
                    }
                    
                    // Solo enviar chunks si NO se detectó SQL
                    if (!sqlDetected) {
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
            // PROCESAMIENTO POST-STREAMING
            // =====================================

            console.log('🔍 [STREAMING] Procesando respuesta para SQL...');
            
            let finalMessage = fullResponse;
            
            // Verificar si la IA generó SQL en la respuesta
            const sql = validarRespuestaSQL(fullResponse);
            
            if (sql) {
                console.log('✅ [STREAMING] SQL encontrado, ejecutando consulta(s)...');
                try {
                    let results;
                    let allResults = [];
                    
                    // Manejar múltiples consultas SQL
                    if (Array.isArray(sql)) {
                        console.log(`🔄 [STREAMING] Ejecutando ${sql.length} consultas SQL...`);
                        for (let i = 0; i < sql.length; i++) {
                            console.log(`🔍 [STREAMING] Ejecutando consulta ${i + 1}/${sql.length}`);
                            const queryResults = await executeQuery(sql[i]);
                            allResults.push({
                                query: sql[i],
                                results: queryResults,
                                index: i + 1
                            });
                        }
                        results = allResults;
                    } else {
                        // Consulta única (compatibilidad)
                        results = await executeQuery(sql);
                    }
                    
                    if (results && (Array.isArray(results) ? results.length > 0 : results.length > 0)) {
                        // Guardar los resultados reales para contexto futuro
                        lastRealData = JSON.stringify(results);
                        
                        console.log('✅ [STREAMING] SQL ejecutado exitosamente - haciendo segunda llamada para explicar datos');
                        
                        // Segunda llamada a la IA para explicar los datos reales de forma natural
                        // Segunda llamada específica para explicar datos (SIN sqlRules)
                        console.log('🔄 [STREAMING] Construyendo segunda llamada para explicar datos...');
                        
                        const fechaActual = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' });
                        const promptGlobalConFecha = promptGlobal.replace('{{FECHA_ACTUAL}}', fechaActual);
                        
                        // ⚡ CONSTRUIR SEGUNDA LLAMADA CON MÁXIMA PRIORIDAD CHATGPT
                        let promptExplicacion = `${promptGlobalConFecha}\n`;
                        promptExplicacion += `${prioridadMaximaChatGPT}\n\n`; // ⚡ PRIORIDAD MÁXIMA AL INICIO
                        promptExplicacion += `${comportamientoChatGPT}\n\n`;
                        promptExplicacion += `${estiloVisualChatGPT}\n\n`;    // ⚡ ESTILO CHATGPT ANTI-ROBÓTICO
                        promptExplicacion += `${guiaMarkdownCompleta}\n\n`;  // ⚡ GUÍA COMPLETA DE MARKDOWN
                        promptExplicacion += `${identidadEmpresa}\n\n`;
                        promptExplicacion += `${terminologia}\n\n`;
                        
                        // Los prompts organizados ya contienen toda la lógica de formato
                        
                        // DEBUG: Mostrar el prompt completo que se está construyendo
                        console.log('🔍 [DEBUG-PROMPT] Prompt unificado construido:');
                        console.log('📄 [DEBUG-PROMPT] Longitud total:', promptExplicacion.length, 'caracteres');
                        console.log('📄 [DEBUG-PROMPT] Contenido formatoRespuesta incluido:', formatoRespuesta ? 'SÍ' : 'NO');
                        
                        // Añadir contexto RAG si existe (CRÍTICO para evitar alucinaciones)
                        try {
                            const contextoRAGSegunda = await ragInteligente.recuperarConocimientoRelevante(message, 'sistema');
                            if (contextoRAGSegunda) {
                                console.log('🎯 [RAG] Incluyendo contexto empresarial en segunda llamada');
                                // Usar el sistema de prompts unificado para el RAG también
                                promptExplicacion += `\n${contextoRAGSegunda}\n\n`;
                            }
                        } catch (error) {
                            console.log('⚠️ [RAG] No se pudo obtener contexto RAG para segunda llamada:', error.message);
                        }
                        
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
                            promptExplicacion += `CONTEXTO CONVERSACIONAL RECIENTE:\n\n${contextoConversacional}\n\nINSTRUCCIONES DE CONTINUIDAD:\nMantén la continuidad natural de la conversación. NO te presentes de nuevo si ya has saludado. Usa el contexto previo para dar respuestas coherentes. Si el usuario hace referencia a algo mencionado antes, úsalo. Mantén el tono y estilo de la conversación en curso.\n\n`;
                        }
                        
                        promptExplicacion += `## 📊 DATOS A EXPLICAR:

CONSULTA ORIGINAL: "${message}"  
${Array.isArray(sql) ? 
    `CONSULTAS SQL EJECUTADAS: ${sql.length} consultas\n${sql.map((q, i) => `${i + 1}. ${q}`).join('\n')}` : 
    `SQL EJECUTADO: ${sql}`}  
RESULTADOS: ${JSON.stringify(results, null, 2)}

## 🎯 INSTRUCCIÓN ESPECÍFICA:

Tu tarea es explicar estos resultados de forma natural y conversacional. NO generes nuevo SQL, solo explica los datos que ya están disponibles.

${Array.isArray(results) ? 
    `**IMPORTANTE**: Tienes ${results.length} conjuntos de resultados diferentes. Explica cada uno por separado usando encabezados claros.` : 
    ''}

**IMPORTANTE**: Sigue las reglas de formato visual definidas en el prompt para dar respuestas estéticas y bien estructuradas.


`;

                        // Segunda llamada con historial para mantener contexto
                        const mensajesSegundaLlamada = [
                            {
                                role: 'system',
                                content: promptExplicacion
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

                        const segundaLlamada = await openai.chat.completions.create({
                            model: 'gpt-4o',
                            messages: mensajesSegundaLlamada,
                            max_tokens: 2000,               // ⚡ MÁS TOKENS PARA RESPUESTAS COMPLETAS
                            temperature: 0.9,               // ⚡ MÁXIMA CREATIVIDAD
                            top_p: 0.95,                    // ⚡ SAMPLING CREATIVO
                            frequency_penalty: 0.6,         // ⚡ PENALIZAR FUERTEMENTE REPETICIONES
                            presence_penalty: 0.4           // ⚡ MÁXIMA DIVERSIDAD EN ESTILO
                        });

                        const explicacionNatural = segundaLlamada.choices[0].message.content;
                        
                        // Reemplazar la respuesta técnica con la explicación natural
                        finalMessage = explicacionNatural;
                        
                        console.log('✅ [STREAMING] Segunda llamada completada - respuesta natural generada');
                    } else {
                        // Si no hay resultados, mantener la respuesta original del modelo
                        console.log('📚 [STREAMING] Sin resultados SQL - usar respuesta del modelo');
                    }
                } catch (error) {
                    console.error('❌ [STREAMING-SQL] Error ejecutando consulta:', error.message);
                    // Mantener la respuesta original del modelo si hay error
                    console.log('📚 [STREAMING] Error en SQL - usar respuesta del modelo');
                }
            } else {
                console.log('📚 [STREAMING] Sin SQL - usar respuesta del modelo tal como está');
            }

            // Personalizar respuesta con nombre del usuario
            const respuestaPersonalizada = personalizarRespuesta(finalMessage, infoUsuario.nombre);

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
    

    
    let contexto = '\n=== ESTRUCTURA COMPLETA DE LA BASE DE DATOS ===\n';
    contexto += `\nTOTAL DE TABLAS DISPONIBLES: ${Object.keys(mapaERP).length}\n\n`;
    
    // Incluir TODAS las tablas del mapaERP para que la IA las analice
    Object.entries(mapaERP).forEach(([nombreTabla, infoTabla]) => {
        contexto += `\n## 📊 TABLA: ${nombreTabla}\n`;
        contexto += `Descripción: ${infoTabla.descripcion || 'Sin descripción'}\n`;
        
        // Columnas disponibles
        if (infoTabla.columnas) {
            contexto += `\n### 📋 COLUMNAS:\n`;
            Object.entries(infoTabla.columnas).forEach(([columna, descripcion]) => {
                contexto += `- ${columna}: ${descripcion}\n`;
            });
        }
        
        // Relaciones con otras tablas
        if (infoTabla.tablas_relacionadas) {
            contexto += `\n### 🔗 RELACIONES:\n`;
            Object.entries(infoTabla.tablas_relacionadas).forEach(([tablaRelacionada, infoRelacion]) => {
                contexto += `- ${tablaRelacionada}: ${infoRelacion.descripcion || 'Relación directa'}\n`;
                if (infoRelacion.tipo) {
                    contexto += `  Tipo: ${infoRelacion.tipo}\n`;
                }
                if (infoRelacion.campo_enlace_local && infoRelacion.campo_enlace_externo) {
                    contexto += `  JOIN: ${nombreTabla}.${infoRelacion.campo_enlace_local} = ${tablaRelacionada}.${infoRelacion.campo_enlace_externo}\n`;
                }
            });
        }
        
        contexto += '\n';
    });
    
    // Instrucciones para la IA
    contexto += `\n### 🎯 INSTRUCCIONES PARA LA IA:\n`;
    contexto += `- Analiza la consulta del usuario\n`;
    contexto += `- Identifica qué tablas del mapaERP son relevantes\n`;
    contexto += `- Usa las relaciones definidas para hacer JOINs correctos\n`;
    contexto += `- NO inventes tablas que no estén en esta lista\n`;
    contexto += `- Genera SQL usando EXACTAMENTE las columnas mostradas\n`;
    contexto += `- Formato: <sql>SELECT columnas FROM tabla [JOIN otras_tablas] WHERE condiciones</sql>\n\n`;
    

    return contexto;
}

/**
 * Selecciona el modelo apropiado para la consulta
 */
function seleccionarModeloInteligente(intencion, tablasRelevantes) {
    // ✅ CONFIGURACIÓN ULTRA-NATURAL COMO CHATGPT
    const config = {
        modelo: 'gpt-4o',           // Modelo más capaz para naturalidad
        maxTokens: 3000,            // Tokens generosos para variabilidad
        temperature: 0.9,           // ⚡ MÁXIMA CREATIVIDAD Y VARIABILIDAD
        topP: 0.95,                 // Sampling creativo
        frequencyPenalty: 0.5,      // ⚡ PENALIZAR FUERTEMENTE REPETICIONES
        presencePenalty: 0.4,       // ⚡ MÁXIMA DIVERSIDAD EN TEMAS Y ESTILO
        razon: 'Configuración ultra-natural para eliminar robótica y repetitividad'
    };
    
    return config;
}

/**
 * Construye las instrucciones naturales para el prompt
 */
function construirInstruccionesNaturales(intencion, tablasRelevantes, contextoPinecone) {
    // ⚡ PRIORIDAD MÁXIMA AL INICIO - ESTILO CHATGPT
    let instrucciones = prioridadMaximaChatGPT + '\n\n';  // ⚡ PRIORIDAD MÁXIMA
    instrucciones += comportamientoChatGPT + '\n\n';
    instrucciones += estiloVisualChatGPT + '\n\n';       // ⚡ ESTILO VISUAL CHATGPT ANTI-ROBÓTICO
    instrucciones += guiaMarkdownCompleta + '\n\n';     // ⚡ GUÍA COMPLETA DE MARKDOWN
    instrucciones += identidadEmpresa + '\n\n';
    instrucciones += terminologia + '\n\n';
    
    // Los prompts organizados ya contienen toda la lógica necesaria
    
    return instrucciones;
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

// =====================================
// EXPORTACIONES DEL MÓDULO
// =====================================

module.exports = {
    // Función principal de consulta
    consultaModelo,
    
    // Funciones auxiliares
    analizarIntencionInteligente,
    construirPromptUnificado,
    seleccionarModeloInteligente,
    construirInstruccionesNaturales,
    generarEmbedding
};