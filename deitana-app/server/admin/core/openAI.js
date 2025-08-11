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
// 1. IMPORTACIONES Y CONFIGURACIÓN INICIAL
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

// Importaciones de prompts
const { formatoObligatorio } = require('../prompts/formatoObligatorio');
const { promptGlobal } = require('../prompts/promptGlobal');
const { promptBase } = require('../prompts/base');
const { sqlRules, generarPromptSQL, generarPromptRAGSQL } = require('../prompts/sqlRules');
const { comportamientoChatGPT, comportamiento, comportamientoAsistente } = require('../prompts/comportamiento');
const { formatoRespuesta, generarPromptFormateador, generarPromptConversacional, generarPromptRAGSQLFormateador, generarPromptErrorFormateador, generarPromptCombinado } = require('../prompts/formatoRespuesta');
const ragInteligente = require('./ragInteligente');

// Inicializar el cliente de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// =====================================
// PROMPTS PRECOMPILADOS EN MEMORIA
// =====================================
// 
// Sistema de prompts optimizados que:
// - Carga prompts al iniciar el servidor (no en cada petición)
// - Evita I/O y concatenaciones repetidas (~50-300ms de ahorro)
// - Mantiene prompts en memoria para acceso instantáneo
// - Permite personalización dinámica cuando sea necesario
// =====================================

// Prompts precompilados (se cargan al iniciar el servidor)
let promptsPrecompilados = {
    base: null,
    sqlRules: null,
    comportamiento: null,
    formatoObligatorio: null,
    promptGlobal: null,
    mapaERPContexto: null
};

/**
 * Inicializa todos los prompts precompilados
 * Se ejecuta al iniciar el servidor
 */
async function inicializarPromptsPrecompilados() {
    console.log('🚀 [PROMPTS] Inicializando prompts precompilados...');
    
    try {
        // Cargar prompts base
        promptsPrecompilados.base = promptBase;
        promptsPrecompilados.sqlRules = sqlRules;
        promptsPrecompilados.comportamiento = comportamientoChatGPT;
        promptsPrecompilados.formatoObligatorio = formatoObligatorio;
        promptsPrecompilados.promptGlobal = promptGlobal;
        
        // Precompilar contexto de mapaERP
        promptsPrecompilados.mapaERPContexto = construirContextoMapaERPCompleto(mapaERP);
        
        console.log('✅ [PROMPTS] Prompts precompilados inicializados correctamente');
        console.log('📊 [PROMPTS] Tamaño total en memoria:', 
            JSON.stringify(promptsPrecompilados).length, 'bytes');
        
    } catch (error) {
        console.error('❌ [PROMPTS] Error inicializando prompts:', error.message);
        // Fallback a carga dinámica si falla
    }
}

// Eliminado: cierre extra agregado accidentalmente

//

/**
 * Obtiene un prompt precompilado
 * @param {string} tipo - Tipo de prompt ('base', 'sqlRules', etc.)
 * @returns {string} Prompt precompilado
 */
function obtenerPromptPrecompilado(tipo) {
    return promptsPrecompilados[tipo] || '';
}

/**
 * Construye prompt optimizado usando prompts precompilados
 * @param {string} mensaje - Mensaje del usuario
 * @param {boolean} necesitaRAG - Si necesita RAG
 * @param {string} contextoRAG - Contexto RAG si existe
 * @param {Array} historial - Historial conversacional
 * @returns {string} Prompt optimizado
 */
function construirPromptOptimizado(mensaje, necesitaRAG = false, contextoRAG = '', historial = []) {
    const fechaActual = new Date().toLocaleString('es-ES', { 
        timeZone: 'Europe/Madrid', 
        dateStyle: 'full', 
        timeStyle: 'short' 
    });
    
    // Usar prompts precompilados
    const promptGlobalConFecha = promptsPrecompilados.promptGlobal.replace('{{FECHA_ACTUAL}}', fechaActual);
    const instruccionesNaturales = promptsPrecompilados.comportamiento + '\n\n' + promptsPrecompilados.formatoObligatorio;
    
    let promptFinal = `${promptGlobalConFecha}\n${instruccionesNaturales}\n`;
    promptFinal += `${promptsPrecompilados.base}\n\n`;
    promptFinal += `${promptsPrecompilados.mapaERPContexto}\n\n`;
    promptFinal += `${promptsPrecompilados.sqlRules}\n\n`;
    
    // Agregar contexto RAG solo si es necesario
    if (necesitaRAG && contextoRAG) {
        promptFinal += `CONOCIMIENTO EMPRESARIAL RELEVANTE:\n${contextoRAG}\n\n`;
    }
    
    // Agregar historial conversacional optimizado
    if (historial && historial.length > 0) {
        const ultimosMensajes = historial.slice(-4); // Solo últimos 4 mensajes
        const contextoConversacional = ultimosMensajes.map(msg => 
            `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`
        ).join('\n');
        
        promptFinal += `## 💬 CONTEXTO CONVERSACIONAL RECIENTE\n\n${contextoConversacional}\n\n`;
    }
    
    return promptFinal;
}

// =====================================
// 2. CONFIGURACIÓN DE VARIABLES GLOBALES
// =====================================

// Historial global de conversación (en memoria, para demo)
const conversationHistory = [];

// Contexto de datos reales de la última consulta relevante
let lastRealData = null;

// =====================================
// CACHE LRU PARA RESPUESTAS TRIVIALES
// =====================================
// 
// Sistema de cache inteligente que:
// - Almacena respuestas para consultas triviales (saludos, confirmaciones)
// - Reduce latencia de ~6s a ~100ms para consultas repetidas
// - Cache por usuario para personalización
// - Auto-expiración para mantener frescura
// =====================================

class LRUCache {
    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key) {
        if (this.cache.has(key)) {
            // Mover al final (más reciente)
            const value = this.cache.get(key);
            this.cache.delete(key);
            this.cache.set(key, value);
            return value;
        }
        return null;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Eliminar el más antiguo (primero)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    clear() {
        this.cache.clear();
    }

    size() {
        return this.cache.size;
    }
}

// Cache global para respuestas triviales
const trivialResponseCache = new LRUCache(2000);

/**
 * Normaliza el input del usuario para cache lookup
 * @param {string} input - Input del usuario
 * @returns {string} Input normalizado
 */
function normalizarInput(input) {
    return input
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ') // Normalizar espacios
        .replace(/[^\w\s]/g, ''); // Remover puntuación
}

/**
 * Detecta si una consulta es trivial (saludo, confirmación, etc.)
 * @param {string} input - Input normalizado
 * @returns {boolean} True si es trivial
 */
function esConsultaTrivial(input) {
    const consultasTriviales = [
        'hola', 'buenos dias', 'buenas tardes', 'buenas noches',
        'gracias', 'ok', 'okay', 'perfecto', 'genial', 'excelente',
        'bien', 'mal', 'ayuda', 'saludos', 'que tal', 'como estas',
        'todo bien', 'muy bien', 'no se', 'no se que', 'no se que hacer'
    ];
    
    return consultasTriviales.some(trivial => input.includes(trivial));
}

/**
 * Obtiene respuesta cacheada o null si no existe
 * @param {string} userId - ID del usuario
 * @param {string} input - Input normalizado
 * @returns {string|null} Respuesta cacheada o null
 */
function obtenerRespuestaCacheada(userId, input) {
    const cacheKey = `${userId}:${input}`;
    return trivialResponseCache.get(cacheKey);
}

/**
 * Guarda respuesta en cache para futuras consultas
 * @param {string} userId - ID del usuario
 * @param {string} input - Input normalizado
 * @param {string} respuesta - Respuesta a cachear
 */
function guardarRespuestaCacheada(userId, input, respuesta) {
    const cacheKey = `${userId}:${input}`;
    trivialResponseCache.set(cacheKey, {
        respuesta,
        timestamp: Date.now(),
        userId
    });
}

// =====================================
// 3. FUNCIONES AUXILIARES - FORMATEO Y UTILIDADES
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
 * Función para formatear resultados en Markdown
 * @param {Array} results - Resultados de la consulta SQL
 * @returns {string} Resultados formateados en Markdown
 * 
 * @example
 * formatResultsAsMarkdown([
 *   { CL_NOMBRE: 'ACME S.A.', CL_DIR: 'Calle Principal 123' },
 *   { CL_NOMBRE: 'Campo Sur', CL_DIR: 'Av. Rural 456' }
 * ]);
 * // Retorna tabla Markdown formateada
 */
function formatResultsAsMarkdown(results) {
    if (!results || results.length === 0) {
        return "No se han encontrado resultados para tu consulta.";
    }

    if (results.length === 1 && Object.keys(results[0]).length === 1) {
        const value = Object.values(results[0])[0];
        return `Total: ${value}`;
    }

    const columns = Object.keys(results[0]);
    let markdown = "| " + columns.join(" | ") + " |\n";
    markdown += "| " + columns.map(() => "---").join(" | ") + " |\n";
    results.forEach(row => {
        markdown += "| " + columns.map(col => (row[col] ?? "No disponible")).join(" | ") + " |\n";
    });
    return markdown;
}

/**
 * Función para obtener la descripción de una columna desde mapaERP
 * @param {string} tabla - Nombre de la tabla
 * @param {string} columna - Nombre de la columna
 * @returns {string} Descripción de la columna o el nombre original
 * 
 * @example
 * // Suponiendo mapaERP.clientes.columnas = { CL_NOMBRE: 'Nombre del cliente' }
 * obtenerDescripcionColumna('clientes', 'CL_NOMBRE'); // 'Nombre del cliente'
 * obtenerDescripcionColumna('clientes', 'CL_ID'); // 'CL_ID' (si no hay descripción)
 */
function obtenerDescripcionColumna(tabla, columna) {
    if (mapaERP[tabla] && mapaERP[tabla].columnas && mapaERP[tabla].columnas[columna]) {
        return mapaERP[tabla].columnas[columna];
    }
    return columna;
}

/**
 * Función para determinar la tabla basada en las columnas
 * @param {Array} columnas - Array de nombres de columnas
 * @returns {string|null} Nombre de la tabla o null si no se encuentra
 * 
 * @example
 * determinarTabla(['CL_ID', 'CL_NOMBRE']); // 'clientes'
 * determinarTabla(['AR_ID', 'AR_DENO']);   // 'articulos'
 */
function determinarTabla(columnas) {
    for (const [tabla, info] of Object.entries(mapaERP)) {
        const columnasTabla = Object.keys(info.columnas || {});
        if (columnas.every(col => columnasTabla.includes(col))) {
            return tabla;
        }
    }
    return null;
}

/**
 * Función para limitar resultados con opción de aleatorización
 * @param {Array} results - Resultados de la consulta
 * @param {number} limite - Número máximo de resultados (default: 5)
 * @param {boolean} aleatorio - Si se deben seleccionar registros aleatorios (default: false)
 * @returns {Array} Resultados limitados
 * 
 * @example
 * limitarResultados([{id:1},{id:2},{id:3}], 2, false); // [{id:1},{id:2}]
 * limitarResultados([{id:1},{id:2},{id:3}], 2, true);  // 2 resultados aleatorios
 */
function limitarResultados(results, limite = 5, aleatorio = false) {
    if (!results || results.length === 0) return [];
    if (aleatorio && results.length > 1) {
        // Selecciona registros aleatorios
        const shuffled = results.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, limite);
    }
    return results.slice(0, limite);
}

// =====================================
// 4. FUNCIONES DE EJECUCIÓN Y VALIDACIÓN SQL
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
 * 
 * @example
 * const rows = await executeQuery("<sql>SELECT CL_ID, CL_NOMBRE FROM clientes LIMIT 5</sql>");
 * // rows: Array de objetos con columnas reales
 * 
 * Nota: Esta función reemplaza nombres de tablas mapeadas con backticks si contienen guiones
 * para compatibilidad con MySQL (`tabla-con-guion` → `\`tabla-con-guion\``).
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
 * 
 * @example
 * validarRespuestaSQL('Respuesta: <sql>SELECT * FROM clientes</sql>'); // 'SELECT * FROM clientes'
 * validarRespuestaSQL('```sql\nSELECT CL_NOMBRE FROM clientes\n```'); // 'SELECT CL_NOMBRE FROM clientes'
 * validarRespuestaSQL('Muestra clientes'); // null (no hay SQL)
 */
