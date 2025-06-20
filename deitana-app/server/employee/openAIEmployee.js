// =====================================
// IMPORTACIONES Y CONFIGURACIÓN INICIAL
// =====================================

const { OpenAI } = require('openai');
const pool = require('../db');
const chatManager = require('../utils/chatManager');
const admin = require('../firebase-admin');
require('dotenv').config();
const promptBase = require('./promptBaseEmployee').promptBase;
const mapaERP = require('./mapaERPEmployee');

// =====================================
// CONFIGURACIÓN DE OPENAI Y VARIABLES GLOBALES
// =====================================

// Inicializar el cliente de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Historial global de conversación (en memoria, para demo)
const conversationHistory = [];
// Contexto de datos reales de la última consulta relevante
let lastRealData = null;

// =====================================
// FUNCIÓN PRINCIPAL - MODELO GPT Y PROCESAMIENTO
// Se encarga de coordinar todo el proceso de la consulta
// =====================================

async function processQuery({ message, userId, conversationId }) {
    try {
        console.log('🚀 [SISTEMA] ===== INICIANDO PROCESO DE CONSULTA =====');
        console.log('🚀 [SISTEMA] Procesando consulta de empleado:', message);
        
        // =====================================
        // PREPARACIÓN DEL CONTEXTO Y HISTORIAL
        // =====================================
        
        // Obtener el historial de la conversación
        const conversationHistory = await getConversationHistory(userId, conversationId);
        
        // Construir el contexto con el historial completo (limitado para evitar sobrecarga)
        const contextMessages = conversationHistory
            .slice(-4)  // Solo los últimos 4 mensajes para contexto
            .map(msg => ({
                role: msg.role,
                content: msg.content
            }));
        
        // Obtener información relevante del mapaERP para la consulta
        const mapaERPInfo = obtenerContenidoMapaERP(message, conversationHistory);
        
        // DEBUG: Log para ver exactamente qué información recibe GPT
        console.log('🗺️ [DEBUG-MAPA] Información enviada a GPT:');
        console.log('🗺️ [DEBUG-MAPA]', mapaERPInfo.substring(0, 500) + '...');
        console.log('🗺️ [DEBUG-MAPA] Longitud total:', mapaERPInfo.length, 'caracteres');
        
        // =====================================
        // CONSTRUCCIÓN DE MENSAJES PARA GPT
        // =====================================
        
        const messages = [
            {
                role: "system",
                content: `${promptBase}

${mapaERPInfo}`
            },
            ...contextMessages,
            {
                role: "user",
                content: message
            }
        ];

        // ETAPA 1: GPT RECIBE LA CONSULTA
        console.log('🧠 [ETAPA-1] ===== GPT RECIBE LA CONSULTA =====');
        console.log('🧠 [ETAPA-1] Usuario:', userId);
        console.log('🧠 [ETAPA-1] Consulta:', message);
        console.log('🧠 [ETAPA-1] Contexto disponible:', contextMessages.length, 'mensajes previos');
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: messages,
            temperature: 0.7,
            max_tokens: 800
        });

        const response = completion.choices[0].message.content;
        console.log('🧠 [ETAPA-1] GPT procesó la consulta exitosamente');
        console.log('📋 [RESPUESTA-GPT] Respuesta generada:', response);
        console.log('📋 [RESPUESTA-GPT] Longitud:', response.length, 'caracteres');

        // =====================================
        // DETECCIÓN Y EXTRACCIÓN DE CONSULTAS SQL
        // =====================================
        
        // Detectar TODAS las consultas SQL (tanto en formato <sql> como ```sql)
        let queries = [];
        
        // Buscar consultas en formato <sql></sql> (formato preferido)
        const sqlTagMatches = [...response.matchAll(/<sql>([\s\S]*?)<\/sql>/gim)];
        if (sqlTagMatches.length > 0) {
            queries = sqlTagMatches.map(match => {
                let sql = match[1].trim();
                // Aplicar las mismas validaciones que validarRespuestaSQL
                if (!sql.toLowerCase().startsWith('select')) {
                    return null;
                }
                // Agregar LIMIT si no es consulta de conteo/agrupación
                const esConsultaConteo = sql.toLowerCase().includes('count(*)');
                const tieneDistinct = /select\s+distinct/i.test(sql);
                const tieneGroupBy = /group by/i.test(sql);
                const tieneJoin = /join/i.test(sql);
                if (!esConsultaConteo && !tieneDistinct && !tieneGroupBy && !sql.toLowerCase().includes('limit') && !tieneJoin) {
                    sql = sql.replace(/;*\s*$/, '');
                    sql += ' LIMIT 50';
                }
                return sql;
            }).filter(sql => sql !== null);
        }
        
        // Si no encontró consultas <sql>, buscar en formato ```sql (fallback)
        if (queries.length === 0) {
        const sqlBlocks = [...response.matchAll(/```sql[\s\S]*?(SELECT[\s\S]*?;)[\s\S]*?```/gim)].map(m => m[1]);
            queries = sqlBlocks;
        }
        
        // Si aún no hay consultas, usar el método original
        if (queries.length === 0) {
            const singleSql = validarRespuestaSQL(response);
            if (singleSql) queries.push(singleSql);
        }

        // ETAPA 2: GPT DECIDE TIPO DE RESPUESTA
        console.log('🧠 [ETAPA-2] ===== GPT DECIDE TIPO DE RESPUESTA =====');
        if (queries.length > 0) {
            console.log('🧠 [ETAPA-2] Decisión: CONSULTA SQL + INFORMACIÓN');
            console.log('🧠 [ETAPA-2] Consultas SQL generadas:', queries.length);
            console.log('🧠 [ETAPA-2] Tipo: Necesita datos de base de datos para responder');
        } else {
            console.log('🧠 [ETAPA-2] Decisión: INFORMACIÓN EXTERNA/GENERAL');
            console.log('🧠 [ETAPA-2] Tipo: Saludo, información general, o conocimiento interno');
            console.log('🧠 [ETAPA-2] No requiere acceso a base de datos');
        }
        
        if (queries.length > 0) {
            console.log('⚙️ [JAVASCRIPT] ===== EJECUTANDO TRABAJO MECÁNICO =====');
            console.log('⚙️ [JAVASCRIPT] Ejecutando consultas que GPT generó...');
            let allResults = [];
            
            // JavaScript ejecuta silenciosamente las consultas que GPT le dijo
            for (let i = 0; i < queries.length; i++) {
                const sql = queries[i];
                try {
                    console.log(`⚙️ [JAVASCRIPT] Ejecutando consulta ${i + 1}/${queries.length}`);
                    const results = await executeQueryWithFuzzySearch(sql, message);
                    if (results && results.length > 0) {
                        allResults = allResults.concat(results);
                    }
                } catch (err) {
                    console.warn(`⚙️ [JAVASCRIPT] Error ejecutando consulta ${i + 1}:`, err);
                }
            }
            
            console.log(`⚙️ [JAVASCRIPT] Datos obtenidos: ${allResults.length} registros`);
            console.log('⚙️ [JAVASCRIPT] Reemplazando marcadores con datos reales...');
            
            let finalResponse = response;
            
            // Limpiar etiquetas SQL (GPT no debe mostrarlas al usuario)
            finalResponse = finalResponse.replace(/<sql>[\s\S]*?<\/sql>/g, '').trim();
            
            // JavaScript hace el reemplazo simple de marcadores con datos reales
            const datosFormateados = formatearResultados(allResults, message);
            finalResponse = finalResponse.replace(/\[DATO_BD\]/g, datosFormateados);
            
            // ETAPA 3: GPT FORMATEA COMO CHATGPT NATURAL
            console.log('🧠 [ETAPA-3] ===== GPT FORMATEA RESPUESTA NATURAL =====');
            console.log('🧠 [ETAPA-3] Datos integrados con comportamientos de promptBaseEmployee');
            console.log('🧠 [ETAPA-3] Estilo: Conversacional, amigable y contextual tipo ChatGPT');
            console.log('🧠 [ETAPA-3] Resultado: Respuesta completa lista para usuario');
            
            console.log('🎉 [RESUMEN] ===== PROCESO COMPLETADO EXITOSAMENTE =====');
            console.log('🎉 [RESUMEN] UN SOLO MODELO GPT manejó toda la inteligencia');
            console.log('🎉 [RESUMEN] JavaScript solo hizo trabajo mecánico (SQL + reemplazo)');
            
            return {
                success: true,
                data: {
                    message: finalResponse
                }
            };
        }

        // ETAPA 3: GPT FORMATEA COMO CHATGPT NATURAL
        console.log('🧠 [ETAPA-3] ===== GPT FORMATEA RESPUESTA NATURAL =====');
        console.log('🧠 [ETAPA-3] Respuesta directa con comportamientos de promptBaseEmployee');
        console.log('🧠 [ETAPA-3] Estilo: Conversacional, amigable y contextual tipo ChatGPT');
        console.log('🧠 [ETAPA-3] Resultado: Respuesta completa lista para usuario');
        
        console.log('🎉 [RESUMEN] ===== PROCESO COMPLETADO EXITOSAMENTE =====');
        console.log('🎉 [RESUMEN] UN SOLO MODELO GPT manejó toda la inteligencia');
        console.log('🎉 [RESUMEN] No se requirió acceso a base de datos');
        
        return {
            success: true,
            data: {
                message: response
            }
        };
    } catch (error) {
        console.error('🧠 [MODELO-ÚNICO] Error en processQuery:', error);
        return {
            success: false,
            data: {
                message: `Lo siento, ha ocurrido un error al procesar tu consulta: ${error.message}. Por favor, intenta reformular tu pregunta o contacta con soporte si el problema persiste.`
            }
        };
    }
}

