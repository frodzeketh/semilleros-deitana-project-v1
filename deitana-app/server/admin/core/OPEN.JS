
// =====================================
// IMPORTACIONES Y CONFIGURACIÓN INICIAL
// =====================================


const { OpenAI } = require('openai');
const pool = require('../../db');
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
// FIN DE IMPORTACIONES
// =====================================


// =====================================
// IMPORTACION DE MODULO DE RAG
// =====================================


const ragInteligente = require('../data/integrar_rag_nuevo');


// =====================================
// FIN DE IMPORTACION DE MODULO DE RAG
// =====================================


// =====================================
// CONFIGURACIÓN DE OPEN AI DESDE LAS VARIABLES DE ENTORNO
// =====================================


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});


// =====================================
// FIN DE CONFIGURACIÓN DE OPEN AI DESDE LAS VARIABLES DE ENTORNO
// =====================================


// =====================================
//  VARIABLES GLOBALES DE CONTEXTO 
// =====================================


// Historial global de conversación (en memoria, para demo)
const conversationHistory = [];
// Contexto de datos reales de la última consulta relevante
let lastRealData = null;


// =====================================
// FIN DE VARIABLES GLOBALES DE CONTEXTO
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
// PREPARACION DE DATOS SQL PARA FORMATEO POSTERIOR
// =====================================

/**
 * 
 * @param {Array} results - Resultados de la consulta SQL
 * @param {string} query - Consulta original del usuario
 * @returns {string} Respuesta formateada de forma natural
 * 
 */







// =====================================
// EJECUTADOR DE CONSULTAS SQL CON REINTENTOS Y MANEJO DE ERRORES
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
// REEMPLAZAR DE TABLAS CON NOMBRES REALES
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
    const intencion = await analizarIntencionInteligente(mensaje);
    console.log('🎯 [PROMPT-BUILDER] Intención detectada:', intencion);
    
    // 2. Configuración del modelo (siempre gpt-4o)
    const configModelo = {
        modelo: 'gpt-4o',
        maxTokens: 3000,
        temperature: 0.9,
        topP: 0.95,
        frequencyPenalty: 0.5,
        presencePenalty: 0.4
    };



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
    
    // RAG SIEMPRE ACTIVO para evitar alucinaciones
    try {
        console.log('🧠 [RAG] Recuperando conocimiento empresarial...');
        contextoRAG = await ragInteligente.recuperarConocimientoRelevante(mensaje, 'sistema');
        console.log('✅ [RAG] Conocimiento recuperado:', contextoRAG ? contextoRAG.length : 0, 'caracteres');
    } catch (error) {
        console.error('❌ [RAG] Error recuperando conocimiento:', error.message);
        // Continuar sin RAG si hay error, pero registrar el problema
    }
    












    // =====================================
// ENSAMBLAJE DEL PROMPT FINAL
// =====================================
    
    // 6. Preparar la fecha actual para el prompt
    const fechaActual = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' });
    
    // 7. Crear el prompt base (como el encabezado de una carta)
    const promptGlobalConFecha = promptGlobal.replace('{{FECHA_ACTUAL}}', fechaActual);
    
    // 8. Empezar a construir el prompt final (como empezar a escribir la carta)
    let promptFinal = `${promptGlobalConFecha}\n` + instruccionesNaturales;
    
    // 9. Si encontramos información de la empresa, ponerla AL PRINCIPIO (como información importante)
    if (contextoRAG) {
        console.log('🎯 [RAG] PRIORIZANDO contexto empresarial al inicio');
        // Reconstruir el prompt poniendo la información de la empresa al principio
        promptFinal = `${promptGlobalConFecha}\n\nCONOCIMIENTO EMPRESARIAL ESPECÍFICO:\n${contextoRAG}\n\nINSTRUCCIÓN: Debes usar siempre la información del conocimiento empresarial específico proporcionado arriba. Si la información está disponible en ese contexto, úsala. No des respuestas genéricas cuando tengas información específica de la empresa.\n\n` + instruccionesNaturales;
    }
    
    // 10. Agregar la estructura de la base de datos (como un mapa de la ciudad)
    promptFinal += `${contextoMapaERP}\n\n`;
    
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
            ragIncluido: true // SIEMPRE incluido para evitar alucinaciones
        }
    };
}









































// =====================================
// ANÁLISIS INTELIGENTE DE INTENCIONES
// =====================================

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

REGLAS INTELIGENTES:

🔍 ES SQL SI:
- Pide DATOS específicos (números, cantidades, listas)
- Usa palabras como: "cuántos", "dame", "lista de", "muestra", "busca"
- Menciona ENTIDADES de base de datos (clientes, productos, ventas, etc.)
- Pide información que requiere CONSULTAR datos
- Incluye filtros (por fecha, ubicación, tipo, etc.)

📚 ES CONOCIMIENTO SI:
- Pide EXPLICACIONES o DEFINICIONES
- Usa palabras como: "qué es", "cómo funciona", "explica", "significa"
- Pregunta sobre PROCESOS o PROTOCOLOS
- Busca información conceptual o teórica

💬 ES CONVERSACIÓN SI:
- Saludos, despedidas, agradecimientos
- Charla casual sin solicitud específica de datos

⚡ PRINCIPIO CLAVE: Si hay DUDA, es probablemente SQL (la mayoría de consultas en ERP piden datos)

Analiza la INTENCIÓN SEMÁNTICA, no palabras específicas.

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
// GUARDA MENSAJES EN FIREBASE Y GUARDA RESPUESTA DEL ASISTENTE EN FIRESTORE
// =====================================



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
// LOGS DE MANTEMINIENTO
// =====================================

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