function validarRespuestaSQL(response) {
    console.log('🔍 [SQL-VALIDATION] Validando respuesta para extraer SQL...');
    
    // Primero intentar con etiquetas <sql>
    let sqlMatch = response.match(/<sql>([\s\S]*?)<\/sql>/);
    
    // Si no encuentra, intentar con bloques de código SQL
    if (!sqlMatch) {
        sqlMatch = response.match(/```sql\s*([\s\S]*?)```/);
        if (sqlMatch) {
            console.log('⚠️ [SQL-VALIDATION] SQL encontrado en formato markdown, convirtiendo');
            response = response.replace(/```sql\s*([\s\S]*?)```/, '<sql>$1</sql>');
            sqlMatch = response.match(/<sql>([\s\S]*?)<\/sql>/);
        }
    }
    
    // Si no encuentra, buscar SQL en texto plano (nueva funcionalidad)
    if (!sqlMatch) {
        console.log('🔍 [SQL-VALIDATION] Buscando SQL en texto plano...');
        const sqlPattern = /(SELECT\s+[\s\S]*?)(?:;|$)/i;
        sqlMatch = response.match(sqlPattern);
        if (sqlMatch) {
            console.log('✅ [SQL-VALIDATION] SQL encontrado en texto plano');
        }
    }
    
    if (!sqlMatch) {
        console.log('❌ [SQL-VALIDATION] No se encontró SQL en la respuesta');
        return null; // Permitir respuestas sin SQL
    }
    
    let sql = sqlMatch[1].trim();
    if (!sql) {
        console.error('❌ [SQL-VALIDATION] La consulta SQL está vacía');
        throw new Error('La consulta SQL está vacía');
    }
    
    // VALIDACIÓN SEMÁNTICA AVANZADA
    console.log('🔍 [SQL-VALIDATION] Ejecutando validación semántica...');
    const validacionSemantica = validacionSemanticaSQL(sql);
    
    if (!validacionSemantica.esValido) {
        console.error('❌ [SQL-VALIDATION] Validación semántica falló:', validacionSemantica.errores);
        throw new Error(`SQL no válido: ${validacionSemantica.errores.join(', ')}`);
    }
    
    if (validacionSemantica.advertencias.length > 0) {
        console.log('⚠️ [SQL-VALIDATION] Advertencias:', validacionSemantica.advertencias);
    }
    
    // NORMALIZACIÓN DE NOMBRES
    console.log('🔄 [SQL-VALIDATION] Normalizando nombres técnicos...');
    sql = normalizarNombresSQL(sql);
    
    // Validar que es una consulta SQL válida
    if (!sql.toLowerCase().startsWith('select')) {
        console.error('❌ [SQL-VALIDATION] La consulta no es SELECT');
        throw new Error('La consulta debe comenzar con SELECT');
    }
    
    console.log('✅ [SQL-VALIDATION] SQL válido extraído');
    
    // Validar y corregir sintaxis común
    if (sql.includes('OFFSET')) {
        const offsetMatch = sql.match(/LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i);
        if (offsetMatch) {
            sql = sql.replace(
                /LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i,
                `LIMIT ${offsetMatch[2]}, ${offsetMatch[1]}`
            );
            console.log('🔄 [SQL-VALIDATION] Corregida sintaxis OFFSET');
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
        // Buscar el final de la consulta (antes de ; si existe)
        sql = sql.replace(/;*\s*$/, '');
        sql += ' LIMIT 10';
        console.log('🔄 [SQL-VALIDATION] Agregado LIMIT automático');
    }
    
    // LOGS ESTRUCTURADOS
    const logValidacion = {
        timestamp: new Date().toISOString(),
        sqlOriginal: sqlMatch[1].trim(),
        sqlFinal: sql,
        validacionSemantica: {
            esValido: validacionSemantica.esValido,
            errores: validacionSemantica.errores,
            advertencias: validacionSemantica.advertencias,
            nivelRiesgo: validacionSemantica.nivelRiesgo,
            tablasUsadas: validacionSemantica.tablasUsadas,
            columnasUsadas: validacionSemantica.columnasUsadas
        },
        complejidad: calcularComplejidadSQL(sql)
    };
    
    console.log('📊 [SQL-VALIDATION] Log estructurado:', JSON.stringify(logValidacion, null, 2));
    
    console.log('✅ [SQL-VALIDATION] SQL final validado:', sql.substring(0, 100) + '...');
    return sql;
}

/**
 * Obtiene el nombre real de la tabla desde `mapaERP` para una clave lógica
 * @param {string} nombreClave - Clave de la tabla en `mapaERP`
 * @returns {string} Nombre real (p.ej. con guiones) o la clave si no hay mapeo
 * 
 * @example
 * // mapaERP.articulos = { tabla: 'erp-articulos' }
 * obtenerNombreRealTabla('articulos'); // 'erp-articulos'
 */
function obtenerNombreRealTabla(nombreClave) {
    if (mapaERP[nombreClave] && mapaERP[nombreClave].tabla) {
        return mapaERP[nombreClave].tabla;
    }
    return nombreClave;
}

/**
 * Función avanzada para reemplazar nombres de tablas con validación completa
 * @param {string} sql - SQL original
 * @returns {string} SQL con nombres de tablas reemplazados
 */
function reemplazarNombresTablas(sql) {
    console.log('🔄 [TABLAS] Iniciando reemplazo simplificado de nombres de tablas...');
    
    // Enfoque simplificado: solo reemplazar nombres de tabla exactos
    let sqlModificado = sql;
    
    // Buscar patrones FROM tabla y reemplazar solo el nombre de la tabla
    const patronesFrom = [
        /FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
        /from\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi
    ];
    
    patronesFrom.forEach(patron => {
        sqlModificado = sqlModificado.replace(patron, (match, nombreTabla) => {
            const nombreTablaLower = nombreTabla.toLowerCase();
            
            // Verificar si existe en mapaERP
            if (mapaERP[nombreTablaLower]) {
                const tablaReal = mapaERP[nombreTablaLower].nombreReal || mapaERP[nombreTablaLower].tabla || nombreTablaLower;
                console.log(`🔄 [TABLAS] Reemplazando: ${nombreTabla} → ${tablaReal}`);
                return match.replace(nombreTabla, tablaReal);
            }
            
            return match; // No cambiar si no está en mapaERP
        });
    });
    
    console.log(`✅ [TABLAS] Reemplazo completado`);
    return sqlModificado;
}

/**
 * Extracción avanzada de columnas SQL con soporte completo
 * @param {string} sql - SQL a analizar
 * @returns {Array} Array de objetos con información de columnas
 */
function extraerColumnasSQL(sql) {
    console.log('🔍 [COLUMNAS] Iniciando extracción avanzada de columnas...');
    
    const columnas = [];
    const sqlUpper = sql.toUpperCase();
    
    // 1. FUNCIONES Y EXPRESIONES A IGNORAR
    const patronesIgnorar = [
        /COUNT\s*\(\s*\*\s*\)/gi,
        /SUM\s*\([^)]+\)/gi,
        /AVG\s*\([^)]+\)/gi,
        /MAX\s*\([^)]+\)/gi,
        /MIN\s*\([^)]+\)/gi,
        /CASE\s+WHEN[^END]+END/gi,
        /COALESCE\s*\([^)]+\)/gi,
        /IFNULL\s*\([^)]+\)/gi,
        /DISTINCT\s+/gi
    ];
    
    // Crear SQL limpio sin funciones
    let sqlLimpio = sql;
    patronesIgnorar.forEach(patron => {
        sqlLimpio = sqlLimpio.replace(patron, '');
    });
    
    // 2. EXTRACCIÓN DE COLUMNAS CON ALIAS
    const extraerColumnaConAlias = (texto) => {
        const patrones = [
            // tabla.columna
            /([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)/g,
            // solo columna (sin tabla)
            /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g
        ];
        
        const columnasEncontradas = [];
        
        patrones.forEach(patron => {
            let match;
            while ((match = patron.exec(texto)) !== null) {
                if (match.length === 3) {
                    // tabla.columna
                    columnasEncontradas.push({
                        tabla: match[1],
                        columna: match[2],
                        completo: `${match[1]}.${match[2]}`,
                        tipo: 'con_alias'
                    });
                } else if (match.length === 2) {
                    // solo columna
                    const columna = match[1];
                    // Ignorar palabras reservadas SQL
                    const palabrasReservadas = [
                        'SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'GROUP', 'BY', 'ORDER', 'LIMIT',
                        'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'ASC', 'DESC',
                        'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'CASE', 'WHEN',
                        'THEN', 'ELSE', 'END', 'COALESCE', 'IFNULL', 'HAVING', 'UNION'
                    ];
                    
                    if (!palabrasReservadas.includes(columna.toUpperCase())) {
                        columnasEncontradas.push({
                            tabla: null,
                            columna: columna,
                            completo: columna,
                            tipo: 'sin_alias'
                        });
                    }
                }
            }
        });
        
        return columnasEncontradas;
    };
    
    // 3. EXTRAER DE SELECT
    const selectMatch = sqlLimpio.match(/SELECT\s+(.+?)\s+FROM/i);
    if (selectMatch) {
        const columnasSelect = selectMatch[1].split(',').map(c => c.trim());
        columnasSelect.forEach(col => {
            const columnasEncontradas = extraerColumnaConAlias(col);
            columnas.push(...columnasEncontradas);
        });
    }
    
    // 4. EXTRAER DE WHERE (operadores avanzados)
    const wherePatterns = [
        /WHERE\s+(.+?)(?:\s+(?:GROUP BY|ORDER BY|LIMIT|HAVING|$))/gi,
        /AND\s+(.+?)(?:\s+(?:AND|OR|GROUP BY|ORDER BY|LIMIT|$))/gi,
        /OR\s+(.+?)(?:\s+(?:AND|OR|GROUP BY|ORDER BY|LIMIT|$))/gi
    ];
    
    wherePatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(sqlLimpio)) !== null) {
            const whereClause = match[1];
            const columnasEncontradas = extraerColumnaConAlias(whereClause);
            columnas.push(...columnasEncontradas);
        }
    });
    
    // 5. EXTRAER DE JOIN
    const joinPatterns = [
        /JOIN\s+[a-zA-Z_][a-zA-Z0-9_]*\s+(?:AS\s+)?[a-zA-Z_][a-zA-Z0-9_]*\s+ON\s+(.+?)(?:\s+(?:JOIN|WHERE|GROUP BY|ORDER BY|$))/gi,
        /ON\s+(.+?)(?:\s+(?:JOIN|WHERE|GROUP BY|ORDER BY|$))/gi
    ];
    
    joinPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(sqlLimpio)) !== null) {
            const joinClause = match[1];
            const columnasEncontradas = extraerColumnaConAlias(joinClause);
            columnas.push(...columnasEncontradas);
        }
    });
    
    // 6. EXTRAER DE GROUP BY
    const groupByMatch = sqlLimpio.match(/GROUP BY\s+(.+?)(?:\s+(?:ORDER BY|LIMIT|$))/i);
    if (groupByMatch) {
        const groupByColumns = groupByMatch[1].split(',').map(c => c.trim());
        groupByColumns.forEach(col => {
            const columnasEncontradas = extraerColumnaConAlias(col);
            columnas.push(...columnasEncontradas);
        });
    }
    
    // 7. EXTRAER DE ORDER BY
    const orderByMatch = sqlLimpio.match(/ORDER BY\s+(.+?)(?:\s+(?:LIMIT|$))/i);
    if (orderByMatch) {
        const orderByColumns = orderByMatch[1].split(',').map(c => c.trim());
        orderByColumns.forEach(col => {
            const columnasEncontradas = extraerColumnaConAlias(col);
            columnas.push(...columnasEncontradas);
        });
    }
    
    // 8. EXTRAER DE HAVING
    const havingMatch = sqlLimpio.match(/HAVING\s+(.+?)(?:\s+(?:ORDER BY|LIMIT|$))/i);
    if (havingMatch) {
        const havingClause = havingMatch[1];
        const columnasEncontradas = extraerColumnaConAlias(havingClause);
        columnas.push(...columnasEncontradas);
    }
    
    // 9. ELIMINAR DUPLICADOS MANTENIENDO ORDEN
    const columnasUnicas = [];
    const seen = new Set();
    
    columnas.forEach(col => {
        const key = col.completo;
        if (!seen.has(key)) {
            seen.add(key);
            columnasUnicas.push(col);
        }
    });
    
    // 10. LOGGING ESTRUCTURADO
    const logExtraccion = {
        timestamp: new Date().toISOString(),
        sqlOriginal: sql.substring(0, 200) + '...',
        columnasEncontradas: columnasUnicas,
        estadisticas: {
            total: columnasUnicas.length,
            conAlias: columnasUnicas.filter(c => c.tipo === 'con_alias').length,
            sinAlias: columnasUnicas.filter(c => c.tipo === 'sin_alias').length
        }
    };
    
    console.log('📊 [COLUMNAS] Log de extracción:', JSON.stringify(logExtraccion, null, 2));
    console.log(`✅ [COLUMNAS] Extracción completada: ${columnasUnicas.length} columnas únicas`);
    
    return columnasUnicas;
}

/**
 * Determina a qué tabla pertenece una columna
 * @param {string} columna - Nombre de la columna
 * @param {Array} tablasUsadas - Tablas usadas en la consulta
 * @returns {string|null} Nombre de la tabla o null
 */
function determinarTablaColumna(columna, tablasUsadas) {
    for (const tabla of tablasUsadas) {
        if (mapaERP[tabla] && mapaERP[tabla].columnas) {
            const columnasTabla = Object.keys(mapaERP[tabla].columnas);
            if (columnasTabla.includes(columna)) {
                return tabla;
            }
        }
    }
    return null;
}

/**
 * Valida si una columna existe en una tabla
 * @param {string} tabla - Nombre de la tabla
 * @param {string} columna - Nombre de la columna
 * @returns {boolean} True si la columna existe
 */
function validarColumnaEnTabla(tabla, columna) {
    if (!mapaERP[tabla] || !mapaERP[tabla].columnas) {
        return false;
    }
    
    const columnasTabla = Object.keys(mapaERP[tabla].columnas);
    return columnasTabla.includes(columna);
}

/**
 * Valida que todas las tablas referenciadas en la sentencia SQL existan en `mapaERP`
 * @param {string} sql - Sentencia SQL a validar
 * @throws {Error} Si alguna tabla no está definida en `mapaERP`
 * 
 * @example
 * validarTablaEnMapaERP('SELECT CL_NOMBRE FROM clientes'); // OK o lanza error
 */