// =====================================
// FUNCIONES DE GESTIÓN DE FIRESTORE Y CONVERSACIONES
// =====================================

// Función para obtener el historial de mensajes de una conversación
async function getConversationHistory(userId, conversationId) {
    try {
        const userChatRef = chatManager.chatsCollection.doc(userId);
        const conversationRef = userChatRef.collection('conversations').doc(conversationId);
        const conversationDoc = await conversationRef.get();
        
        if (!conversationDoc.exists) {
            return [];
        }
        
        return conversationDoc.data().messages || [];
    } catch (error) {
        console.error('Error al obtener historial de conversación:', error);
        throw error;
    }
}

// Función para guardar mensaje en Firestore
async function saveMessageToFirestore(userId, message, conversationId) {
    try {
        console.log('Iniciando saveMessageToFirestore...');
        const now = new Date();
        const messageData = {
            content: message,
            role: 'user',
            timestamp: now
        };

        const userChatRef = chatManager.chatsCollection.doc(userId);
        const conversationRef = userChatRef.collection('conversations').doc(conversationId);
        
        console.log('Obteniendo documento actual...');
        const conversationDoc = await conversationRef.get();
        let messages = [];
        
        if (conversationDoc.exists) {
            console.log('Documento existente encontrado');
            messages = conversationDoc.data().messages || [];
        } else {
            console.log('Creando nuevo documento de conversación');
            // Si es una nueva conversación, crear el documento con título inicial
            await conversationRef.set({
                title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
                createdAt: now,
                lastUpdated: now,
                messages: []
            });
        }
        
        console.log('Agregando nuevo mensaje...');
        messages.push(messageData);
        
        console.log('Actualizando documento...');
        await conversationRef.set({
            lastUpdated: now,
            messages: messages
        }, { merge: true });

        console.log('Mensaje guardado exitosamente');
        return true;
    } catch (error) {
        console.error('Error al guardar mensaje en Firestore:', error);
        throw error;
    }
}

async function saveAssistantMessageToFirestore(userId, message, conversationId) {
    try {
        console.log('Iniciando saveAssistantMessageToFirestore...');
        const now = new Date();
        const messageData = {
            content: message,
            role: 'assistant',
            timestamp: now
        };

        const userChatRef = chatManager.chatsCollection.doc(userId);
        const conversationRef = userChatRef.collection('conversations').doc(conversationId);
        
        console.log('Obteniendo documento actual...');
        const conversationDoc = await conversationRef.get();
        let messages = [];
        
        if (conversationDoc.exists) {
            console.log('Documento existente encontrado');
            messages = conversationDoc.data().messages || [];
        } else {
            console.log('Creando nuevo documento de conversación');
        }
        
        console.log('Agregando nuevo mensaje...');
        messages.push(messageData);
        
        console.log('Actualizando documento...');
        await conversationRef.set({
            lastUpdated: now,
            messages: messages
        }, { merge: true });

        console.log('Mensaje del asistente guardado exitosamente');
        return true;
    } catch (error) {
        console.error('Error al guardar mensaje del asistente en Firestore:', error);
        throw error;
    }
}

// =====================================
// FUNCIONES DE MAPEO Y CONTEXTO ERP
// =====================================

// Función para obtener contenido relevante de mapaERP - VERSIÓN SIMPLE SIN HARDCODEO
function obtenerContenidoMapaERP(consulta, historialConversacion = []) {
    try {
        // Extraer palabras clave básicas
        const palabrasClave = consulta.toLowerCase()
            .replace(/[¿?¡!.,;:()]/g, ' ')
            .split(/\s+/)
            .filter(palabra => palabra.length > 2);
        
        console.log('🔍 Palabras clave extraídas:', palabrasClave);

        // Buscar tablas relevantes basadas en la consulta actual
        const tablasRelevantes = Object.entries(mapaERP).filter(([key, value]) => {
            const nombreTabla = key.toLowerCase();
            const descripcion = value.descripcion.toLowerCase();
            
            return palabrasClave.some(palabra => {
                if (nombreTabla.includes(palabra) || palabra.includes(nombreTabla)) {
                    console.log(`✅ Coincidencia en tabla: "${palabra}" -> ${key}`);
                    return true;
                }
                if (descripcion.includes(palabra)) {
                    console.log(`✅ Coincidencia en descripción: "${palabra}" -> ${key}`);
                    return true;
                }
                return false;
            });
        });

        // CONFIAR EN GPT: Agregar contexto del historial reciente SIEMPRE
        // Sin hardcodear palabras específicas, simplemente dar contexto
        if (historialConversacion.length > 0) {
            console.log('🧠 Proporcionando contexto del historial para que GPT entienda naturalmente...');
            
            const mensajesRecientes = historialConversacion.slice(-2); // Solo últimos 2 mensajes
            const tablasDelHistorial = new Set();
            
            mensajesRecientes.forEach(mensaje => {
                Object.keys(mapaERP).forEach(tabla => {
                    if (mensaje.content.toLowerCase().includes(tabla.substring(0, 5))) {
                        tablasDelHistorial.add(tabla);
                        console.log(`🧠 Tabla del contexto: ${tabla}`);
                    }
                });
            });
            
            // Agregar tablas del contexto si no están ya incluidas
            tablasDelHistorial.forEach(tabla => {
                if (!tablasRelevantes.find(([key]) => key === tabla)) {
                    console.log(`🧠 Agregando contexto: ${tabla}`);
                    tablasRelevantes.push([tabla, mapaERP[tabla]]);
                }
            });
        }

        console.log(`📊 Total de tablas disponibles para GPT: ${tablasRelevantes.length}`);

        // Si no hay tablas específicas, dar un contexto mínimo
        if (tablasRelevantes.length === 0) {
            console.log('⚠️ Sin tablas específicas, enviando información general');
            return `Tablas disponibles: ${Object.keys(mapaERP).join(', ')}`;
        }

        // Generar información para GPT
        let respuesta = '';
        tablasRelevantes.forEach(([tabla, info]) => {
            respuesta += `\nTABLA ${tabla}:\n`;
            respuesta += `Descripción: ${info.descripcion}\n`;
            respuesta += `Columnas principales: ${Object.keys(info.columnas).join(', ')}\n`;
        });

        return respuesta;
    } catch (error) {
        console.error('❌ Error al obtener contenido de mapaERP:', error);
        return '';
    }
}