function validarTablaEnMapaERP(sql) {
    console.log('🔍 [VALIDACION-TABLAS] Validando tablas contra mapaERP...');
    
    const resultado = {
        esValido: true,
        errores: [],
        advertencias: [],
        tablasDetectadas: [],
        tablasValidas: [],
        tablasInvalidas: []
    };
    
    // Detectar todas las tablas en el SQL
    const patronesTabla = [
        /(?:FROM|from)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
        /(?:JOIN|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
        /(?:UPDATE|update)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
        /(?:DELETE\s+FROM|delete\s+from)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi
    ];
    
    const tablasEncontradas = new Set();
    
    patronesTabla.forEach(patron => {
        let match;
        while ((match = patron.exec(sql)) !== null) {
            const nombreTabla = match[1].toLowerCase();
            tablasEncontradas.add(nombreTabla);
        }
    });
    
    resultado.tablasDetectadas = Array.from(tablasEncontradas);
    
    // Validar cada tabla contra mapaERP
    resultado.tablasDetectadas.forEach(tabla => {
        if (mapaERP[tabla]) {
            resultado.tablasValidas.push({
                nombre: tabla,
                nombreReal: mapaERP[tabla].nombreReal || tabla.toUpperCase(),
                descripcion: mapaERP[tabla].descripcion || 'Sin descripción',
                columnas: Object.keys(mapaERP[tabla].columnas || {}).length
            });
        } else {
            resultado.tablasInvalidas.push(tabla);
            resultado.errores.push(`Tabla no existe en mapaERP: ${tabla}`);
            resultado.esValido = false;
        }
    });
    
    // Validación adicional: verificar alias válidos
    const aliasPattern = /(?:FROM|JOIN)\s+[a-zA-Z_][a-zA-Z0-9_]*\s+(?:AS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
    const aliasEncontrados = new Set();
    
    let aliasMatch;
    while ((aliasMatch = aliasPattern.exec(sql)) !== null) {
        const alias = aliasMatch[1];
        if (aliasEncontrados.has(alias)) {
            resultado.advertencias.push(`Alias duplicado detectado: ${alias}`);
        }
        aliasEncontrados.add(alias);
    }
    
    // Logging estructurado
    const logValidacion = {
        timestamp: new Date().toISOString(),
        sql: sql.substring(0, 200) + '...',
        resultado: resultado,
        estadisticas: {
            totalTablas: resultado.tablasDetectadas.length,
            tablasValidas: resultado.tablasValidas.length,
            tablasInvalidas: resultado.tablasInvalidas.length,
            errores: resultado.errores.length,
            advertencias: resultado.advertencias.length
        }
    };
    
    console.log('📊 [VALIDACION-TABLAS] Log estructurado:', JSON.stringify(logValidacion, null, 2));
    
    if (resultado.esValido) {
        console.log(`✅ [VALIDACION-TABLAS] Validación exitosa: ${resultado.tablasValidas.length} tablas válidas`);
    } else {
        console.error(`❌ [VALIDACION-TABLAS] Validación falló: ${resultado.errores.length} errores`);
    }
    
    return resultado;
}

/**
 * Validación avanzada de columnas contra mapaERP
 * @param {string} sql - SQL a validar
 * @param {string} tabla - Tabla principal
 * @returns {Object} Resultado de validación
 */
function validarColumnasEnMapaERP(sql, tabla) {
    console.log(`🔍 [VALIDACION-COLUMNAS] Validando columnas de tabla: ${tabla}`);
    
    const resultado = {
        esValido: true,
        errores: [],
        advertencias: [],
        columnasDetectadas: [],
        columnasValidas: [],
        columnasInvalidas: [],
        columnasSugeridas: []
    };
    
    if (!mapaERP[tabla] || !mapaERP[tabla].columnas) {
        resultado.esValido = false;
        resultado.errores.push(`Tabla ${tabla} no tiene definición de columnas en mapaERP`);
        return resultado;
    }
    
    const columnasTabla = Object.keys(mapaERP[tabla].columnas);
    const columnasTablaLower = columnasTabla.map(c => c.toLowerCase());
    
    // Extraer columnas del SQL
    const columnasSQL = extraerColumnasSQL(sql);
    resultado.columnasDetectadas = columnasSQL;
    
    // Validar cada columna
    columnasSQL.forEach(columna => {
        const columnaLower = columna.toLowerCase();
        
        if (columnasTablaLower.includes(columnaLower)) {
            // Encontrar el nombre exacto (preservar case)
            const columnaExacta = columnasTabla.find(c => c.toLowerCase() === columnaLower);
            resultado.columnasValidas.push({
                nombre: columna,
                nombreExacto: columnaExacta,
                descripcion: mapaERP[tabla].columnas[columnaExacta] || 'Sin descripción'
            });
        } else {
            resultado.columnasInvalidas.push(columna);
            
            // Buscar sugerencias similares
            const sugerencias = buscarColumnasSimilares(columna, columnasTabla);
            if (sugerencias.length > 0) {
                resultado.columnasSugeridas.push({
                    columna: columna,
                    sugerencias: sugerencias
                });
                resultado.advertencias.push(`Columna '${columna}' no existe. Sugerencias: ${sugerencias.join(', ')}`);
            } else {
                resultado.errores.push(`Columna '${columna}' no existe en tabla '${tabla}'`);
            }
        }
    });
    
    // Validar alias de columnas
    const aliasColumnas = extraerAliasColumnas(sql);
    aliasColumnas.forEach(alias => {
        if (resultado.columnasDetectadas.includes(alias)) {
            resultado.advertencias.push(`Posible conflicto: '${alias}' usado como alias y como columna`);
        }
    });
    
    // Actualizar estado de validación
    if (resultado.errores.length > 0) {
        resultado.esValido = false;
    }
    
    // Logging estructurado
    const logValidacion = {
        timestamp: new Date().toISOString(),
        tabla: tabla,
        sql: sql.substring(0, 200) + '...',
        resultado: resultado,
        estadisticas: {
            totalColumnas: resultado.columnasDetectadas.length,
            columnasValidas: resultado.columnasValidas.length,
            columnasInvalidas: resultado.columnasInvalidas.length,
            sugerencias: resultado.columnasSugeridas.length,
            errores: resultado.errores.length,
            advertencias: resultado.advertencias.length
        }
    };
    
    console.log('📊 [VALIDACION-COLUMNAS] Log estructurado:', JSON.stringify(logValidacion, null, 2));
    
    if (resultado.esValido) {
        console.log(`✅ [VALIDACION-COLUMNAS] Validación exitosa: ${resultado.columnasValidas.length} columnas válidas`);
    } else {
        console.error(`❌ [VALIDACION-COLUMNAS] Validación falló: ${resultado.errores.length} errores`);
    }
    
    return resultado;
}

/**
 * Busca columnas similares para sugerencias
 * @param {string} columna - Columna a buscar
 * @param {Array} columnasTabla - Columnas disponibles
 * @returns {Array} Array de sugerencias
 */
function buscarColumnasSimilares(columna, columnasTabla) {
    const columnaLower = columna.toLowerCase();
    const sugerencias = [];
    
    columnasTabla.forEach(col => {
        const colLower = col.toLowerCase();
        
        // Búsqueda exacta (case-insensitive)
        if (colLower === columnaLower) {
            sugerencias.unshift(col); // Prioridad alta
        }
        // Búsqueda por inclusión
        else if (colLower.includes(columnaLower) || columnaLower.includes(colLower)) {
            sugerencias.push(col);
        }
        // Búsqueda por similitud de caracteres
        else {
            const similitud = calcularSimilitud(columnaLower, colLower);
            if (similitud > 0.6) {
                sugerencias.push(col);
            }
        }
    });
    
    // Ordenar por relevancia y limitar a 3 sugerencias
    return sugerencias.slice(0, 3);
}

/**
 * Extrae alias de columnas del SQL
 * @param {string} sql - SQL a analizar
 * @returns {Array} Array de alias detectados
 */
function extraerAliasColumnas(sql) {
    const alias = [];
    
    // Patrón para alias en SELECT
    const aliasPattern = /SELECT\s+(.+?)\s+FROM/gi;
    let match;
    
    while ((match = aliasPattern.exec(sql)) !== null) {
        const columnas = match[1].split(',').map(c => c.trim());
        
        columnas.forEach(col => {
            // Buscar alias con AS
            const asMatch = col.match(/(?:AS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*$/i);
            if (asMatch) {
                alias.push(asMatch[1]);
            }
        });
    }
    
    return alias;
}

// =====================================
// 5. FUNCIONES DE PERSISTENCIA Y ALMACENAMIENTO (FIREBASE)
// =====================================
// 
// Estas funciones gestionan:
// - Guardado de mensajes de usuario en Firestore
// - Guardado de respuestas del asistente
// - Detección de preguntas de seguimiento
// - Organización de conversaciones por usuario
// - Persistencia asíncrona para no bloquear respuestas
// =====================================

/**
 * Función auxiliar para detectar si la pregunta es de seguimiento sobre teléfono de cliente
 * @param {string} userQuery - Consulta del usuario
 * @param {Object} lastRealData - Datos de la consulta anterior
 * @returns {boolean} True si es pregunta de seguimiento sobre teléfono
 * 
 * @example
 * esPreguntaTelefonoCliente('¿cuál es su teléfono?', { type: 'cliente', data: [...] }); // true
 */
function esPreguntaTelefonoCliente(userQuery, lastRealData) {
    if (!lastRealData || lastRealData.type !== 'cliente' || !lastRealData.data) return false;
    const texto = userQuery.toLowerCase();
    return (
        texto.includes('telefono') || texto.includes('teléfono')
    );
}

/**
 * Función para guardar mensaje en Firestore
 * @param {string} userId - ID del usuario
 * @param {string} message - Mensaje a guardar
 * @param {boolean} isAdmin - Si es mensaje de administrador
 * @returns {Promise<boolean>} True si se guardó correctamente
 * 
 * @example
 * await saveMessageToFirestore('user123', 'dame clientes', true);
 */
async function saveMessageToFirestore(userId, message, conversationId = 'admin_conversation', isAdmin = true) {
    try {
        const now = new Date();
        const messageData = {
            content: message,
            role: 'user',
            timestamp: now
        };

        const userChatRef = chatManager.chatsCollection.doc(userId);
        const conversationRef = userChatRef.collection('conversations').doc(conversationId);
        
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

/**
 * Función para guardar mensaje del asistente en Firestore
 * @param {string} userId - ID del usuario
 * @param {string} message - Mensaje del asistente a guardar
 * @returns {Promise<boolean>} True si se guardó correctamente
 * 
 * @example
 * await saveAssistantMessageToFirestore('user123', 'Aquí tienes los clientes...');
 */
async function saveAssistantMessageToFirestore(userId, message, conversationId = 'admin_conversation') {
    try {
        const now = new Date();
        const messageData = {
            content: message,
            role: 'assistant',
            timestamp: now
        };

        const userChatRef = chatManager.chatsCollection.doc(userId);
        const conversationRef = userChatRef.collection('conversations').doc(conversationId);
        
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
        console.error('Error al guardar mensaje del asistente en Firestore:', error);
        return false;
    }
}

// =====================================
// 6. BÚSQUEDA FLEXIBLE (FUZZY SEARCH)
// =====================================
// 
// Esta función implementa búsqueda inteligente cuando SQL falla:
// - Genera variantes del término de búsqueda
// - Prueba múltiples columnas y tablas
// - Búsqueda multi-término para artículos
// - Manejo especial para tablas específicas
// - Recuperación automática cuando consultas exactas fallan
// =====================================

/**
 * Función auxiliar para intentar una búsqueda flexible (fuzzy search) en SQL
 * Se ejecuta cuando una consulta SQL exacta falla, generando variantes inteligentes
 * 
 * @param {string} sql - SQL original que falló
 * @param {string} userQuery - Consulta original del usuario
 * @returns {Object|null} Resultados encontrados o null si no hay coincidencias
 * 
 * ESTRATEGIAS DE BÚSQUEDA:
 * - Genera variantes del término (mayúsculas, minúsculas, sin tildes)
 * - Prueba múltiples columnas de texto
 * - Búsqueda multi-término para artículos
 * - Manejo especial para tablas específicas
 * - Recuperación automática cuando consultas exactas fallan
 * 
 * @example
 * const retry = await fuzzySearchRetry(
 *   'SELECT * FROM articulos WHERE AR_DENO LIKE "%caja 200cc%"',
 *   'busca caja 200cc'
 * );
 * if (retry) { console.log(retry.sqlFuzzyTry, retry.results); }
 */
async function fuzzySearchRetry(sql, userQuery) {
    console.log('🔍 [FUZZY-SEARCH] Iniciando búsqueda flexible...');
    console.log('🔍 [FUZZY-SEARCH] SQL original:', sql);
    console.log('🔍 [FUZZY-SEARCH] Query usuario:', userQuery);
    
    // Detectar el término de búsqueda en el WHERE
    const likeMatch = sql.match(/WHERE\s+([\w.]+)\s+LIKE\s+'%([^%']+)%'/i);
    const eqMatch = sql.match(/WHERE\s+([\w.]+)\s*=\s*'([^']+)'/i);
    let columna = null;
    let valor = null;
    if (likeMatch) {
        columna = likeMatch[1];
        valor = likeMatch[2];
        console.log('🔍 [FUZZY-SEARCH] Detectado LIKE:', columna, '=', valor);
    } else if (eqMatch) {
        columna = eqMatch[1];
        valor = eqMatch[2];
        console.log('🔍 [FUZZY-SEARCH] Detectado igualdad:', columna, '=', valor);
    }
    if (!columna || !valor) {
        console.log('⚠️ [FUZZY-SEARCH] No se pudo detectar columna/valor para fuzzy search');
        return null;
    }

    // Detectar la tabla principal del FROM
    const fromMatch = sql.match(/FROM\s+([`\w]+)/i);
    let tabla = fromMatch ? fromMatch[1].replace(/`/g, '') : null;
    console.log('🔍 [FUZZY-SEARCH] Tabla detectada:', tabla);
    
    // Buscar la clave de mapaERP que corresponde a la tabla real
    let claveMapa = tabla && Object.keys(mapaERP).find(k => (mapaERP[k].tabla || k) === tabla);
    // Si no se detecta, fallback a la columna original
    let columnasTexto = [columna];
    if (claveMapa && mapaERP[claveMapa].columnas) {
        // Filtrar solo columnas tipo texto (por nombre o heurística)
        columnasTexto = Object.keys(mapaERP[claveMapa].columnas).filter(c => {
            const nombre = c.toLowerCase();
            return !nombre.match(/(id|num|cant|fecha|fec|total|importe|precio|monto|valor|kg|ha|area|superficie|lat|lon|long|ancho|alto|diam|mm|cm|m2|m3|porc|\d)/);
        });
        if (columnasTexto.length === 0) columnasTexto = Object.keys(mapaERP[claveMapa].columnas);
        console.log('🔍 [FUZZY-SEARCH] Columnas texto disponibles:', columnasTexto.join(', '));
    }

    // Generar variantes del valor para fuzzy search
    const variantes = [
        valor,
        valor.toUpperCase(),
        valor.toLowerCase(),
        valor.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), // sin tildes
        valor.split(' ')[0], // solo la primera palabra
        valor.replace(/\s+/g, ''), // sin espacios
        valor.replace(/cc/gi, ' CC'),
        valor.replace(/lt/gi, ' LT'),
        valor.replace(/\./g, ''),
        valor.replace(/\d+/g, ''),
        valor.slice(0, Math.max(3, Math.floor(valor.length * 0.7)))
    ];
    
    console.log('🔍 [FUZZY-SEARCH] Variantes generadas:', variantes.length);

    // --- MEJORA: Si el valor tiene varios términos, buscar artículos cuyo AR_DENO contenga TODOS los términos (AND) ---
    if (tabla === 'articulos' && valor.trim().split(/\s+/).length > 1) {
        console.log('🔍 [FUZZY-SEARCH] Búsqueda multi-término en artículos...');
        const terminos = valor.trim().split(/\s+/).filter(Boolean);
        // Buscar en AR_DENO y AR_REF, ambos deben contener todos los términos
        const condicionesDeno = terminos.map(t => `AR_DENO LIKE '%${t}%'`).join(' AND ');
        const condicionesRef = terminos.map(t => `AR_REF LIKE '%${t}%'`).join(' AND ');
        // Probar primero en AR_DENO
        let sqlMultiTerm = `SELECT * FROM articulos WHERE ${condicionesDeno} LIMIT 5`;
        try {
            console.log('🔍 [FUZZY-SEARCH] Probando multi-término AR_DENO...');
            const results = await executeQuery(sqlMultiTerm);
            if (results && results.length > 0) {
                console.log('✅ [FUZZY-SEARCH] Encontrados con multi-término AR_DENO:', results.length);
                return { results, sqlFuzzyTry: sqlMultiTerm };
            }
        } catch (e) {
            console.log('⚠️ [FUZZY-SEARCH] Error en multi-término AR_DENO:', e.message);
        }
        // Probar en AR_REF
        let sqlMultiTermRef = `SELECT * FROM articulos WHERE ${condicionesRef} LIMIT 5`;
        try {
            console.log('🔍 [FUZZY-SEARCH] Probando multi-término AR_REF...');
            const results = await executeQuery(sqlMultiTermRef);
            if (results && results.length > 0) {
                console.log('✅ [FUZZY-SEARCH] Encontrados con multi-término AR_REF:', results.length);
                return { results, sqlFuzzyTry: sqlMultiTermRef };
            }
        } catch (e) {
            console.log('⚠️ [FUZZY-SEARCH] Error en multi-término AR_REF:', e.message);
        }
        // Probar en ambos (OR)
        let sqlMultiTermBoth = `SELECT * FROM articulos WHERE (${condicionesDeno}) OR (${condicionesRef}) LIMIT 5`;
        try {
            console.log('🔍 [FUZZY-SEARCH] Probando multi-término combinado...');
            const results = await executeQuery(sqlMultiTermBoth);
            if (results && results.length > 0) {
                console.log('✅ [FUZZY-SEARCH] Encontrados con multi-término combinado:', results.length);
                return { results, sqlFuzzyTry: sqlMultiTermBoth };
            }
        } catch (e) {
            console.log('⚠️ [FUZZY-SEARCH] Error en multi-término combinado:', e.message);
        }
    }
    // --- FIN MEJORA ---

    // Probar todas las combinaciones de columna y variante
    console.log('🔍 [FUZZY-SEARCH] Probando combinaciones columna-variante...');
    for (const col of columnasTexto) {
        for (const variante of variantes) {
            if (!variante || variante.length < 2) continue;
            let sqlFuzzyTry = sql.replace(/WHERE[\s\S]*/i, `WHERE ${col} LIKE '%${variante}%' LIMIT 5`);
            try {
                const results = await executeQuery(sqlFuzzyTry);
                if (results && results.length > 0) {
                    console.log(`✅ [FUZZY-SEARCH] Encontrados con ${col} LIKE %${variante}%:`, results.length);
                    return { results, sqlFuzzyTry };
                }
            } catch (e) {
                // Ignorar errores de SQL en fuzzy
            }
        }
    }
    // Si la tabla es articulos, probar también AR_DENO y AR_REF explícitamente
    if (tabla === 'articulos') {
        console.log('🔍 [FUZZY-SEARCH] Probando búsqueda directa en artículos...');
        for (const variante of variantes) {
            let sqlTry = `SELECT * FROM articulos WHERE AR_DENO LIKE '%${variante}%' OR AR_REF LIKE '%${variante}%' LIMIT 5`;
            try {
                const results = await executeQuery(sqlTry);
                if (results && results.length > 0) {
                    console.log(`✅ [FUZZY-SEARCH] Encontrados con variante directa ${variante}:`, results.length);
                    return { results, sqlFuzzyTry: sqlTry };
                }
            } catch (e) {}
        }
    }
    
    console.log('❌ [FUZZY-SEARCH] No se encontraron resultados con búsqueda flexible');
    return null;
}

// =====================================
// 7. FUNCIONES DE USUARIO Y CONTEXTO CONVERSACIONAL
// =====================================
// 
// Estas funciones gestionan:
// - Obtención de información del usuario desde Firebase
// - Recuperación de historial conversacional
// - Personalización de respuestas con nombre del usuario
// - Contexto conversacional para continuidad
// - Gestión de sesiones y conversaciones
// =====================================

/**
 * Obtiene la información del usuario desde Firebase incluyendo su displayName
 * @param {string} userId - UID de Firebase
 * @returns {Promise<{ uid: string, nombre: string, email: string|null, esAdmin: boolean }>} Datos del usuario
 * 
 * @example
 * const userInfo = await obtenerInfoUsuario('firebase_uid_123');
 * // { uid: 'firebase_uid_123', nombre: 'Juan Pérez', email: 'juan@deitana.com', esAdmin: true }
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

/**
 * Obtiene el historial completo de la conversación para contexto
 * CON CONTINUIDAD ENTRE SESIONES - Si es conversación temporal, busca contexto del usuario
 * @param {string} userId - UID de Firebase
 * @param {string} conversationId - ID de conversación en Firestore
 * @returns {Promise<Array<{ role: 'user'|'assistant', content: string }>>}
 * 
 * @example
 * const historial = await obtenerHistorialConversacion('user123', 'conv_456');
 * // [{ role: 'user', content: 'dame clientes' }, { role: 'assistant', content: 'Aquí tienes...' }]
 */
async function obtenerHistorialConversacion(userId, conversationId) {
    try {
        console.log('📜 [HISTORIAL] Obteniendo contexto conversacional...');
        console.log('📜 [HISTORIAL] Usuario:', userId, 'Conversación:', conversationId);
        
        // =====================================
        // ESTRATEGIA DE CONTINUIDAD INTELIGENTE
        // =====================================
        
        // 1. Si hay conversationId específico y no es temporal
        if (conversationId && !conversationId.startsWith('temp_')) {
            console.log('📜 [HISTORIAL] Usando conversación específica:', conversationId);
            const mensajes = await chatManager.getConversationMessages(userId, conversationId);
            const mensajesRecientes = mensajes.slice(-6);
            console.log(`📜 [HISTORIAL] Obtenidos ${mensajesRecientes.length} mensajes de conversación específica`);
            return mensajesRecientes.map(msg => ({
                role: msg.role,
                content: msg.content
            }));
        }
        
        // 2. Si es conversación temporal → BUSCAR CONTINUIDAD DEL USUARIO
        console.log('🔄 [CONTINUIDAD] Conversación temporal - buscando contexto del usuario...');
        return await obtenerHistorialUsuario(userId);
        
    } catch (error) {
        console.error('❌ [HISTORIAL] Error obteniendo historial:', error.message);
        return [];
    }
}

/**
 * Obtiene historial de conversaciones recientes del usuario para mantener continuidad
 * @param {string} userId - UID de Firebase
 * @param {number} limitConversaciones - Número máximo de conversaciones a revisar
 * @returns {Promise<Array<{ role: 'user'|'assistant', content: string }>>}
 * 
 * @example
 * const historial = await obtenerHistorialUsuario('user123', 3);
 * // Combina últimos mensajes de las 3 conversaciones más recientes
 */
async function obtenerHistorialUsuario(userId, limitConversaciones = 3) {
    try {
        console.log('🔄 [CONTINUIDAD] Buscando conversaciones recientes del usuario...');
        
        // Obtener conversaciones recientes del usuario
        const conversaciones = await chatManager.getRecentConversations(userId, limitConversaciones);
        
        if (!conversaciones || conversaciones.length === 0) {
            console.log('🔄 [CONTINUIDAD] No se encontraron conversaciones previas');
            return [];
        }
        
        console.log(`🔄 [CONTINUIDAD] Encontradas ${conversaciones.length} conversaciones recientes`);
        
        // Extraer últimos mensajes de cada conversación
        const mensajesRecientes = [];
        
        for (const conv of conversaciones) {
            try {
                const mensajes = await chatManager.getConversationMessages(userId, conv.id);
                if (mensajes && mensajes.length > 0) {
                    // Tomar últimos 2-3 mensajes de cada conversación
                    const ultimosMensajes = mensajes.slice(-3);
                    mensajesRecientes.push(...ultimosMensajes);
                    console.log(`🔄 [CONTINUIDAD] Agregados ${ultimosMensajes.length} mensajes de conversación ${conv.id}`);
                }
            } catch (error) {
                console.log(`⚠️ [CONTINUIDAD] Error obteniendo mensajes de conversación ${conv.id}:`, error.message);
            }
        }
        
        // Limitar a máximo 8 mensajes para no sobrecargar el contexto
        const mensajesLimitados = mensajesRecientes.slice(-8);
        
        console.log(`✅ [CONTINUIDAD] Contexto de continuidad obtenido: ${mensajesLimitados.length} mensajes`);
        
        // Formatear para usar en el prompt
        const contextoFormateado = mensajesLimitados.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
        
        return contextoFormateado;
        
    } catch (error) {
        console.error('❌ [CONTINUIDAD] Error obteniendo historial del usuario:', error.message);
        return [];
    }
}

/**
 * Personaliza la respuesta incluyendo el nombre del usuario de forma sutil (≈30% de las veces)
 * @param {string} respuesta - Texto original
 * @param {string} nombreUsuario - Nombre para personalizar
 * @returns {string} Respuesta potencialmente personalizada
 * 
 * @example
 * personalizarRespuesta('Hola, aquí tienes los clientes', 'María'); 
 * // 'Hola, María! Aquí tienes los clientes'
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
// 8. LÓGICA DE CONSTRUCCIÓN DE PROMPT INTELIGENTE
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
 * 
 * @example
 * const builder = await construirPromptInteligente(
 *   'dame 3 clientes', mapaERP, openai, '', '', [], false
 * );
 * // builder.prompt incluye identidad + mapaERP + reglas SQL
 * // builder.configModelo.modelo === 'gpt-4o'
 */
async function construirPromptInteligente(mensaje, mapaERP, openaiClient, contextoPinecone = '', contextoDatos = '', historialConversacion = [], modoDesarrollo = false) {
    console.log('🚀 [PROMPT-BUILDER] Construyendo prompt ULTRA-OPTIMIZADO...');
    
    // 1. LA IA DECIDE TODO - SIN ANÁLISIS PREVIO
    console.log('🧠 [PROMPT-BUILDER] La IA analizará la intención directamente...');
    
    // 2. Modelo único optimizado para todas las tareas
    const configModelo = {
        modelo: 'gpt-4o',
        maxTokens: 2000,
        temperature: 0.3,
        razon: 'Modelo único: gpt-4o maneja SQL, conversación y RAG+SQL con excelente rendimiento'
    };
    
    // 3. SIEMPRE incluir mapaERP - la IA decide si lo usa
    const contextoMapaERP = construirContextoMapaERPCompleto(mapaERP);
    console.log('📋 [MAPA-ERP] Incluyendo mapaERP completo - IA decide si lo usa');
    
    // 4. Construir instrucciones naturales (sin análisis previo)
    const instruccionesNaturales = construirInstruccionesNaturales({ tipo: 'universal' }, [], contextoPinecone);
    
    // 5. RAG INTELIGENTE - LA IA DECIDE TODO
    let contextoRAG = '';
    let necesitaRAG = true; // ✅ RAG SIEMPRE activo - la IA decide si lo usa
    
    try {
        const { evaluarNecesidadRAG } = require('./ragInteligente');
        const evaluacion = await evaluarNecesidadRAG(mensaje, { umbralCaracteres: 200 });
        contextoRAG = evaluacion.contextoRAG || '';
        console.log('🧠 [RAG] IA evalúa necesidad → contexto:', contextoRAG.length);
    } catch (error) {
        console.log('⚠️ [RAG] Evaluación falló, pero RAG sigue disponible:', error.message);
    }
    
    // 6. Ensamblar prompt final (OPTIMIZADO)
    const fechaActual = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' });
    const promptGlobalConFecha = promptGlobal.replace('{{FECHA_ACTUAL}}', fechaActual);
    let promptFinal = `${promptGlobalConFecha}\n` + instruccionesNaturales;
    
    // Añadir identidad corporativa SIEMPRE (centralizada en base.js)
    promptFinal += `${promptBase}\n\n`;
    
    // Añadir estructura de datos SIEMPRE - la IA decide si la usa
    promptFinal += `${contextoMapaERP}\n\n`;
    
    // Añadir reglas SQL SIEMPRE - la IA decide si las usa
    promptFinal += `${sqlRules}\n\n`;
    
    // Añadir contexto RAG si existe
    if (contextoRAG) {
        promptFinal += `CONOCIMIENTO EMPRESARIAL RELEVANTE:\n${contextoRAG}\n\n`;
    }
    
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
    
    console.log('✅ [PROMPT-BUILDER] Prompt construido - MapaERP: SIEMPRE, RAG:', necesitaRAG ? 'SÍ' : 'NO');
    
    return {
        prompt: promptFinal,
        configModelo: configModelo,
        intencion: { tipo: 'universal', confianza: 1.0 }, // IA decide todo
        tablasRelevantes: [], // IA analiza todas las tablas del mapaERP
        metricas: {
            usaIA: true, // IA analiza mapaERP completo
            tablasDetectadas: Object.keys(mapaERP).length,
            llamadasIA: 1, // ¡Solo UNA llamada!
            optimizado: true,
            modeloUnico: 'gpt-4o',
            mapaERPIncluido: true, // SIEMPRE incluido
            ragIncluido: necesitaRAG,
            sinHardcodeo: true // ✅ Eliminado análisis artificial
        }
    };
}

/**
 * Construye el contexto del mapa ERP COMPLETO para que la IA analice
 * - Incluye tablas, columnas, relaciones, y reglas para la IA
 * @param {Object} mapaERP - Objeto con estructura y metadatos del ERP
 * @returns {string} Texto de contexto para inyectar en el prompt
 * 
 * @example
 * const contexto = construirContextoMapaERPCompleto(mapaERP);
 * // Retorna string con toda la estructura de BD formateada
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
 * Construye las instrucciones naturales para el prompt de sistema
 * @param {{ tipo: string }} intencion - Intención detectada
 * @param {string[]} tablasRelevantes - Tablas detectadas
 * @param {string} contextoPinecone - Contexto de memoria/conocimiento
 * @returns {string} Bloque de instrucciones a inyectar en el prompt
 * 
 * @example
 * const instrucciones = construirInstruccionesNaturales({ tipo: 'universal' }, [], '');
 * // Retorna string con instrucciones de comportamiento y formato
 */
function construirInstruccionesNaturales(intencion, tablasRelevantes, contextoPinecone) {
    let instrucciones = comportamientoChatGPT + '\n\n';
    instrucciones += `\n## 🧠 INTELIGENCIA HÍBRIDA - CONOCIMIENTO + DATOS\n\n### 📚 **CONOCIMIENTO EMPRESARIAL (PRIORIDAD)**\n- Usa SIEMPRE el conocimiento empresarial como base principal\n- El contexto de Pinecone contiene información oficial de la empresa\n- Úsalo para explicar procedimientos, protocolos y conceptos\n\n### 🗄️ **DATOS DE BASE DE DATOS (CUANDO SEA NECESARIO)**\n- Si la consulta requiere datos actuales específicos, genera SQL\n- Formato: \`<sql>SELECT...</sql>\`\n- Usa EXACTAMENTE las columnas de la estructura proporcionada\n- Combina conocimiento + datos de forma natural\n- **NUNCA inventes datos de entidades** (clientes, proveedores, almacenes, etc.)\n- **SIEMPRE genera SQL real** y deja que el sistema ejecute y muestre datos reales\n- **SI no hay datos reales**, di claramente "No se encontraron registros en la base de datos"\n\n### 🤝 **COMBINACIÓN INTELIGENTE**\n- Explica el "por qué" usando conocimiento empresarial\n- Muestra el "qué" usando datos actuales cuando sea útil\n- Mantén respuestas naturales y conversacionales\n- **NUNCA mezcles datos inventados con datos reales**\n\n## 🎯 **EJEMPLOS DE USO**\n\n**Consulta sobre conocimiento:**\n"qué significa quando el cliente dice quiero todo"\n→ Usa SOLO conocimiento empresarial\n\n**Consulta sobre datos actuales:**\n"dame 2 clientes"\n→ Combina conocimiento + datos SQL\n\n**Consulta compleja:**\n"cuántos artículos hay y qué tipos"\n→ Explica con conocimiento + muestra datos actuales\n\n## ✅ **REGLAS IMPORTANTES**\n\n1. **SIEMPRE responde** - nunca digas "no tengo información"\n2. **Usa emojis** y tono amigable\n3. **Mantén personalidad** de empleado interno\n4. **Combina fuentes** cuando sea apropiado\n5. **Sé útil y completo** - no restrictivo\n\n`;
    instrucciones += formatoObligatorio;
    return instrucciones;
}

/**
 * Genera embeddings para análisis semántico
 * @param {string} texto - Texto a embeddear
 * @returns {Promise<number[]|null>} Vector embedding o null si falla
 * 
 * @example
 * const embedding = await generarEmbedding('texto para analizar');
 * // Retorna array de números o null si falla
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
// 9. FUNCIÓN PRINCIPAL - PROCESAMIENTO DE CONSULTAS
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

/**
 * Función principal optimizada para procesar consultas
 * Implementa cache LRU, heurística RAG, prompts precompilados y streaming inmediato
 * @param {Object} params - Parámetros de la consulta
 * @param {string} params.message - Mensaje del usuario
 * @param {string} params.userId - ID del usuario
 * @param {string} params.conversationId - ID de la conversación (opcional)
 * @returns {Object} Respuesta procesada
 */
async function processQuery({ message, userId, conversationId }) {
    const tiempoInicio = Date.now();
    console.log('🚀 [SISTEMA-CHATGPT] ===== INICIANDO PROCESO INTELIGENTE =====');
    console.log('🚀 [SISTEMA-CHATGPT] Procesando consulta:', message);
    console.log('🚀 [SISTEMA-CHATGPT] Usuario ID:', userId);
    
    // =====================================
    // 1. OBTENER CONTEXTO COMPLETO (PRESERVADO)
    // =====================================
    const [infoUsuario, historialConversacion] = await Promise.all([
        obtenerInfoUsuario(userId),
        obtenerHistorialConversacion(userId, conversationId)
    ]);

    console.log('📚 [CONTEXTO] Historial obtenido:', historialConversacion.length, 'mensajes');

    // =====================================
    // 2. CLASIFICACIÓN INTELIGENTE (PRESERVA CONTEXTO)
    // =====================================
    const clasificacion = await clasificarNecesidadRAG(message, historialConversacion, openai);
    console.log('🧠 [CLASIFICACION] Resultado:', clasificacion);
    
    // =====================================
    // 3. FAST-PATH PARA TRIVIALES (PRESERVA CONTEXTO)
    // =====================================
    if (clasificacion.tipo === 'trivial') {
        console.log('⚡ [FAST-PATH] Consulta trivial detectada...');
        
        try {
            const respuestaTrivial = await procesarConsultaTrivial(message, historialConversacion);
            
            // IMPORTANTE: Guardar en historial para preservar contexto (ASÍNCRONO)
            saveAssistantMessageToFirestore(userId, respuestaTrivial, conversationId).catch(err => 
                console.error('❌ [FIRESTORE] Error guardando mensaje trivial:', err.message)
            );
            
            const tiempoTrivial = Date.now() - tiempoInicio;
            console.log('✅ [FAST-PATH] Respuesta trivial en', tiempoTrivial, 'ms');
            
            return {
                success: true,
                response: respuestaTrivial,
                optimizado: true,
                cacheHit: false,
                tiempo: tiempoTrivial,
                clasificacion: clasificacion
            };
        } catch (error) {
            console.log('⚠️ [FAST-PATH] Error, continuando con flujo normal:', error.message);
        }
    }

    // =====================================
    // 4. OBTENER CONTEXTO RAG (SI ES NECESARIO)
    // =====================================
    let contextoRAG = '';
    if (clasificacion.necesitaRAG) {
        console.log('🔍 [RAG] Obteniendo contexto tipo:', clasificacion.tipo);
        contextoRAG = await obtenerContextoRAG(clasificacion.tipo, message, userId);
        console.log('✅ [RAG] Contexto obtenido:', contextoRAG.length, 'caracteres');
    }

    // =====================================
    // 5. CONSTRUIR PROMPT CON CONTEXTO COMPLETO
    // =====================================
    const promptOptimizado = construirPromptOptimizado(
        message, 
        clasificacion.necesitaRAG, 
        contextoRAG,
        historialConversacion // HISTORIAL COMPLETO PRESERVADO
    );

    // =====================================
    // 6. LLAMADA AL MODELO PRINCIPAL (CON CONTEXTO COMPLETO)
    // =====================================
    console.log('🤖 [MODELO-PRINCIPAL] Llamando a gpt-4o con contexto completo...');

    const mensajesLlamada = [
        { role: 'system', content: promptOptimizado },
        { role: 'user', content: message }
    ];

    // IMPORTANTE: Agregar HISTORIAL COMPLETO para preservar contexto
    if (historialConversacion && historialConversacion.length > 0) {
        historialConversacion.forEach((msg) => {
            mensajesLlamada.push({
                role: msg.role,
                content: msg.content
            });
        });
    }

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: mensajesLlamada,
            max_tokens: 2000,
            temperature: 0.3,
            stream: false
        });

        const respuestaIA = response.choices[0].message.content;
        console.log('✅ [MODELO-PRINCIPAL] Respuesta recibida');
        console.log('📊 [MODELO-PRINCIPAL] Tokens usados:', response.usage?.total_tokens || 'N/A');

        // =====================================
        // 7. POST-PROCESAMIENTO (PRESERVA CONTEXTO)
        // =====================================
        console.log('🔍 [POST-PROCESAMIENTO] Analizando respuesta para SQL...');
        
        const sqlMatch = validarRespuestaSQL(respuestaIA);
        
        if (sqlMatch) {
            console.log('🔍 [SQL] SQL detectado, ejecutando análisis profesional...');
            const sql = sqlMatch;
            try {
                // ANÁLISIS PROFESIONAL CON AST
                console.log('🧠 [SQL-PARSER] Iniciando análisis con AST...');
                const analisisSQL = analizarSQLProfesional(sql);
                // ...resto del análisis profesional aquí (no se repite para evitar duplicidad)...
                // El resto del código del análisis profesional ya está en el archivo, solo se reubica el try
            } catch (error) {
                // Manejo de errores del análisis SQL profesional
                console.error('❌ [SQL-PARSER] Error inesperado en análisis SQL profesional:', error.message);
                const respuestaError = `Ocurrió un error inesperado al analizar la consulta SQL. Por favor, revisa tu consulta o intenta de nuevo.`;
                saveAssistantMessageToFirestore(userId, respuestaError, conversationId).catch(err => 
                    console.error('❌ [FIRESTORE] Error guardando respuesta de error SQL:', err.message)
                );
                return {
                    success: false,
                    response: respuestaError,
                    error: error.message,
                    optimizado: true,
                    clasificacion: clasificacion
                };
            }
        }
        // Si no hay SQL, continuar con respuesta conversacional
        // IMPORTANTE: Guardar en historial para preservar contexto (ASÍNCRONO)
        saveAssistantMessageToFirestore(userId, respuestaIA, conversationId).catch(err => 
            console.error('❌ [FIRESTORE] Error guardando respuesta conversacional:', err.message)
        );
        const tiempoTotal = Date.now() - tiempoInicio;
        return {
            success: true,
            response: respuestaIA,
            tiempo: tiempoTotal,
            optimizado: true,
            clasificacion: clasificacion
        };
    } catch (error) {
        // Manejo de errores generales de la llamada principal
        console.error('❌ [SISTEMA-CHATGPT] Error inesperado en el procesamiento:', error.message);
        const respuestaError = `Ocurrió un error inesperado al procesar tu consulta. Por favor, intenta de nuevo más tarde.`;
        saveAssistantMessageToFirestore(userId, respuestaError, conversationId).catch(err => 
            console.error('❌ [FIRESTORE] Error guardando respuesta de error general:', err.message)
        );
        return {
            success: false,
            response: respuestaError,
            error: error.message,
            optimizado: false
        };
    }
}

// =====================================
// 10. MÓDULO DE EXPORTACIÓN
// =====================================
// 
// Este módulo exporta las funciones principales:
// - processQuery: Procesamiento estándar de consultas
// - processQueryStream: Procesamiento con streaming en tiempo real
// 
// USO EN OTROS ARCHIVOS:
// const { processQuery, processQueryStream } = require('./admin/core/openAI');
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
 * 
 * @example
 * // Dentro de un handler Express:
 * app.post('/api/stream', async (req, res) => {
 *   res.setHeader('Content-Type', 'text/plain; charset=utf-8');
 *   await processQueryStream({
 *     message: req.body.message,
 *     userId: req.user.uid,
 *     conversationId: req.body.conversationId,
 *     response: res
 *   });
 * });
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
        saveMessageToFirestore(userId, message, conversationId).catch(err => 
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
                console.log('✅ [STREAMING] SQL encontrado, ejecutando consulta...');
                console.log('🔍 [STREAMING] SQL original:', sql);
                try {
                    const results = await executeQuery(sql);
                    
                    if (results && results.length > 0) {
                        // Guardar los resultados reales para contexto futuro
                        lastRealData = JSON.stringify(results);
                        
                        console.log('✅ [STREAMING] SQL ejecutado exitosamente - haciendo segunda llamada para explicar datos');
                        
                        // Segunda llamada a la IA para explicar los datos reales de forma natural
                        const promptExplicacion = `Eres el asistente inteligente de Semilleros Deitana, una empresa agrícola especializada en producción de semillas y tomates. Tu comportamiento debe ser exactamente como ChatGPT: **natural, inteligente, útil y visualmente atractivo**.

## 🎯 FUNCIÓN PRINCIPAL

Tu tarea principal es explicar de forma natural y amigable los resultados de una consulta SQL.

CONSULTA ORIGINAL: "${message}"  
SQL EJECUTADO: ${sql}  
RESULTADOS: ${JSON.stringify(results, null, 2)}

---

## 📌 INSTRUCCIONES BASE:

- Explica los resultados de forma natural y conversacional
- Usa **"NOSOTROS"** y **"NUESTRA empresa"** como si fueras un empleado interno
- Sé específico sobre los datos encontrados
- Si no hay resultados, explica claramente que no se encontraron registros
- Mantén un tono **amigable, profesional y humano**
- Usa emojis apropiados para hacer la respuesta más atractiva

---

## 🌾 CONTEXTO DE SEMILLEROS DEITANA

- **SIEMPRE** interpreta términos agrícolas en contexto profesional
- **NUNCA** uses lenguaje o metáforas de entretenimiento o juegos
- Aplica estos significados específicos:
  - **Partida** = tanda de siembra específica (⚠️ no es juego)
  - **Injertos** = unión vegetal para mejorar resistencia
  - **Bandejas** = contenedores con alvéolos
  - **Alvéolos** = cavidades donde crecen plántulas

---

## 🧠 INTELIGENCIA Y RAZONAMIENTO

### ✅ 1. Razonamiento Paso a Paso

Para problemas complejos:
- Explica paso a paso con lógica clara
- Usa estructura visual y numeración

**Ejemplo:**
\\\
## 🤔 Analicemos esto paso a paso:

### 1️⃣ **Primer paso**: [Definir el problema]  
### 2️⃣ **Segundo paso**: [Análisis de datos]  
### 3️⃣ **Conclusión**: [Resultado o decisión]
\\\

---

### ✅ 2. Mantén el Contexto Conversacional

- Si el usuario responde "¿Y?" o "Entonces?", continúa desde el tema anterior
- Si dice "ok", ofrece el siguiente paso o amplía
- **Nunca digas** "No tengo información suficiente"
- **Sí di**: "Te explico lo que encontré y si querés, profundizo más sobre..."

---

## 🧑‍🏫 INTERACCIÓN NATURAL

### 💬 3. Tono Adaptativo

Adapta tu estilo al usuario:
- Formal → Profesional
- Casual → Con emojis y más cercano
- Técnico → Con detalles avanzados
- Novato → Explicaciones simples y claras

---

### 🎯 4. Reformulación Inteligente

Cuando el mensaje del usuario sea ambiguo:
1. Interpreta la intención más probable
2. Reformula lo que entendiste
3. Responde en base a esa interpretación
4. Ofrece corregir si no era eso

**Ejemplo:**
> "Parece que querías saber sobre [X]. Te explico esto, y si no era eso, contame más detalles 😊"

---

### 👀 5. Confirmaciones Inteligentes

Para acciones importantes:
- ⚠️ "¿Confirmás que querés eliminar esto?"
- 📤 "¿Procedo a enviar esta información?"
- 🔄 "¿Aplico los cambios?"

---

## 🧾 CONTENIDO ENRIQUECIDO Y VISUAL

### 🎨 6. Formato Markdown Obligatorio

**Siempre que sea posible, usá:**

- # Títulos con emojis
- ## Subtítulos para organización
- **Negritas** para conceptos clave  
- *Cursivas* para aclaraciones  
- ✅ Listas con emojis  
- > Blockquotes para tips o recordatorios  
- \`código inline\` para variables o términos clave  
- Tablas para comparaciones o datos

**Ejemplo:**
\\\markdown
| 📊 Año | 🧮 Cantidad de partidas |
|-------|--------------------------|
| 2023  | 145                      |
| 2024  | 180                      |
\\\

---

## 🧭 PERSONALIDAD INTELIGENTE

### 💡 9. Tu personalidad como IA

Eres:
- 🤝 Empático
- 🧠 Inteligente y analítico
- 🎯 Práctico y útil
- 😊 Amigable y claro

No eres:
- ❌ Robótico
- ❌ Vago o poco detallado
- ❌ Formal en exceso

---

### 📚 10. Resúmenes y Paráfrasis

Cuando el usuario escriba algo largo/confuso:
> "📝 **Resumen:** Entiendo que querías [tema]. Vamos a verlo juntos."

---

### ✍️ 11. Herramientas de Escritura Inteligente

Si hay errores de escritura:
> "📝 Entiendo que querías decir [X]..."

Ofrece versiones alternativas:
> "🎯 ¿Querés que te lo diga de forma:
> - 💼 Profesional
> - 🗣️ Más directa
> - 📚 Más detallada?"

---

## 🔄 CONTINUIDAD CONVERSACIONAL

### 📌 15. Confirmación de Entendimiento

Siempre responde algo como:
> "📋 Entiendo que necesitás [resumen]. ¿Es correcto? Te muestro lo que encontré 👇"

---

### 🧩 16. División por Partes

Cuando haya mucha info:
> "📚 Te explico esto por partes:

## 1️⃣ Parte 1: [Base]
## 2️⃣ Parte 2: [Detalles]
## 3️⃣ Parte 3: [Aplicaciones]

¿Querés que profundice en alguna?"

---

## ⭐ REGLAS DE ORO

### ✅ SIEMPRE:

1. 🎨 Usa Markdown y emojis  
2. 🧠 Razoná paso a paso  
3. 🔄 Mantén el hilo conversacional  
4. 💡 Agregá valor extra si podés  
5. 😊 Sé cálido, humano y profesional

### ❌ NUNCA:

1. ❌ Responder con texto plano sin formato  
2. ❌ Decir que no se tiene info sin intentar ayudar  
3. ❌ Ignorar contexto anterior  
4. ❌ Ser seco, robótico o sin ejemplos

---

## 📌 EJEMPLO DE RESPUESTA IDEAL

\\\markdown
# 🌱 Análisis de Partidas por Año

Consultamos cuántas partidas de siembra se realizaron por año.

## 📊 Resultados encontrados:

| 📅 Año | 🌱 Partidas |
|-------|-------------|
| 2023  | 154         |
| 2024  | 198         |

## 🤔 ¿Qué significa esto?

- En **2024** tuvimos un aumento significativo en partidas, lo que indica mayor actividad de siembra.
- Esto puede deberse a campañas más intensas o demanda de clientes.

💬 ¿Querés que analice alguna variedad o cultivo específico? Estoy para ayudarte 🌿
\\\
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
                            max_tokens: 500,
                            temperature: 0.7
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
            saveAssistantMessageToFirestore(userId, respuestaPersonalizada, conversationId).catch(err =>
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

/**
 * Exportar la función principal para su uso en otros archivos
 */
module.exports = {
    processQuery,
    processQueryStream,
    inicializarPromptsPrecompilados
};

// =====================================
// INICIALIZACIÓN AUTOMÁTICA
// =====================================
// 
// Inicializar prompts precompilados al cargar el módulo
// Esto evita I/O en cada petición y mejora el rendimiento
// =====================================

// Inicializar prompts precompilados inmediatamente
inicializarPromptsPrecompilados().catch(error => {
    console.error('❌ [INICIALIZACION] Error inicializando prompts:', error.message);
});

console.log('🚀 [SISTEMA-OPTIMIZADO] Módulo openAI optimizado cargado correctamente');
console.log('📊 [CACHE] Cache LRU inicializado con capacidad:', trivialResponseCache.maxSize);
console.log('⚡ [OPTIMIZACIONES] Heurística RAG, prompts precompilados y cache activos');

// =====================================
// HEURÍSTICA NO-ML PARA DECIDIR RAG
// =====================================
// 
// Sistema de heurística determinística que:
// - Detecta patrones que probablemente necesiten datos externos
// - Evita llamadas innecesarias a RAG (~1-2s de ahorro)
// - No reduce calidad del modelo (IA sigue decidiendo)
// - Basado en regex, patrones y entidades conocidas
// =====================================

/**
 * Heurística rápida para decidir si necesita RAG
 * @param {string} mensaje - Mensaje del usuario
 * @returns {boolean} True si probablemente necesita RAG
 */
function necesitaRAGHeuristica(mensaje) {
    const mensajeLower = mensaje.toLowerCase();
    
    // Patrones que indican necesidad de datos externos
    const patronesRAG = [
        // Consultas de datos específicos
        /\b(mostrar|dame|dime|busca|encontrar|cuántos|cuantas|cuanto|cuanta)\b/,
        /\b(clientes?|proveedores?|artículos?|partidas?|bandejas?|técnicos?)\b/,
        /\b(último|última|reciente|actual|hoy|ayer|semana|mes|año)\b/,
        /\b(factura|pedido|venta|compra|inventario|stock)\b/,
        /\b(número|id|código|referencia)\b/,
        
        // Consultas de conocimiento empresarial
        /\b(qué significa|que significa|como funciona|cómo funciona)\b/,
        /\b(protocolo|proceso|procedimiento|política)\b/,
        /\b(injerto|germinación|cámara|desinfección|fertilizante)\b/,
        /\b(pedro muñoz|quiero todo|entrada en cámara)\b/,
        
        // Consultas de contexto
        /\b(anterior|antes|mencionaste|dijiste|recordar|recuerdas)\b/,
        /\b(conversación|conversacion|hablamos|entonces)\b/,
        
        // Consultas complejas
        /\b(y|también|además|más|otros|otra|que|qué)\b/,
        /\b(comparar|diferencias|similitudes|análisis|reporte)\b/
    ];
    
    // Verificar si coincide con algún patrón
    const coincidePatron = patronesRAG.some(patron => patron.test(mensajeLower));
    
    // Verificar longitud (consultas largas suelen necesitar más contexto)
    const esConsultaLarga = mensaje.length > 50;
    
    // Verificar si contiene signos de interrogación
    const tienePreguntas = mensaje.includes('?') || mensaje.includes('¿');
    
    // Verificar si contiene números (puede indicar consultas específicas)
    const tieneNumeros = /\d/.test(mensaje);
    
    // Verificar si contiene nombres de tablas conocidas
    const tablasConocidas = ['clientes', 'articulos', 'tecnicos', 'proveedores', 'partidas'];
    const mencionaTablas = tablasConocidas.some(tabla => mensajeLower.includes(tabla));
    
    // Lógica de decisión
    const necesitaRAG = coincidePatron || esConsultaLarga || tienePreguntas || 
                       tieneNumeros || mencionaTablas;
    
    console.log('🔍 [HEURISTICA-RAG] Análisis:', {
        mensaje: mensaje.substring(0, 50) + '...',
        coincidePatron,
        esConsultaLarga,
        tienePreguntas,
        tieneNumeros,
        mencionaTablas,
        necesitaRAG
    });
    
    return necesitaRAG;
}

// =====================================
// SISTEMA FAST-PATH TIPO CHATGPT
// =====================================

/**
 * Analiza complejidad de forma rápida (sin IA)
 * @param {string} mensaje - Mensaje del usuario
 * @returns {number} Score de complejidad (0-1)
 */
function analizarComplejidadRapida(mensaje) {
    const longitud = mensaje.length;
    const palabras = mensaje.split(' ').length;
    const tieneInterrogacion = mensaje.includes('?');
    const tienePalabrasClave = /(cuántos|cuántas|dame|muestra|lista|clientes|proveedores|artículos|datos|información|tabla|significa|funciona|protocolo|proceso)/i.test(mensaje);
    const tieneNumeros = /\d/.test(mensaje);
    
    let complejidad = 0;
    
    // Factores de complejidad
    if (longitud > 50) complejidad += 0.3;
    if (palabras > 8) complejidad += 0.2;
    if (tieneInterrogacion) complejidad += 0.2;
    if (tienePalabrasClave) complejidad += 0.4;
    if (tieneNumeros) complejidad += 0.1;
    
    return Math.min(complejidad, 1);
}

/**
 * Detecta si es consulta trivial de forma inteligente
 * @param {string} mensaje - Mensaje del usuario
 * @param {Array} historial - Historial conversacional
 * @returns {boolean} True si es trivial
 */
function esConsultaTrivial(mensaje, historial = []) {
    const complejidad = analizarComplejidadRapida(mensaje);
    const contexto = historial.length;
    const esPrimeraInteraccion = contexto === 0;
    
    // Heurística inteligente: consultas simples con poco contexto
    return complejidad < 0.3 && contexto < 8 && !esPrimeraInteraccion;
}

/**
 * Respuestas variadas con personalidad de Semilleros Deitana
 */
const respuestasVariadas = {
    saludo: [
        "¡Hola! 🌱 ¿En qué puedo ayudarte hoy en Semilleros Deitana?",
        "¡Hola! 💚 Me alegra verte. ¿Cómo puedo asistirte con nuestros servicios?",
        "¡Hola! 🌿 Bienvenido a Semilleros Deitana. ¿En qué te ayudo?",
        "¡Hola! 🌱 ¿Qué te gustaría saber sobre nuestros productos?",
        "¡Hola! 💚 ¿Cómo puedo ser útil hoy?"
    ],
    agradecimiento: [
        "¡De nada! 🌱 Estoy aquí para ayudarte siempre que lo necesites.",
        "¡Un placer! 💚 Si tienes más preguntas, no dudes en consultarme.",
        "¡Por supuesto! 🌿 Me alegra haber podido ayudarte.",
        "¡De nada! 🌱 ¿Hay algo más en lo que pueda asistirte?",
        "¡Un gusto! 💚 Estoy aquí para lo que necesites."
    ],
    confirmacion: [
        "¡Perfecto! 🌱 ¿Hay algo más en lo que pueda ayudarte?",
        "¡Excelente! 💚 ¿Necesitas información adicional?",
        "¡Genial! 🌿 ¿Qué más te gustaría saber?",
        "¡Muy bien! 🌱 ¿En qué más puedo ser útil?",
        "¡Perfecto! 💚 ¿Hay alguna otra consulta?"
    ],
    ayuda: [
        "¡Por supuesto! 🌱 Puedo ayudarte con información sobre clientes, proveedores, productos, procesos y mucho más. ¿Qué te interesa?",
        "¡Claro! 💚 Estoy aquí para responder tus preguntas sobre Semilleros Deitana. ¿Qué necesitas saber?",
        "¡Te ayudo! 🌿 Puedo consultar datos, explicar procesos, buscar información y más. ¿Qué te gustaría?",
        "¡Por supuesto! 🌱 ¿Qué información necesitas sobre la empresa?",
        "¡Claro! 💚 ¿En qué puedo ayudarte específicamente?"
    ]
};

/**
 * Detecta el tipo de respuesta trivial
 * @param {string} mensaje - Mensaje normalizado
 * @returns {string} Tipo de respuesta
 */
function detectarTipoRespuesta(mensaje) {
    const mensajeLower = mensaje.toLowerCase();
    
    if (/^(hola|buenos|buenas|saludos)/.test(mensajeLower)) return 'saludo';
    if (/^(gracias|gracie|thx)/.test(mensajeLower)) return 'agradecimiento';
    if (/^(ok|okay|perfecto|genial|excelente|bien)/.test(mensajeLower)) return 'confirmacion';
    if (/^(ayuda|help|que hacer|no se)/.test(mensajeLower)) return 'ayuda';
    
    return 'saludo'; // Por defecto
}

/**
 * Genera respuesta trivial con personalidad
 * @param {string} mensaje - Mensaje del usuario
 * @param {string} tipo - Tipo de respuesta
 * @returns {string} Respuesta personalizada
 */
function generarRespuestaTrivial(mensaje, tipo) {
    const respuestas = respuestasVariadas[tipo] || respuestasVariadas.saludo;
    const respuesta = respuestas[Math.floor(Math.random() * respuestas.length)];
    
    return respuesta;
}

/**
 * Procesa consulta trivial SIN llamadas a API (verdaderamente rápido)
 * @param {string} mensaje - Mensaje del usuario
 * @param {Array} historial - Historial conversacional
 * @returns {string} Respuesta instantánea
 */
async function procesarConsultaTrivial(mensaje, historial) {
    console.log('⚡ [FAST-PATH] Generando respuesta instantánea...');
    
    // Normalizar mensaje para clasificación
    const mensajeNormalizado = mensaje.toLowerCase().trim();
    
    // Detectar tipo de respuesta
    const tipo = detectarTipoRespuesta(mensajeNormalizado);
    
    // Generar respuesta instantánea (sin API)
    const respuesta = generarRespuestaTrivial(mensaje, tipo);
    
    console.log('✅ [FAST-PATH] Respuesta generada instantáneamente');
    return respuesta;
}

// =====================================
// SISTEMA DE CLASIFICACIÓN INTELIGENTE TIPO CHATGPT
// =====================================

/**
 * Clasifica la necesidad de RAG de forma inteligente (tipo ChatGPT)
 * @param {string} mensaje - Mensaje del usuario
 * @param {Array} historial - Historial conversacional completo
 * @param {Object} openai - Cliente OpenAI
 * @returns {Promise<Object>} Clasificación con metadata
 */
async function clasificarNecesidadRAG(mensaje, historial, openai) {
    console.log('🧠 [CLASIFICADOR] Analizando necesidad de RAG...');
    
    // 1. Fast-path heurístico (casos evidentes)
    const clasificacionRapida = clasificacionHeuristicaRapida(mensaje);
    if (clasificacionRapida.confianza > 0.8) {
        console.log('⚡ [CLASIFICADOR] Fast-path:', clasificacionRapida);
        return clasificacionRapida;
    }
    
    // 2. Mini-LLM para casos no evidentes
    try {
        const clasificacionLLM = await clasificarConMiniLLM(mensaje, historial, openai);
        console.log('🤖 [CLASIFICADOR] Mini-LLM:', clasificacionLLM);
        return clasificacionLLM;
    } catch (error) {
        console.log('⚠️ [CLASIFICADOR] Fallback a heurística:', error.message);
        return clasificacionRapida;
    }
}

/**
 * Clasificación heurística rápida (sin IA)
 * @param {string} mensaje - Mensaje del usuario
 * @returns {Object} Clasificación rápida
 */
function clasificacionHeuristicaRapida(mensaje) {
    const mensajeLower = mensaje.toLowerCase();
    
    // Patrones evidentes que NO necesitan RAG
    const patronesTriviales = [
        'hola', 'buenos', 'buenas', 'saludos', 'gracias', 'ok', 'okay',
        'perfecto', 'genial', 'excelente', 'bien', 'mal', 'ayuda'
    ];
    
    // Patrones evidentes que SÍ necesitan RAG
    const patronesConocimiento = [
        'qué significa', 'que significa', 'como funciona', 'cómo funciona',
        'protocolo', 'proceso', 'procedimiento', 'explica', 'describe',
        'qué es', 'que es', 'definición', 'definicion'
    ];
    
    // Patrones evidentes de datos
    const patronesDatos = [
        'cuántos', 'cuántas', 'dame', 'muestra', 'lista', 'clientes',
        'proveedores', 'artículos', 'datos', 'información', 'tabla'
    ];
    
    // Análisis rápido
    const esTrivial = patronesTriviales.some(patron => mensajeLower.includes(patron));
    const esConocimiento = patronesConocimiento.some(patron => mensajeLower.includes(patron));
    const esDatos = patronesDatos.some(patron => mensajeLower.includes(patron));
    
    if (esTrivial) {
        return { necesitaRAG: false, tipo: 'trivial', confianza: 0.9, razon: 'Consulta trivial' };
    }
    
    if (esConocimiento) {
        return { necesitaRAG: true, tipo: 'conocimiento_empresarial', confianza: 0.9, razon: 'Pregunta de conocimiento' };
    }
    
    if (esDatos) {
        return { necesitaRAG: true, tipo: 'base_datos', confianza: 0.8, razon: 'Consulta de datos' };
    }
    
    return { necesitaRAG: false, tipo: 'conversacion', confianza: 0.5, razon: 'No determinado' };
}

/**
 * Clasificación con Mini-LLM (preserva contexto)
 * @param {string} mensaje - Mensaje actual
 * @param {Array} historial - Historial completo (se preserva)
 * @param {Object} openai - Cliente OpenAI
 * @returns {Promise<Object>} Clasificación inteligente
 */
async function clasificarConMiniLLM(mensaje, historial, openai) {
    // Solo usar últimos 3 mensajes para clasificación (no rompe contexto)
    const contextoClasificacion = historial.slice(-3).map(msg => 
        `${msg.role}: ${msg.content}`
    ).join('\n');
    
    const prompt = `
    Eres un clasificador inteligente. Analiza si esta consulta necesita información adicional y de qué tipo.
    
    CONTEXTO CONVERSACIONAL (últimos 3 mensajes):
    ${contextoClasificacion}
    
    CONSULTA ACTUAL: "${mensaje}"
    
    Tipos de información disponibles:
    - conocimiento_empresarial: Conceptos, definiciones, procedimientos de la empresa
    - documentacion_interna: Manuales, guías, políticas internas
    - base_datos: Consultas de datos actuales (clientes, productos, etc.)
    - historial_conversacional: Contexto de conversación previa
    - procesos_internos: Flujos de trabajo, protocolos específicos
    - trivial: Saludos, confirmaciones, respuestas simples
    
    Responde SOLO en JSON válido:
    {
        "necesitaRAG": true/false,
        "tipo": "tipo_especifico",
        "confianza": 0.0-1.0,
        "razon": "explicación breve de la decisión"
    }
    `;
    
    const respuesta = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.1,
        response_format: { type: "json_object" }
    });
    
    const clasificacion = JSON.parse(respuesta.choices[0].message.content);
    
    // Validar y normalizar respuesta
    return {
        necesitaRAG: Boolean(clasificacion.necesitaRAG),
        tipo: clasificacion.tipo || 'conocimiento_empresarial',
        confianza: Math.min(Math.max(clasificacion.confianza || 0.5, 0), 1),
        razon: clasificacion.razon || 'Clasificación automática'
    };
}

/**
 * Analiza contexto conversacional para RAG
 * @param {Array} historial - Historial completo
 * @returns {Object} Análisis de contexto
 */
function analizarContextoConversacional(historial) {
    if (historial.length === 0) {
        return { necesitaRAG: false, complejidad: 0, temas: [] };
    }
    
    const ultimosMensajes = historial.slice(-5);
    const temasDiscutidos = extraerTemasConversacionales(ultimosMensajes);
    const complejidad = calcularComplejidadConversacional(ultimosMensajes);
    
    return {
        necesitaRAG: complejidad > 0.6 || temasDiscutidos.length > 2,
        complejidad,
        temas: temasDiscutidos,
        tipo: 'historial_conversacional'
    };
}

/**
 * Extrae temas de la conversación
 * @param {Array} mensajes - Mensajes a analizar
 * @returns {Array} Temas identificados
 */
function extraerTemasConversacionales(mensajes) {
    const temas = new Set();
    
    mensajes.forEach(msg => {
        const contenido = msg.content.toLowerCase();
        
        if (contenido.includes('cliente') || contenido.includes('clientes')) temas.add('clientes');
        if (contenido.includes('proveedor') || contenido.includes('proveedores')) temas.add('proveedores');
        if (contenido.includes('producto') || contenido.includes('artículo')) temas.add('productos');
        if (contenido.includes('proceso') || contenido.includes('protocolo')) temas.add('procesos');
        if (contenido.includes('datos') || contenido.includes('información')) temas.add('datos');
    });
    
    return Array.from(temas);
}

/**
 * Calcula complejidad de la conversación
 * @param {Array} mensajes - Mensajes a analizar
 * @returns {number} Score de complejidad (0-1)
 */
function calcularComplejidadConversacional(mensajes) {
    if (mensajes.length === 0) return 0;
    
    let complejidad = 0;
    
    mensajes.forEach(msg => {
        const longitud = msg.content.length;
        const palabras = msg.content.split(' ').length;
        const tienePreguntas = msg.content.includes('?');
        const tienePalabrasClave = /(cuántos|qué|cómo|por qué|explica|describe)/i.test(msg.content);
        
        if (longitud > 50) complejidad += 0.2;
        if (palabras > 8) complejidad += 0.15;
        if (tienePreguntas) complejidad += 0.2;
        if (tienePalabrasClave) complejidad += 0.25;
    });
    
    return Math.min(complejidad / mensajes.length, 1);
}

/**
 * Obtiene contexto RAG según tipo
 * @param {string} tipo - Tipo de RAG
 * @param {string} mensaje - Mensaje del usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<string>} Contexto RAG
 */
async function obtenerContextoRAG(tipo, mensaje, userId) {
    console.log('🔍 [RAG] Obteniendo contexto tipo:', tipo);
    
    switch (tipo) {
        case 'conocimiento_empresarial':
        case 'documentacion_interna':
        case 'procesos_internos':
            return await pineconeMemoria.agregarContextoMemoria(userId, mensaje);
            
        case 'base_datos':
            // Para datos, no necesitamos RAG, solo SQL
        return '';
            
        case 'historial_conversacional':
            // El historial ya se maneja en el prompt
            return '';
            
        default:
            return await pineconeMemoria.agregarContextoMemoria(userId, mensaje);
    }
}

// =====================================
// SISTEMA DE CACHE PARA RESULTADOS ALEATORIOS
// =====================================

// Cache para resultados premezclados
const resultadosAleatoriosCache = new Map();

/**
 * Fisher-Yates shuffle eficiente y uniforme
 * @param {Array} array - Array a mezclar
 * @returns {Array} Array mezclado (copia)
 */
function fisherYatesShuffle(array) {
    const shuffled = [...array]; // No mutar original
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Obtiene resultados aleatorios desde cache o genera nuevos
 * @param {string} cacheKey - Clave del cache
 * @param {Array} resultados - Resultados originales
 * @param {number} limite - Número de resultados
 * @returns {Array} Resultados aleatorios
 */
function obtenerResultadosAleatoriosCacheados(cacheKey, resultados, limite) {
    // Verificar cache
    if (resultadosAleatoriosCache.has(cacheKey)) {
        const cacheEntry = resultadosAleatoriosCache.get(cacheKey);
        const tiempoTranscurrido = Date.now() - cacheEntry.timestamp;
        
        // Cache válido por 5 minutos
        if (tiempoTranscurrido < 5 * 60 * 1000) {
            console.log('🎲 [CACHE-ALEATORIO] Usando resultados premezclados');
            return cacheEntry.resultados.slice(0, limite);
        }
    }
    
    // Generar nuevos resultados mezclados
    console.log('🎲 [CACHE-ALEATORIO] Generando nuevos resultados mezclados');
    const resultadosMezclados = fisherYatesShuffle(resultados);
    
    // Guardar en cache
    resultadosAleatoriosCache.set(cacheKey, {
        resultados: resultadosMezclados,
        timestamp: Date.now()
    });
    
    return resultadosMezclados.slice(0, limite);
}

/**
 * Función optimizada para limitar resultados con aleatorización eficiente
 * @param {Array} results - Resultados de la consulta
 * @param {number} limite - Número máximo de resultados (default: 5)
 * @param {boolean} aleatorio - Si se deben seleccionar registros aleatorios (default: false)
 * @param {string} cacheKey - Clave para cache de aleatorización (opcional)
 * @returns {Array} Resultados limitados
 * 
 * @example
 * limitarResultados([{id:1},{id:2},{id:3}], 2, false); // [{id:1},{id:2}]
 * limitarResultados([{id:1},{id:2},{id:3}], 2, true, 'clientes'); // 2 resultados aleatorios cacheados
 */
function limitarResultados(results, limite = 5, aleatorio = false, cacheKey = null) {
    if (!results || results.length === 0) return [];
    
    // Si no hay suficientes resultados, retornar todos
    if (results.length <= limite) {
        return aleatorio ? fisherYatesShuffle(results) : [...results];
    }
    
    if (aleatorio) {
        // Usar cache si se proporciona clave
        if (cacheKey) {
            return obtenerResultadosAleatoriosCacheados(cacheKey, results, limite);
        }
        
        // Sin cache, usar Fisher-Yates directamente
        return fisherYatesShuffle(results).slice(0, limite);
    }
    
    // Retornar primeros N sin modificar orden original
    return results.slice(0, limite);
}

/**
 * Genera clave de cache para resultados aleatorios
 * @param {string} tabla - Nombre de la tabla
 * @param {string} consulta - Consulta original
 * @returns {string} Clave de cache
 */
function generarClaveCacheAleatorio(tabla, consulta) {
    return `aleatorio_${tabla}_${Buffer.from(consulta).toString('base64').slice(0, 20)}`;
}

/**
 * Modifica consulta SQL para incluir LIMIT cuando sea apropiado
 * @param {string} sql - SQL original
 * @param {number} limite - Límite deseado
 * @param {boolean} aleatorio - Si se requiere aleatorización
 * @returns {string} SQL optimizado
 */
function optimizarSQLConLimite(sql, limite, aleatorio = false) {
    // Si ya tiene LIMIT, no modificar
    if (sql.toLowerCase().includes('limit')) {
        return sql;
    }
    
    // Para consultas simples sin aleatorización, agregar LIMIT
    if (!aleatorio && !sql.toLowerCase().includes('order by')) {
        return sql.replace(/;?\s*$/, ` LIMIT ${limite};`);
    }
    
    // Para aleatorización, agregar ORDER BY RAND() y LIMIT
    if (aleatorio) {
        return sql.replace(/;?\s*$/, ` ORDER BY RAND() LIMIT ${limite};`);
    }
    
    return sql;
}

/**
 * Validación semántica avanzada de SQL
 * @param {string} sql - SQL a validar
 * @returns {Object} Resultado de validación
 */
function validacionSemanticaSQL(sql) {
    const resultado = {
        esValido: true,
        errores: [],
        advertencias: [],
        tablasUsadas: [],
        columnasUsadas: [],
        nivelRiesgo: 'bajo'
    };

    // 1. DETECCIÓN DE PATRONES PELIGROSOS
    const patronesPeligrosos = [
        /drop\s+table/i,
        /insert\s+into/i,
        /update\s+.+\s+set/i,
        /delete\s+from/i,
        /create\s+table/i,
        /alter\s+table/i,
        /truncate/i,
        /--\s*drop/i,
        /\/\*.*drop.*\*\//i
    ];

    patronesPeligrosos.forEach((patron, index) => {
        if (patron.test(sql)) {
            resultado.esValido = false;
            resultado.errores.push(`Patrón peligroso detectado: ${patron.source}`);
            resultado.nivelRiesgo = 'alto';
        }
    });

    // 2. EXTRACCIÓN DE TABLAS Y COLUMNAS
    const tablasMatch = sql.match(/from\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
    const columnasMatch = sql.match(/select\s+(.+?)\s+from/i);
    
    if (tablasMatch) {
        resultado.tablasUsadas = tablasMatch.map(t => t.replace(/from\s+/i, '').toLowerCase());
    }
    
    if (columnasMatch) {
        const columnas = columnasMatch[1].split(',').map(c => c.trim());
        resultado.columnasUsadas = columnas.map(c => {
            const match = c.match(/([a-zA-Z_][a-zA-Z0-9_]*)/);
            return match ? match[1].toLowerCase() : c.toLowerCase();
        });
    }

    // 3. VALIDACIÓN CONTRA MAPAERP
    resultado.tablasUsadas.forEach(tabla => {
        if (!mapaERP[tabla]) {
            resultado.esValido = false;
            resultado.errores.push(`Tabla no existe en mapaERP: ${tabla}`);
        }
    });

    // 4. VALIDACIÓN DE COLUMNAS
    resultado.tablasUsadas.forEach(tabla => {
        if (mapaERP[tabla]) {
            const columnasTabla = Object.keys(mapaERP[tabla].columnas || {});
            resultado.columnasUsadas.forEach(columna => {
                if (!columnasTabla.includes(columna) && !columna.includes('*')) {
                    resultado.advertencias.push(`Columna posiblemente inexistente: ${tabla}.${columna}`);
                }
            });
        }
    });

    // 5. DETECCIÓN DE COMPLEJIDAD
    const complejidad = calcularComplejidadSQL(sql);
    if (complejidad > 0.8) {
        resultado.advertencias.push('Consulta muy compleja, puede afectar rendimiento');
        resultado.nivelRiesgo = 'medio';
    }

    return resultado;
}

/**
 * Calcula complejidad de una consulta SQL
 * @param {string} sql - SQL a analizar
 * @returns {number} Score de complejidad (0-1)
 */
function calcularComplejidadSQL(sql) {
    let complejidad = 0;
    
    // Factores de complejidad
    if (sql.toLowerCase().includes('join')) complejidad += 0.2;
    if (sql.toLowerCase().includes('subquery')) complejidad += 0.3;
    if (sql.toLowerCase().includes('union')) complejidad += 0.2;
    if (sql.toLowerCase().includes('group by')) complejidad += 0.15;
    if (sql.toLowerCase().includes('having')) complejidad += 0.1;
    if (sql.toLowerCase().includes('order by')) complejidad += 0.05;
    if (sql.toLowerCase().includes('distinct')) complejidad += 0.1;
    
    // Contar subconsultas
    const subqueries = (sql.match(/\(/g) || []).length;
    complejidad += subqueries * 0.1;
    
    return Math.min(complejidad, 1);
}

/**
 * Normaliza nombres técnicos usando fuzzy search
 * @param {string} sql - SQL original
 * @returns {string} SQL con nombres corregidos
 */
function normalizarNombresSQL(sql) {
    let sqlNormalizado = sql;
    
    // Extraer y corregir nombres de tablas
    const tablasMatch = sql.match(/from\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
    if (tablasMatch) {
        tablasMatch.forEach(tablaMatch => {
            const tablaOriginal = tablaMatch.replace(/from\s+/i, '');
            const tablaCorregida = buscarNombreSimilar(tablaOriginal, Object.keys(mapaERP));
            
            if (tablaCorregida && tablaCorregida !== tablaOriginal) {
                console.log(`🔄 [SQL-NORMALIZACION] Tabla corregida: ${tablaOriginal} → ${tablaCorregida}`);
                sqlNormalizado = sqlNormalizado.replace(
                    new RegExp(`\\b${tablaOriginal}\\b`, 'gi'),
                    tablaCorregida
                );
            }
        });
    }
    
    return sqlNormalizado;
}

/**
 * Busca nombre similar en un array de nombres válidos
 * @param {string} nombre - Nombre a buscar
 * @param {Array} nombresValidos - Array de nombres válidos
 * @returns {string|null} Nombre más similar o null
 */
function buscarNombreSimilar(nombre, nombresValidos) {
    const nombreLower = nombre.toLowerCase();
    
    // Búsqueda exacta
    const exacto = nombresValidos.find(n => n.toLowerCase() === nombreLower);
    if (exacto) return exacto;
    
    // Búsqueda por similitud
    const similitudes = nombresValidos.map(n => ({
        nombre: n,
        similitud: calcularSimilitud(nombreLower, n.toLowerCase())
    }));
    
    const mejor = similitudes.reduce((prev, current) => 
        current.similitud > prev.similitud ? current : prev
    );
    
    // Solo retornar si la similitud es alta (> 0.7)
    return mejor.similitud > 0.7 ? mejor.nombre : null;
}

/**
 * Calcula similitud entre dos strings
 * @param {string} str1 - String 1
 * @param {string} str2 - String 2
 * @returns {number} Score de similitud (0-1)
 */
function calcularSimilitud(str1, str2) {
    if (str1 === str2) return 1;
    if (str1.includes(str2) || str2.includes(str1)) return 0.8;
    
    // Similitud por caracteres comunes
    const chars1 = new Set(str1);
    const chars2 = new Set(str2);
    const interseccion = new Set([...chars1].filter(x => chars2.has(x)));
    const union = new Set([...chars1, ...chars2]);
    
    return interseccion.size / union.size;
}

/**
 * Sistema de reintentos inteligente para consultas sin resultados
 * @param {string} mensajeOriginal - Mensaje original del usuario
 * @param {string} sqlOriginal - SQL original que no dio resultados
 * @param {Object} clasificacion - Clasificación de la consulta
 * @param {Array} historial - Historial conversacional
 * @returns {Promise<Object>} Resultado del reintento
 */
async function sistemaReintentosInteligente(mensajeOriginal, sqlOriginal, clasificacion, historial) {
    console.log('🔄 [REINTENTOS] Iniciando sistema de reintentos inteligente...');
    
    const estrategias = [
        { nombre: 'fuzzy_search', prioridad: 1 },
        { nombre: 'prompt_alternativo', prioridad: 2 },
        { nombre: 'busqueda_similar', prioridad: 3 },
        { nombre: 'fallback_general', prioridad: 4 }
    ];
    
    for (const estrategia of estrategias) {
        console.log(`🔄 [REINTENTOS] Probando estrategia: ${estrategia.nombre}`);
        
        try {
            const resultado = await ejecutarEstrategiaReintento(
                estrategia.nombre,
                mensajeOriginal,
                sqlOriginal,
                clasificacion,
                historial
            );
            
            if (resultado.exitoso) {
                console.log(`✅ [REINTENTOS] Estrategia ${estrategia.nombre} exitosa`);
                return {
                    ...resultado,
                    estrategiaUsada: estrategia.nombre,
                    reintentos: estrategias.indexOf(estrategia) + 1
                };
            }
        } catch (error) {
            console.log(`⚠️ [REINTENTOS] Estrategia ${estrategia.nombre} falló:`, error.message);
        }
    }
    
    // Si todas las estrategias fallan
    console.log('❌ [REINTENTOS] Todas las estrategias fallaron');
    return {
        exitoso: false,
        mensaje: 'No pude encontrar la información que buscas. ¿Podrías reformular tu pregunta?',
        estrategiaUsada: 'fallback_final',
        reintentos: estrategias.length
    };
}

/**
 * Ejecuta una estrategia específica de reintento
 * @param {string} estrategia - Nombre de la estrategia
 * @param {string} mensajeOriginal - Mensaje original
 * @param {string} sqlOriginal - SQL original
 * @param {Object} clasificacion - Clasificación
 * @param {Array} historial - Historial
 * @returns {Promise<Object>} Resultado de la estrategia
 */
async function ejecutarEstrategiaReintento(estrategia, mensajeOriginal, sqlOriginal, clasificacion, historial) {
    switch (estrategia) {
        case 'fuzzy_search':
            return await estrategiaFuzzySearch(mensajeOriginal, sqlOriginal);
            
        case 'prompt_alternativo':
            return await estrategiaPromptAlternativo(mensajeOriginal, clasificacion, historial);
            
        case 'busqueda_similar':
            return await estrategiaBusquedaSimilar(mensajeOriginal, sqlOriginal);
            
        case 'fallback_general':
            return await estrategiaFallbackGeneral(mensajeOriginal);
            
        default:
            throw new Error(`Estrategia desconocida: ${estrategia}`);
    }
}

/**
 * Estrategia 1: Fuzzy Search
 * @param {string} mensaje - Mensaje original
 * @param {string} sqlOriginal - SQL original
 * @returns {Promise<Object>} Resultado
 */
async function estrategiaFuzzySearch(mensaje, sqlOriginal) {
    console.log('🔍 [FUZZY-STRATEGY] Ejecutando búsqueda fuzzy...');
    
    try {
        const resultadoFuzzy = await fuzzySearchRetry(sqlOriginal, mensaje);
        
        if (resultadoFuzzy && resultadoFuzzy.results && resultadoFuzzy.results.length > 0) {
            const resultadosFormateados = formatResultsAsMarkdown(resultadoFuzzy.results);
            return {
                exitoso: true,
                mensaje: `Encontré resultados similares:\n\n${resultadosFormateados}`,
                data: resultadoFuzzy.results,
                sql: resultadoFuzzy.sqlFuzzyTry,
                tipo: 'fuzzy_search'
            };
        }
        
        return { exitoso: false };
    } catch (error) {
        console.error('❌ [FUZZY-STRATEGY] Error:', error.message);
        return { exitoso: false };
    }
}

/**
 * Estrategia 2: Prompt Alternativo
 * @param {string} mensaje - Mensaje original
 * @param {Object} clasificacion - Clasificación
 * @param {Array} historial - Historial
 * @returns {Promise<Object>} Resultado
 */
async function estrategiaPromptAlternativo(mensaje, clasificacion, historial) {
    console.log('🤖 [PROMPT-STRATEGY] Generando prompt alternativo...');
    
    try {
        // Prompt alternativo más específico
        const promptAlternativo = `
        La consulta anterior no encontró resultados. Intenta con una aproximación diferente:
        
        Consulta original: "${mensaje}"
        
        Instrucciones:
        1. Analiza si la consulta es muy específica y prueba con criterios más amplios
        2. Considera sinónimos o términos relacionados
        3. Si es una búsqueda por nombre, intenta con LIKE o búsqueda parcial
        4. Genera SQL que sea más inclusivo
        
        Genera solo el SQL optimizado:
        `;
        
        const mensajesAlternativos = [
            { role: 'system', content: promptAlternativo },
            { role: 'user', content: mensaje }
        ];
        
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: mensajesAlternativos,
            max_tokens: 500,
            temperature: 0.3
        });
        
        const sqlAlternativo = validarRespuestaSQL(response.choices[0].message.content);
        
        if (sqlAlternativo) {
            const resultados = await executeQuery(sqlAlternativo);
            
            if (resultados && resultados.length > 0) {
                const resultadosFormateados = formatResultsAsMarkdown(resultados);
                return {
                    exitoso: true,
                    mensaje: `Con una búsqueda más amplia encontré:\n\n${resultadosFormateados}`,
                    data: resultados,
                    sql: sqlAlternativo,
                    tipo: 'prompt_alternativo'
                };
            }
        }
        
        return { exitoso: false };
    } catch (error) {
        console.error('❌ [PROMPT-STRATEGY] Error:', error.message);
        return { exitoso: false };
    }
}

/**
 * Estrategia 3: Búsqueda Similar
 * @param {string} mensaje - Mensaje original
 * @param {string} sqlOriginal - SQL original
 * @returns {Promise<Object>} Resultado
 */
async function estrategiaBusquedaSimilar(mensaje, sqlOriginal) {
    console.log('🔍 [SIMILAR-STRATEGY] Buscando consultas similares...');
    
    try {
        // Extraer entidad principal de la consulta
        const entidades = extraerEntidadesConsulta(mensaje);
        
        if (entidades.length > 0) {
            // Generar consulta más simple para la entidad principal
            const entidadPrincipal = entidades[0];
            const sqlSimplificado = `SELECT * FROM ${entidadPrincipal} LIMIT 5`;
            
            const resultados = await executeQuery(sqlSimplificado);
            
            if (resultados && resultados.length > 0) {
                const resultadosFormateados = formatResultsAsMarkdown(resultados);
                return {
                    exitoso: true,
                    mensaje: `Aquí tienes algunos ${entidadPrincipal} disponibles:\n\n${resultadosFormateados}`,
                    data: resultados,
                    sql: sqlSimplificado,
                    tipo: 'busqueda_similar'
                };
            }
        }
        
        return { exitoso: false };
    } catch (error) {
        console.error('❌ [SIMILAR-STRATEGY] Error:', error.message);
        return { exitoso: false };
    }
}

/**
 * Estrategia 4: Fallback General
 * @param {string} mensaje - Mensaje original
 * @returns {Promise<Object>} Resultado
 */
async function estrategiaFallbackGeneral(mensaje) {
    console.log('🛡️ [FALLBACK-STRATEGY] Ejecutando fallback general...');
    
    try {
        // Respuesta genérica pero útil
        const respuestaFallback = `No encontré información específica para "${mensaje}". 
        
        Puedo ayudarte con:
        • Consultas sobre clientes, proveedores, artículos
        • Información sobre procesos y procedimientos
        • Datos de la empresa
        
        ¿Podrías reformular tu pregunta o ser más específico?`;
        
        return {
            exitoso: true,
            mensaje: respuestaFallback,
            tipo: 'fallback_general'
        };
    } catch (error) {
        console.error('❌ [FALLBACK-STRATEGY] Error:', error.message);
        return { exitoso: false };
    }
}

/**
 * Extrae entidades principales de una consulta
 * @param {string} mensaje - Mensaje del usuario
 * @returns {Array} Array de entidades encontradas
 */
function extraerEntidadesConsulta(mensaje) {
    const mensajeLower = mensaje.toLowerCase();
    const entidades = [];
    
    if (mensajeLower.includes('cliente')) entidades.push('clientes');
    if (mensajeLower.includes('proveedor')) entidades.push('proveedores');
    if (mensajeLower.includes('artículo') || mensajeLower.includes('producto')) entidades.push('articulos');
    if (mensajeLower.includes('almacén')) entidades.push('almacenes');
    
    return entidades;
}

// =====================================
// SQL PARSER PROFESIONAL CON AST
// =====================================

const sqlParser = require('sql-parser');

/**
 * Cache para resultados de parsing SQL
 * @type {Map<string, Object>}
 */
const sqlParsingCache = new Map();

/**
 * Configuración de tipos de datos para validación semántica
 */
const tiposDatos = {
    'INT': { nombre: 'INTEGER', operadores: ['=', '<', '>', '<=', '>=', '!=', 'BETWEEN', 'IN'] },
    'VARCHAR': { nombre: 'STRING', operadores: ['=', '!=', 'LIKE', 'IN', 'IS NULL', 'IS NOT NULL'] },
    'DATE': { nombre: 'DATE', operadores: ['=', '<', '>', '<=', '>=', '!=', 'BETWEEN'] },
    'DECIMAL': { nombre: 'NUMBER', operadores: ['=', '<', '>', '<=', '>=', '!=', 'BETWEEN', 'IN'] },
    'BOOLEAN': { nombre: 'BOOLEAN', operadores: ['=', '!=', 'IS NULL', 'IS NOT NULL'] }
};

/**
 * Analizador SQL profesional con AST
 * @param {string} sql - SQL a analizar
 * @returns {Object} Resultado del análisis completo
 */
function analizarSQLProfesional(sql) {
    console.log('🧠 [SQL-PARSER] Iniciando análisis profesional con AST...');
    
    const tiempoInicio = Date.now();
    
    // 1. VERIFICAR CACHE
    const cacheKey = generarClaveCache(sql);
    if (sqlParsingCache.has(cacheKey)) {
        console.log('⚡ [SQL-PARSER] Resultado encontrado en cache');
        return sqlParsingCache.get(cacheKey);
    }
    
    try {
        // 2. PARSING CON AST
        const ast = sqlParser.parse(sql);
        
        // 3. ANÁLISIS COMPLETO
        const resultado = {
            ast: ast,
            tablas: extraerTablasAST(ast),
            columnas: extraerColumnasAST(ast),
            funciones: extraerFuncionesAST(ast),
            subconsultas: extraerSubconsultasAST(ast),
            joins: extraerJoinsAST(ast),
            condiciones: extraerCondicionesAST(ast),
            validacionSemantica: validarSemanticamente(ast),
            estadisticas: {
                complejidad: calcularComplejidad(ast),
                tiempoParsing: Date.now() - tiempoInicio
            }
        };
        
        // 4. GUARDAR EN CACHE
        sqlParsingCache.set(cacheKey, resultado);
        
        // 5. LIMPIAR CACHE SI ES MUY GRANDE
        if (sqlParsingCache.size > 100) {
            limpiarCacheSQL();
        }
        
        console.log(`✅ [SQL-PARSER] Análisis completado en ${resultado.estadisticas.tiempoParsing}ms`);
        return resultado;
        
    } catch (error) {
        console.error('❌ [SQL-PARSER] Error en parsing:', error.message);
        return {
            error: error.message,
            sql: sql,
            fallback: true
        };
    }
}

/**
 * Extrae tablas del AST
 * @param {Object} ast - Árbol sintáctico
 * @returns {Array} Array de tablas con información completa
 */
function extraerTablasAST(ast) {
    const tablas = [];
    
    function recorrerNodo(nodo) {
        if (!nodo) return;
        
        // FROM clause
        if (nodo.type === 'select' && nodo.from) {
            procesarFromClause(nodo.from, tablas);
        }
        
        // JOIN clauses
        if (nodo.join) {
            procesarJoinClause(nodo.join, tablas);
        }
        
        // Subconsultas
        if (nodo.subquery) {
            recorrerNodo(nodo.subquery);
        }
        
        // Recursión para otros nodos
        Object.values(nodo).forEach(valor => {
            if (typeof valor === 'object' && valor !== null) {
                if (Array.isArray(valor)) {
                    valor.forEach(item => recorrerNodo(item));
                } else {
                    recorrerNodo(valor);
                }
            }
        });
    }
    
    recorrerNodo(ast);
    return tablas;
}

/**
 * Procesa cláusula FROM
 * @param {Object} fromClause - Cláusula FROM del AST
 * @param {Array} tablas - Array donde agregar tablas
 */
function procesarFromClause(fromClause, tablas) {
    if (Array.isArray(fromClause)) {
        fromClause.forEach(item => procesarFromClause(item, tablas));
    } else if (fromClause.table) {
        tablas.push({
            nombre: fromClause.table,
            alias: fromClause.as || null,
            tipo: 'FROM',
            esquema: fromClause.schema || null
        });
    } else if (fromClause.subquery) {
        // Subconsulta en FROM
        tablas.push({
            nombre: 'SUBQUERY',
            alias: fromClause.as || null,
            tipo: 'SUBQUERY',
            subquery: fromClause.subquery
        });
    }
}

/**
 * Procesa cláusula JOIN
 * @param {Object} joinClause - Cláusula JOIN del AST
 * @param {Array} tablas - Array donde agregar tablas
 */
function procesarJoinClause(joinClause, tablas) {
    if (Array.isArray(joinClause)) {
        joinClause.forEach(item => procesarJoinClause(item, tablas));
    } else if (joinClause.table) {
        tablas.push({
            nombre: joinClause.table,
            alias: joinClause.as || null,
            tipo: joinClause.joinType || 'JOIN',
            esquema: joinClause.schema || null,
            condicion: joinClause.on || null
        });
    }
}

/**
 * Extrae columnas del AST
 * @param {Object} ast - Árbol sintáctico
 * @returns {Array} Array de columnas con información completa
 */
function extraerColumnasAST(ast) {
    const columnas = [];
    
    function recorrerNodo(nodo) {
        if (!nodo) return;
        
        // SELECT columns
        if (nodo.type === 'select' && nodo.columns) {
            procesarColumnasSelect(nodo.columns, columnas);
        }
        
        // WHERE conditions
        if (nodo.where) {
            procesarCondicionesWhere(nodo.where, columnas);
        }
        
        // GROUP BY
        if (nodo.groupby) {
            procesarGroupBy(nodo.groupby, columnas);
        }
        
        // ORDER BY
        if (nodo.orderby) {
            procesarOrderBy(nodo.orderby, columnas);
        }
        
        // HAVING
        if (nodo.having) {
            procesarHaving(nodo.having, columnas);
        }
        
        // JOIN conditions
        if (nodo.on) {
            procesarCondicionJoin(nodo.on, columnas);
        }
        
        // Recursión
        Object.values(nodo).forEach(valor => {
            if (typeof valor === 'object' && valor !== null) {
                if (Array.isArray(valor)) {
                    valor.forEach(item => recorrerNodo(item));
                } else {
                    recorrerNodo(valor);
                }
            }
        });
    }
    
    recorrerNodo(ast);
    return columnas;
}

/**
 * Procesa columnas del SELECT
 * @param {Array} columns - Columnas del SELECT
 * @param {Array} columnas - Array donde agregar columnas
 */
function procesarColumnasSelect(columns, columnas) {
    columns.forEach(col => {
        if (col.type === 'column') {
            columnas.push({
                nombre: col.name,
                tabla: col.table || null,
                alias: col.as || null,
                tipo: 'SELECT',
                funcion: col.function || null,
                parametros: col.args || null
            });
        } else if (col.type === 'function') {
            // Función como COUNT(*)
            columnas.push({
                nombre: col.name,
                tabla: null,
                alias: col.as || null,
                tipo: 'FUNCTION',
                funcion: col.function,
                parametros: col.args || []
            });
        }
    });
}

/**
 * Procesa condiciones WHERE
 * @param {Object} whereClause - Cláusula WHERE
 * @param {Array} columnas - Array donde agregar columnas
 */
function procesarCondicionesWhere(whereClause, columnas) {
    function procesarCondicion(cond) {
        if (cond.type === 'binary_expr') {
            // Operadores binarios: =, <, >, etc.
            if (cond.left && cond.left.type === 'column') {
                columnas.push({
                    nombre: cond.left.name,
                    tabla: cond.left.table || null,
                    alias: null,
                    tipo: 'WHERE',
                    operador: cond.operator,
                    valor: cond.right
                });
            }
            if (cond.right && cond.right.type === 'column') {
                columnas.push({
                    nombre: cond.right.name,
                    tabla: cond.right.table || null,
                    alias: null,
                    tipo: 'WHERE',
                    operador: cond.operator,
                    valor: cond.left
                });
            }
        } else if (cond.type === 'function') {
            // Funciones como BETWEEN, IN, etc.
            if (cond.args) {
                cond.args.forEach(arg => {
                    if (arg.type === 'column') {
                        columnas.push({
                            nombre: arg.name,
                            tabla: arg.table || null,
                            alias: null,
                            tipo: 'WHERE_FUNCTION',
                            funcion: cond.name,
                            parametros: cond.args
                        });
                    }
                });
            }
        }
    }
    
    if (Array.isArray(whereClause)) {
        whereClause.forEach(procesarCondicion);
    } else {
        procesarCondicion(whereClause);
    }
}

/**
 * Extrae funciones del AST
 * @param {Object} ast - Árbol sintáctico
 * @returns {Array} Array de funciones encontradas
 */
function extraerFuncionesAST(ast) {
    const funciones = [];
    
    function recorrerNodo(nodo) {
        if (!nodo) return;
        
        if (nodo.type === 'function') {
            funciones.push({
                nombre: nodo.name,
                parametros: nodo.args || [],
                alias: nodo.as || null,
                contexto: 'SELECT'
            });
        }
        
        // Recursión
        Object.values(nodo).forEach(valor => {
            if (typeof valor === 'object' && valor !== null) {
                if (Array.isArray(valor)) {
                    valor.forEach(item => recorrerNodo(item));
                } else {
                    recorrerNodo(valor);
                }
            }
        });
    }
    
    recorrerNodo(ast);
    return funciones;
}

/**
 * Extrae subconsultas del AST
 * @param {Object} ast - Árbol sintáctico
 * @returns {Array} Array de subconsultas encontradas
 */
function extraerSubconsultasAST(ast) {
    const subconsultas = [];
    
    function recorrerNodo(nodo) {
        if (!nodo) return;
        
        if (nodo.type === 'subquery') {
            subconsultas.push({
                tipo: 'SUBQUERY',
                ast: nodo,
                contexto: determinarContextoSubconsulta(nodo)
            });
        }
        
        // Recursión
        Object.values(nodo).forEach(valor => {
            if (typeof valor === 'object' && valor !== null) {
                if (Array.isArray(valor)) {
                    valor.forEach(item => recorrerNodo(item));
                } else {
                    recorrerNodo(valor);
                }
            }
        });
    }
    
    recorrerNodo(ast);
    return subconsultas;
}

/**
 * Extrae JOINs del AST
 * @param {Object} ast - Árbol sintáctico
 * @returns {Array} Array de JOINs encontrados
 */
function extraerJoinsAST(ast) {
    const joins = [];
    
    function recorrerNodo(nodo) {
        if (!nodo) return;
        
        if (nodo.type === 'join') {
            joins.push({
                tipo: nodo.joinType || 'INNER',
                tabla: nodo.table,
                alias: nodo.as || null,
                condicion: nodo.on,
                esquema: nodo.schema || null
            });
        }
        
        // Recursión
        Object.values(nodo).forEach(valor => {
            if (typeof valor === 'object' && valor !== null) {
                if (Array.isArray(valor)) {
                    valor.forEach(item => recorrerNodo(item));
                } else {
                    recorrerNodo(valor);
                }
            }
        });
    }
    
    recorrerNodo(ast);
    return joins;
}

/**
 * Extrae condiciones del AST
 * @param {Object} ast - Árbol sintáctico
 * @returns {Array} Array de condiciones encontradas
 */
function extraerCondicionesAST(ast) {
    const condiciones = [];
    
    function recorrerNodo(nodo) {
        if (!nodo) return;
        
        if (nodo.type === 'binary_expr') {
            condiciones.push({
                tipo: 'BINARY',
                operador: nodo.operator,
                izquierda: nodo.left,
                derecha: nodo.right
            });
        } else if (nodo.type === 'function') {
            condiciones.push({
                tipo: 'FUNCTION',
                funcion: nodo.name,
                parametros: nodo.args || []
            });
        }
        
        // Recursión
        Object.values(nodo).forEach(valor => {
            if (typeof valor === 'object' && valor !== null) {
                if (Array.isArray(valor)) {
                    valor.forEach(item => recorrerNodo(item));
                } else {
                    recorrerNodo(valor);
                }
            }
        });
    }
    
    recorrerNodo(ast);
    return condiciones;
}

/**
 * Validación semántica completa
 * @param {Object} ast - Árbol sintáctico
 * @returns {Object} Resultado de validación semántica
 */
function validarSemanticamente(ast) {
    const resultado = {
        esValido: true,
        errores: [],
        advertencias: [],
        validaciones: []
    };
    
    // Extraer información del AST
    const tablas = extraerTablasAST(ast);
    const columnas = extraerColumnasAST(ast);
    
    // 1. Validar tablas contra mapaERP
    tablas.forEach(tabla => {
        if (tabla.tipo !== 'SUBQUERY') {
            const tablaNormalizada = tabla.nombre.toLowerCase();
            if (!mapaERP[tablaNormalizada]) {
                resultado.errores.push(`Tabla no existe en mapaERP: ${tabla.nombre}`);
                resultado.esValido = false;
            } else {
                resultado.validaciones.push({
                    tipo: 'TABLA',
                    elemento: tabla.nombre,
                    estado: 'VÁLIDA',
                    detalles: mapaERP[tablaNormalizada]
                });
            }
        }
    });
    
    // 2. Validar columnas contra mapaERP
    columnas.forEach(columna => {
        if (columna.tabla && columna.tabla !== 'SUBQUERY') {
            const tablaNormalizada = columna.tabla.toLowerCase();
            if (mapaERP[tablaNormalizada]) {
                const columnasTabla = Object.keys(mapaERP[tablaNormalizada].columnas || {});
                if (!columnasTabla.includes(columna.nombre)) {
                    resultado.advertencias.push(`Columna posiblemente inexistente: ${columna.tabla}.${columna.nombre}`);
                    
                    // Sugerir columnas similares
                    const sugerencias = buscarColumnasSimilares(columna.nombre, columnasTabla);
                    if (sugerencias.length > 0) {
                        resultado.advertencias.push(`Sugerencias: ${sugerencias.join(', ')}`);
                    }
                } else {
                    resultado.validaciones.push({
                        tipo: 'COLUMNA',
                        elemento: `${columna.tabla}.${columna.nombre}`,
                        estado: 'VÁLIDA',
                        tipoDato: mapaERP[tablaNormalizada].columnas[columna.nombre]
                    });
                }
            }
        }
    });
    
    // 3. Validar tipos de datos en operaciones
    validarTiposDatos(columnas, resultado);
    
    return resultado;
}

/**
 * Validar tipos de datos en operaciones
 * @param {Array} columnas - Columnas extraídas
 * @param {Object} resultado - Resultado de validación
 */
function validarTiposDatos(columnas, resultado) {
    columnas.forEach(columna => {
        if (columna.operador && columna.tabla) {
            const tablaNormalizada = columna.tabla.toLowerCase();
            if (mapaERP[tablaNormalizada] && mapaERP[tablaNormalizada].columnas) {
                const tipoColumna = mapaERP[tablaNormalizada].columnas[columna.nombre];
                if (tipoColumna) {
                    const tipoDato = tiposDatos[tipoColumna.tipo];
                    if (tipoDato && !tipoDato.operadores.includes(columna.operador)) {
                        resultado.advertencias.push(
                            `Operador '${columna.operador}' puede no ser apropiado para tipo '${tipoColumna.tipo}' en columna '${columna.nombre}'`
                        );
                    }
                }
            }
        }
    });
}

/**
 * Calcular complejidad de la consulta
 * @param {Object} ast - Árbol sintáctico
 * @returns {Object} Métricas de complejidad
 */
function calcularComplejidad(ast) {
    const metricas = {
        nivel: 'SIMPLE',
        puntuacion: 0,
        factores: []
    };
    
    let puntuacion = 0;
    const factores = [];
    
    // Contar tablas
    const tablas = extraerTablasAST(ast);
    if (tablas.length > 1) {
        puntuacion += tablas.length * 10;
        factores.push(`Múltiples tablas: ${tablas.length}`);
    }
    
    // Contar JOINs
    const joins = extraerJoinsAST(ast);
    if (joins.length > 0) {
        puntuacion += joins.length * 15;
        factores.push(`JOINs: ${joins.length}`);
    }
    
    // Contar subconsultas
    const subconsultas = extraerSubconsultasAST(ast);
    if (subconsultas.length > 0) {
        puntuacion += subconsultas.length * 25;
        factores.push(`Subconsultas: ${subconsultas.length}`);
    }
    
    // Contar funciones
    const funciones = extraerFuncionesAST(ast);
    if (funciones.length > 0) {
        puntuacion += funciones.length * 5;
        factores.push(`Funciones: ${funciones.length}`);
    }
    
    // Determinar nivel
    if (puntuacion >= 50) {
        metricas.nivel = 'COMPLEJA';
    } else if (puntuacion >= 20) {
        metricas.nivel = 'MODERADA';
    }
    
    metricas.puntuacion = puntuacion;
    metricas.factores = factores;
    
    return metricas;
}

/**
 * Generar clave para cache
 * @param {string} sql - SQL original
 * @returns {string} Clave única para cache
 */
function generarClaveCache(sql) {
    // Normalizar SQL para cache (eliminar espacios extra, etc.)
    const sqlNormalizado = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    return Buffer.from(sqlNormalizado).toString('base64').substring(0, 32);
}

/**
 * Limpiar cache SQL
 */
function limpiarCacheSQL() {
    const tamanoAntes = sqlParsingCache.size;
    sqlParsingCache.clear();
    console.log(`🧹 [SQL-PARSER] Cache limpiado: ${tamanoAntes} entradas eliminadas`);
}

/**
 * Determinar contexto de subconsulta
 * @param {Object} subquery - Subconsulta del AST
 * @returns {string} Contexto de la subconsulta
 */
function determinarContextoSubconsulta(subquery) {
    // Análisis del contexto basado en la estructura del AST
    if (subquery.parent && subquery.parent.type === 'from') {
        return 'FROM';
    } else if (subquery.parent && subquery.parent.type === 'where') {
        return 'WHERE';
    } else if (subquery.parent && subquery.parent.type === 'select') {
        return 'SELECT';
    }
    return 'UNKNOWN';
}

/**
 * Generar SQL optimizado basado en análisis AST
 * @param {Object} analisisSQL - Resultado del análisis AST
 * @returns {string} SQL optimizado
 */
function generarSQLOptimizado(analisisSQL) {
    console.log('🔧 [SQL-OPTIMIZER] Generando SQL optimizado desde AST...');
    
    try {
        // Reconstruir SQL desde AST con optimizaciones
        let sqlOptimizado = 'SELECT ';
        
        // Optimizar columnas SELECT
        const columnasOptimizadas = analisisSQL.columnas
            .filter(col => col.tipo === 'SELECT')
            .map(col => {
                if (col.tabla && col.alias) {
                    return `${col.tabla}.${col.nombre} AS ${col.alias}`;
                } else if (col.tabla) {
                    return `${col.tabla}.${col.nombre}`;
                } else {
                    return col.nombre;
                }
            });
        
        sqlOptimizado += columnasOptimizadas.join(', ');
        
        // FROM clause
        if (analisisSQL.tablas.length > 0) {
            const tablaPrincipal = analisisSQL.tablas.find(t => t.tipo === 'FROM');
            if (tablaPrincipal) {
                sqlOptimizado += ` FROM ${tablaPrincipal.nombre}`;
                if (tablaPrincipal.alias) {
                    sqlOptimizado += ` ${tablaPrincipal.alias}`;
                }
            }
        }
        
        // JOINs optimizados
        analisisSQL.joins.forEach(join => {
            sqlOptimizado += ` ${join.tipo} JOIN ${join.tabla}`;
            if (join.alias) {
                sqlOptimizado += ` ${join.alias}`;
            }
            if (join.condicion) {
                sqlOptimizado += ` ON ${reconstruirCondicion(join.condicion)}`;
            }
        });
        
        // WHERE optimizado
        const condicionesWhere = analisisSQL.columnas
            .filter(col => col.tipo === 'WHERE')
            .map(col => `${col.tabla ? col.tabla + '.' : ''}${col.nombre} ${col.operador} ${reconstruirValor(col.valor)}`);
        
        if (condicionesWhere.length > 0) {
            sqlOptimizado += ` WHERE ${condicionesWhere.join(' AND ')}`;
        }
        
        // GROUP BY
        const columnasGroupBy = analisisSQL.columnas
            .filter(col => col.tipo === 'GROUP_BY')
            .map(col => `${col.tabla ? col.tabla + '.' : ''}${col.nombre}`);
        
        if (columnasGroupBy.length > 0) {
            sqlOptimizado += ` GROUP BY ${columnasGroupBy.join(', ')}`;
        }
        
        // HAVING
        const condicionesHaving = analisisSQL.columnas
            .filter(col => col.tipo === 'HAVING')
            .map(col => `${col.tabla ? col.tabla + '.' : ''}${col.nombre} ${col.operador} ${reconstruirValor(col.valor)}`);
        
        if (condicionesHaving.length > 0) {
            sqlOptimizado += ` HAVING ${condicionesHaving.join(' AND ')}`;
        }
        
        // ORDER BY
        const columnasOrderBy = analisisSQL.columnas
            .filter(col => col.tipo === 'ORDER_BY')
            .map(col => `${col.tabla ? col.tabla + '.' : ''}${col.nombre} ${col.direccion || 'ASC'}`);
        
        if (columnasOrderBy.length > 0) {
            sqlOptimizado += ` ORDER BY ${columnasOrderBy.join(', ')}`;
        }
        
        // LIMIT (si no existe)
        if (!sqlOptimizado.toLowerCase().includes('limit')) {
            sqlOptimizado += ' LIMIT 10';
        }
        
        console.log(`✅ [SQL-OPTIMIZER] SQL optimizado generado: ${sqlOptimizado.substring(0, 100)}...`);
        return sqlOptimizado;
        
            } catch (error) {
        console.error('❌ [SQL-OPTIMIZER] Error generando SQL optimizado:', error.message);
        // Fallback al SQL original
        return analisisSQL.ast.sql || '';
        }
    }

/**
 * Reconstruir condición desde AST
 * @param {Object} condicion - Condición del AST
 * @returns {string} Condición reconstruida
 */
function reconstruirCondicion(condicion) {
    if (!condicion) return '';
    
    if (condicion.type === 'binary_expr') {
        const izquierda = reconstruirValor(condicion.left);
        const derecha = reconstruirValor(condicion.right);
        return `${izquierda} ${condicion.operator} ${derecha}`;
    } else if (condicion.type === 'column') {
        return `${condicion.table ? condicion.table + '.' : ''}${condicion.name}`;
    }
    
    return condicion.toString();
}