// =====================================
// FUNCIONES DE EJECUCIÓN SQL Y FUZZY SEARCH
// =====================================

// Función para ejecutar consultas SQL con fuzzy search y reintentos
async function executeQueryWithFuzzySearch(sql, mensaje, intentoNumero = 1) {
    try {
        console.log(`🔍 [FUZZY-SEARCH] Intento ${intentoNumero}/3: ${sql}`);
        
        // Para fuzzy search, validaciones más relajadas
        if (intentoNumero === 1) {
            // Solo validar en el primer intento
            if (!validarTablaEnMapaERP(sql)) {
                throw new Error('Tabla no encontrada en mapaERP');
            }
        }

        // Reemplazar los nombres de las tablas con sus nombres reales
        const sqlModificado = reemplazarNombresTablas(sql);
        console.log('Ejecutando consulta SQL:', sqlModificado);
        
        const [rows] = await pool.query(sqlModificado);
        console.log('Resultados de la consulta:', rows);
        
        if (rows.length === 0 && intentoNumero < 3) {
            console.log(`🔍 [FUZZY-SEARCH] Sin resultados, evaluando si usar búsqueda alternativa...`);
            
            // Extraer términos de búsqueda del mensaje original
            const palabrasBusqueda = extraerPalabrasClave(mensaje);
            console.log(`🔍 [FUZZY-SEARCH] Palabras clave extraídas:`, palabrasBusqueda);
            
            // Solo usar fuzzy search si hay palabras clave relevantes para productos
            if (palabrasBusqueda.length > 0) {
                console.log(`🔍 [FUZZY-SEARCH] Evaluando ${palabrasBusqueda.length} palabras clave para fuzzy search`);
                
                console.log(`🔍 [FUZZY-SEARCH] Activando búsqueda alternativa - confiando en IA`);
                
                // Generar consulta fuzzy basada en la original
                const sqlFuzzy = generarConsultaFuzzy(sql, palabrasBusqueda, intentoNumero + 1);
                console.log(`🔍 [FUZZY-SEARCH] Nueva consulta generada:`, sqlFuzzy);
                
                if (sqlFuzzy) {
                    return await executeQueryWithFuzzySearch(sqlFuzzy, mensaje, intentoNumero + 1);
                } else {
                    console.log(`🔍 [FUZZY-SEARCH] No se pudo generar consulta alternativa`);
                }
            } else {
                console.log(`🚫 [FUZZY-SEARCH] Sin palabras clave útiles, no usar fuzzy search`);
            }
        }
        
        return rows;
    } catch (error) {
        console.error(`🔍 [FUZZY-SEARCH] Error en intento ${intentoNumero}:`, error);
        
        if (intentoNumero < 3) {
            console.log(`🔍 [FUZZY-SEARCH] Reintentando con búsqueda más flexible...`);
            
            // En caso de error, intentar una búsqueda más simple
            const sqlSimple = generarConsultaSimple(sql, mensaje, intentoNumero);
            if (sqlSimple) {
                return await executeQueryWithFuzzySearch(sqlSimple, mensaje, intentoNumero + 1);
            }
        }
        
        throw error;
    }
}

// =====================================
// FUNCIONES DE FORMATEO Y UTILIDADES DE DATOS
// =====================================

// Función de JavaScript para formateo inteligente de datos (ÚNICA Y EFICIENTE)
function formatearResultados(results, query) {
    if (!results || results.length === 0) {
        return "no se encontraron resultados para esta consulta";
    }

    const pideCompleto = /completa|detallad[ao]s?|explicaci[óo]n|todo(s)?|todas/i.test(query);
    const pideAleatorio = /aleatori[ao]|ejemplo|cualquiera|al azar/i.test(query);
    
    let tablaDetectada = null;
    if (results.length > 0) {
        const columnasResultado = Object.keys(results[0]);
        tablaDetectada = determinarTabla(columnasResultado);
    }

    const resultadosLimitados = limitarResultados(results, pideCompleto ? 10 : 5, pideAleatorio);
    
    // Para consultas de conteo simple
    if (resultadosLimitados.length === 1 && Object.keys(resultadosLimitados[0]).length === 1) {
        const valor = Object.values(resultadosLimitados[0])[0];
        return valor.toString();
    }
    
    // Para múltiples registros - formato natural
    if (resultadosLimitados.length > 1 && Object.keys(resultadosLimitados[0]).length === 1) {
        // Si es una sola columna (como nombres), listar naturalmente
        const valores = resultadosLimitados.map(registro => Object.values(registro)[0]);
        if (valores.length === 2) {
            return `${valores[0]} y ${valores[1]}`;
        } else if (valores.length > 2) {
            const ultimoValor = valores.pop();
            return `${valores.join(', ')} y ${ultimoValor}`;
        }
        return valores[0];
    }
    
    // Para registros complejos con múltiples campos
    let resultado = '';
    resultadosLimitados.forEach((registro, index) => {
        if (index > 0) resultado += ', ';
        const campos = Object.entries(registro);
        const partes = [];
        campos.forEach(([campo, valor]) => {
            let descripcion = campo;
            if (tablaDetectada) {
                descripcion = obtenerDescripcionColumna(tablaDetectada, campo) || campo;
            }
            if (campo.toLowerCase().includes('fec') && valor) {
                const fecha = new Date(valor);
                valor = fecha.toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }
            partes.push(`${descripcion}: ${valor}`);
        });
        resultado += partes.join(' - ');
    });

    return resultado;
}

// Función para obtener la descripción de una columna
function obtenerDescripcionColumna(tabla, columna) {
    if (mapaERP[tabla] && mapaERP[tabla].columnas && mapaERP[tabla].columnas[columna]) {
        return mapaERP[tabla].columnas[columna];
    }
    return columna;
}

// Función para determinar la tabla basada en las columnas
function determinarTabla(columnas) {
    for (const [tabla, info] of Object.entries(mapaERP)) {
        const columnasTabla = Object.keys(info.columnas || {});
        if (columnas.every(col => columnasTabla.includes(col))) {
            return tabla;
        }
    }
    return null;
}

// Función para limitar resultados
function limitarResultados(results, limite = 5, aleatorio = false) {
    if (!results || results.length === 0) return [];
    if (aleatorio && results.length > 1) {
        const shuffled = results.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, limite);
    }
    return results.slice(0, limite);
}

// =====================================
// FUNCIONES DE VALIDACIÓN SQL Y FORMATO
// =====================================

// Función para validar que la respuesta contiene una consulta SQL
function validarRespuestaSQL(response) {
    let sqlMatch = response.match(/<sql>([\s\S]*?)<\/sql>/);
    if (!sqlMatch) {
        sqlMatch = response.match(/```sql\s*([\s\S]*?)```/);
        if (sqlMatch) {
            console.log('Advertencia: SQL encontrado en formato markdown, convirtiendo a formato <sql>');
            response = response.replace(/```sql\s*([\s\S]*?)```/, '<sql>$1</sql>');
            sqlMatch = response.match(/<sql>([\s\S]*?)<\/sql>/);
        }
    }
    if (!sqlMatch) {
        return null;
    }
    let sql = sqlMatch[1].trim();
    if (!sql) {
        throw new Error('La consulta SQL está vacía');
    }
    if (!sql.toLowerCase().startsWith('select')) {
        throw new Error('La consulta debe comenzar con SELECT');
    }
    if (sql.includes('OFFSET')) {
        const offsetMatch = sql.match(/LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i);
        if (offsetMatch) {
            sql = sql.replace(
                /LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i,
                `LIMIT ${offsetMatch[2]}, ${offsetMatch[1]}`
            );
        }
    }
    const esConsultaConteo = sql.toLowerCase().includes('count(*)');
    const tieneDistinct = /select\s+distinct/i.test(sql);
    const tieneGroupBy = /group by/i.test(sql);
    const tieneJoin = /join/i.test(sql);
    const tieneFiltroFecha = /where[\s\S]*fpe_fec|where[\s\S]*fecha|where[\s\S]*_fec/i.test(sql);
    if (!esConsultaConteo && !tieneDistinct && !tieneGroupBy && !sql.toLowerCase().includes('limit') && !(tieneJoin && tieneFiltroFecha)) {
        sql = sql.replace(/;*\s*$/, '');
        sql += ' LIMIT 50';
    }
    return sql;
}

// Función para reemplazar nombres de tablas en la consulta SQL
function reemplazarNombresTablas(sql) {
    let sqlModificado = sql;
    Object.keys(mapaERP).forEach(key => {
        if (mapaERP[key].tabla && mapaERP[key].tabla.includes('-')) {
            const regex = new RegExp(`FROM\\s+\`?${key}\`?`, 'gi');
            sqlModificado = sqlModificado.replace(regex, `FROM \`${mapaERP[key].tabla}\``);
        }
    });
    return sqlModificado;
}

// Función para validar que la tabla existe en mapaERP
function validarTablaEnMapaERP(sql) {
    const tablasEnMapa = Object.keys(mapaERP);
    const tablasEnSQL = sql.match(/FROM\s+`?([^`\s,;]+)`?/i) || [];
    const tabla = tablasEnSQL[1];
    
    if (!tabla) return true; // Si no se detecta tabla, permitir la consulta
    
    // Verificar si la tabla existe en mapaERP (ignorando backticks)
    const tablaSinBackticks = tabla.replace(/`/g, '');
    if (!tablasEnMapa.includes(tablaSinBackticks)) {
        throw new Error(`La tabla '${tabla}' no está definida en mapaERPEmployee. Tablas disponibles: ${tablasEnMapa.join(', ')}`);
    }
    
    return true;
}

// =====================================
// FUNCIONES AUXILIARES SQL ADICIONALES
// =====================================

// Función para extraer palabras clave del mensaje - CONFIANDO EN IA
function extraerPalabrasClave(mensaje) {
    // SIMPLE: Solo filtrar palabras muy cortas y signos, CONFIAR EN GPT
    const palabras = mensaje.toLowerCase()
        .replace(/[¿?¡!.,;:()]/g, ' ')
        .split(/\s+/)
        .filter(palabra => palabra.length >= 3)
        .slice(0, 4);
    
    console.log(`🔍 [PALABRAS-CLAVE] Extraídas de "${mensaje}":`, palabras);
    return palabras;
}

// Función para generar consulta fuzzy más inteligente
function generarConsultaFuzzy(sqlOriginal, palabrasClave, intento) {
    const tabla = sqlOriginal.match(/FROM\s+`?(\w+)`?/i)?.[1];
    if (!tabla || !mapaERP[tabla]) {
        console.log(`🔍 [FUZZY-SEARCH] Tabla no válida: ${tabla}`);
        return null;
    }
    
    const columnas = Object.keys(mapaERP[tabla].columnas);
    const columnaPrincipal = columnas.find(col => col.includes('DENO')) || columnas[0];
    
    console.log(`🔍 [FUZZY-SEARCH] Tabla: ${tabla}, Columna: ${columnaPrincipal}, Intento: ${intento}`);
    console.log(`🔍 [FUZZY-SEARCH] Palabras disponibles:`, palabrasClave);
    
    // Si no hay palabras clave útiles, no hacer fuzzy search
    if (palabrasClave.length === 0) {
        console.log(`🚫 [FUZZY-SEARCH] Sin palabras clave útiles, cancelando fuzzy search`);
        return null;
    }
    
    if (intento === 2) {
        // Usar la primera palabra disponible - CONFIAR EN IA
        const termino = palabrasClave[0];
        const consulta = `SELECT ${columnaPrincipal}, id FROM ${tabla} WHERE ${columnaPrincipal} LIKE '%${termino}%' LIMIT 5`;
        console.log(`🔍 [FUZZY-SEARCH] Consulta intento 2 con "${termino}": ${consulta}`);
        return consulta;
    } else if (intento === 3) {
        // Búsqueda con múltiples términos combinados
        if (palabrasClave.length > 1) {
            const terminos = palabrasClave.slice(0, 2); // Máximo 2 términos
            const condiciones = terminos.map(t => `${columnaPrincipal} LIKE '%${t}%'`).join(' OR ');
            const consulta = `SELECT ${columnaPrincipal}, id FROM ${tabla} WHERE ${condiciones} LIMIT 5`;
            console.log(`🔍 [FUZZY-SEARCH] Consulta intento 3 con múltiples términos: ${consulta}`);
            return consulta;
        } else {
            // Último intento: búsqueda general solo si hay al menos una palabra
            const consulta = `SELECT ${columnaPrincipal}, id FROM ${tabla} LIMIT 5`;
            console.log(`🔍 [FUZZY-SEARCH] Consulta intento 3 (general): ${consulta}`);
            return consulta;
        }
    }
    
    return null;
}

// Función para generar consulta simple en caso de error
function generarConsultaSimple(sqlOriginal, mensaje, intento) {
    const tabla = sqlOriginal.match(/FROM\s+`?(\w+)`?/i)?.[1];
    if (!tabla || !mapaERP[tabla]) return null;
    
    const columnas = Object.keys(mapaERP[tabla].columnas);
    const columnaPrincipal = columnas.find(col => col.includes('DENO')) || columnas[0];
    
    // Consulta simple sin WHERE
    return `SELECT ${columnaPrincipal} FROM ${tabla} LIMIT 5`;
}

// =====================================
// EXPORTACIÓN DE FUNCIONES PRINCIPALES
// =====================================

module.exports = {
    processQuery
}; 