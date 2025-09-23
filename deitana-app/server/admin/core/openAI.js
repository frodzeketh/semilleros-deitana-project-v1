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
console.log('\n🔍 ==========================================');
console.log('🔍 VERIFICACIÓN DE IMPORTACIONES');
console.log('🔍 ==========================================');
console.log(`📄 promptGlobal: ${promptGlobal ? 'OK' : 'ERROR'} - ${promptGlobal ? promptGlobal.length : 0} caracteres`);
console.log(`📄 comportamientoGlobal: ${comportamientoGlobal ? 'OK' : 'ERROR'} - ${comportamientoGlobal ? comportamientoGlobal.length : 0} caracteres`);
console.log(`📄 formatoRespuesta: ${formatoRespuesta ? 'OK' : 'ERROR'} - ${formatoRespuesta ? formatoRespuesta.length : 0} caracteres`);
console.log(`📄 guiaMarkdownCompleta: ${guiaMarkdownCompleta ? 'OK' : 'ERROR'} - ${guiaMarkdownCompleta ? guiaMarkdownCompleta.length : 0} caracteres`);
console.log(`📄 identidadEmpresa: ${identidadEmpresa ? 'OK' : 'ERROR'} - ${identidadEmpresa ? identidadEmpresa.length : 0} caracteres`);
console.log(`📄 terminologia: ${terminologia ? 'OK' : 'ERROR'} - ${terminologia ? terminologia.length : 0} caracteres`);
console.log('🔍 ==========================================\n');

// Importar sistema RAG
const ragInteligente = require('../data/integrar_rag_nuevo');
// Removido: analizarIntencionConIA no se usa - usamos analizarIntencionInteligente local

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
 * Sistema de TO-DO LIST para trackear tareas y errores
 */
class TodoListManager {
    constructor() {
        this.todos = new Map();
        this.nextId = 1;
    }

    addTodo(description, priority = 'medium', context = '') {
        const id = `todo_${this.nextId++}`;
        const todo = {
            id,
            description,
            priority,
            context,
            status: 'pending',
            createdAt: new Date(),
            attempts: 0,
            lastError: null
        };
        this.todos.set(id, todo);
        console.log(`📋 [TODO] Agregado: ${description} (${priority})`);
        return id;
    }

    updateTodo(id, updates) {
        if (this.todos.has(id)) {
            const todo = this.todos.get(id);
            Object.assign(todo, updates, { updatedAt: new Date() });
            console.log(`📋 [TODO] Actualizado: ${todo.description} -> ${updates.status || 'actualizado'}`);
        }
    }

    getTodos(status = null) {
        const todoList = Array.from(this.todos.values());
        return status ? todoList.filter(t => t.status === status) : todoList;
    }

    markCompleted(id, result = null) {
        this.updateTodo(id, { status: 'completed', result, completedAt: new Date() });
    }

    markFailed(id, error, shouldRetry = true) {
        const todo = this.todos.get(id);
        if (todo) {
            todo.attempts++;
            todo.lastError = error;
            todo.status = shouldRetry && todo.attempts < 3 ? 'retry' : 'failed';
            console.log(`📋 [TODO] Error en: ${todo.description} (intento ${todo.attempts})`);
        }
    }

    getSystemStatus() {
        const todos = this.getTodos();
        const stats = {
            total: todos.length,
            pending: todos.filter(t => t.status === 'pending').length,
            in_progress: todos.filter(t => t.status === 'in_progress').length,
            completed: todos.filter(t => t.status === 'completed').length,
            failed: todos.filter(t => t.status === 'failed').length,
            retry: todos.filter(t => t.status === 'retry').length
        };

        return {
            stats,
            recentTodos: todos.slice(-10), // Últimos 10 TODOs
            failedTodos: todos.filter(t => t.status === 'failed'),
            retryTodos: todos.filter(t => t.status === 'retry')
        };
    }

    generateStatusReport() {
        const status = this.getSystemStatus();
        
        let report = `
📋 **ESTADO DEL SISTEMA - GESTOR DE TAREAS**

📊 **Estadísticas:**
- Total de tareas: ${status.stats.total}
- ✅ Completadas: ${status.stats.completed}
- 🔄 En progreso: ${status.stats.in_progress}
- ⏳ Pendientes: ${status.stats.pending}
- ❌ Fallidas: ${status.stats.failed}
- 🔁 Para reintentar: ${status.stats.retry}

`;

        if (status.failedTodos.length > 0) {
            report += `\n🚨 **TAREAS FALLIDAS RECIENTES:**\n`;
            status.failedTodos.slice(-5).forEach((todo, index) => {
                report += `${index + 1}. ${todo.description}\n   Error: ${todo.lastError}\n   Intentos: ${todo.attempts}\n\n`;
            });
        }

        if (status.retryTodos.length > 0) {
            report += `\n🔄 **TAREAS PARA REINTENTAR:**\n`;
            status.retryTodos.forEach((todo, index) => {
                report += `${index + 1}. ${todo.description} (Intento ${todo.attempts + 1}/3)\n`;
            });
        }

        return report;
    }

    clearOldTodos(maxAge = 24 * 60 * 60 * 1000) { // 24 horas por defecto
        const now = Date.now();
        let removed = 0;
        
        for (const [id, todo] of this.todos.entries()) {
            if (todo.status === 'completed' && (now - todo.createdAt.getTime()) > maxAge) {
                this.todos.delete(id);
                removed++;
            }
        }
        
        if (removed > 0) {
            console.log(`🧹 [TODO-CLEANUP] Eliminadas ${removed} tareas completadas antiguas`);
        }
        
        return removed;
    }
}

// Instancia global del gestor de TODOs
const todoManager = new TodoListManager();

/**
 * Sistema inteligente de análisis de errores SQL
 */
class SQLErrorAnalyzer {
    static analyzeError(error, sql, context = '') {
        const errorMsg = error.message.toLowerCase();
        
        const analysis = {
            type: 'unknown',
            severity: 'medium',
            suggestions: [],
            canRetry: false,
            alternativeStrategies: []
        };

        // Análisis de tipos de error
        if (errorMsg.includes("table") && errorMsg.includes("doesn't exist")) {
            analysis.type = 'table_not_found';
            analysis.severity = 'high';
            analysis.suggestions = [
                'Verificar nombres de tablas en mapaERP',
                'Usar búsqueda fuzzy para encontrar tabla similar',
                'Consultar RAG para información sobre estructura'
            ];
            analysis.alternativeStrategies = ['fuzzy_search', 'rag_consultation'];
        }
        
        else if (errorMsg.includes("unknown column")) {
            analysis.type = 'column_not_found';
            analysis.severity = 'high';
            analysis.suggestions = [
                'Verificar nombres de columnas en mapaERP',
                'Buscar columnas similares en la tabla',
                'Consultar documentación de la tabla'
            ];
            analysis.alternativeStrategies = ['column_search', 'table_description'];
        }
        
        else if (errorMsg.includes("syntax error")) {
            analysis.type = 'syntax_error';
            analysis.severity = 'medium';
            analysis.canRetry = true;
            analysis.suggestions = [
                'Corregir sintaxis SQL',
                'Simplificar consulta',
                'Usar formato básico SELECT FROM WHERE'
            ];
            analysis.alternativeStrategies = ['syntax_correction', 'query_simplification'];
        }
        
        else if (errorMsg.includes("access denied") || errorMsg.includes("permission")) {
            analysis.type = 'permission_error';
            analysis.severity = 'high';
            analysis.suggestions = [
                'Error de permisos en base de datos',
                'Contactar administrador del sistema'
            ];
        }

        return analysis;
    }

    static generateAlternativeQuery(originalSql, errorAnalysis, mapaERP) {
        switch (errorAnalysis.type) {
            case 'table_not_found':
                return this.suggestSimilarTable(originalSql, mapaERP);
            case 'column_not_found':
                return this.suggestSimilarColumns(originalSql, mapaERP);
            case 'syntax_error':
                return this.simplifyQuery(originalSql);
            default:
                return null;
        }
    }

    static suggestSimilarTable(sql, mapaERP) {
        // Extraer nombre de tabla del SQL
        const tableMatch = sql.match(/FROM\s+(\w+)/i);
        if (!tableMatch) return null;

        const requestedTable = tableMatch[1].toLowerCase();
        const availableTables = Object.keys(mapaERP);
        
        // Buscar tabla más similar
        let bestMatch = null;
        let bestScore = 0;
        
        for (const table of availableTables) {
            const score = this.calculateSimilarity(requestedTable, table.toLowerCase());
            if (score > bestScore && score > 0.3) {
                bestScore = score;
                bestMatch = table;
            }
        }

        if (bestMatch) {
            return sql.replace(new RegExp(requestedTable, 'gi'), bestMatch);
        }
        return null;
    }

    static calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    static levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    static simplifyQuery(sql) {
        // Simplificar consulta removiendo elementos complejos
        let simplified = sql;
        
        // Remover JOINs complejos
        simplified = simplified.replace(/\s+(LEFT|RIGHT|INNER|OUTER)?\s*JOIN[\s\S]*?ON[\s\S]*?(?=WHERE|GROUP|ORDER|LIMIT|$)/gi, '');
        
        // Simplificar SELECT si es muy complejo
        if (simplified.includes('COUNT') || simplified.includes('SUM') || simplified.includes('AVG')) {
            simplified = simplified.replace(/SELECT[\s\S]*?FROM/i, 'SELECT * FROM');
        }
        
        return simplified;
    }
}

/**
 * Función para ejecutar consultas SQL con sistema inteligente de manejo de errores
 * @param {string} sql - Consulta SQL a ejecutar
 * @param {string} originalQuery - Consulta original del usuario
 * @param {number} attempt - Número de intento (para reintentos)
 * @returns {Promise<Array>} Resultados de la consulta
 */
async function executeQuery(sql, originalQuery = '', attempt = 1) {
    const todoId = todoManager.addTodo(`Ejecutar SQL: ${sql.substring(0, 50)}...`, 'high', originalQuery);
    
    try {
        // Reemplazar los nombres de las tablas con sus nombres reales
        const sqlModificado = reemplazarNombresTablas(sql);
        console.log(`🔍 [SQL-EXEC] Intento ${attempt} - Ejecutando:`, sqlModificado);
        
        todoManager.updateTodo(todoId, { status: 'executing', sql: sqlModificado });
        
        const [rows] = await pool.query(sqlModificado);
        console.log('📊 [SQL-RESULT] Filas devueltas:', rows.length);
        
        if (rows.length === 0) {
            console.log('⚠️ [SQL-RESULT] La consulta no devolvió resultados');
            todoManager.updateTodo(todoId, { status: 'completed', result: 'no_results' });
            return [];
        }

        todoManager.markCompleted(todoId, { rowCount: rows.length });
        return rows;
        
    } catch (error) {
        console.error(`❌ [SQL-EXEC] Error en intento ${attempt}:`, error.message);
        console.error('❌ [SQL-EXEC] SQL:', sql);
        
        // Análisis inteligente del error
        const errorAnalysis = SQLErrorAnalyzer.analyzeError(error, sql, originalQuery);
        console.log('🧠 [ERROR-ANALYSIS] Análisis:', errorAnalysis);
        
        // Agregar TODO para análisis del error
        const analysisId = todoManager.addTodo(
            `Analizar error SQL: ${errorAnalysis.type}`, 
            'high', 
            `Error: ${error.message}\nSQL: ${sql}`
        );
        
        // Si es posible reintentar y no hemos agotado los intentos
        if (attempt < 3 && errorAnalysis.alternativeStrategies.length > 0) {
            console.log(`🔄 [RETRY] Intentando estrategia alternativa...`);
            
            // Generar consulta alternativa
            const alternativeSql = SQLErrorAnalyzer.generateAlternativeQuery(sql, errorAnalysis, mapaERP);
            
            if (alternativeSql && alternativeSql !== sql) {
                console.log('🔄 [RETRY] Consulta alternativa generada:', alternativeSql);
                todoManager.markCompleted(analysisId, { strategy: 'alternative_query', newSql: alternativeSql });
                
                // Reintento recursivo
                return await executeQuery(alternativeSql, originalQuery, attempt + 1);
            }
        }
        
        todoManager.markFailed(todoId, error.message, false);
        todoManager.markFailed(analysisId, 'No se pudo generar alternativa', false);
        
        // Si llegamos aquí, el error no se pudo resolver
        throw new EnhancedSQLError(error.message, errorAnalysis, sql, originalQuery, attempt);
    }
}

/**
 * Clase de error mejorada para SQL con análisis inteligente
 */
class EnhancedSQLError extends Error {
    constructor(message, analysis, sql, originalQuery, attempts) {
        super(message);
        this.name = 'EnhancedSQLError';
        this.analysis = analysis;
        this.sql = sql;
        this.originalQuery = originalQuery;
        this.attempts = attempts;
        this.timestamp = new Date();
    }

    getIntelligentResponse() {
        const suggestions = this.analysis.suggestions.join('\n- ');
        
        return `
🚨 **Error en consulta SQL**

**Problema detectado:** ${this.analysis.type}
**Severidad:** ${this.analysis.severity}

**Análisis del error:**
- ${suggestions}

**¿Qué puedes hacer?**
${this.analysis.type === 'table_not_found' ? 
    '- Verifica que el nombre de la tabla sea correcto\n- Consulta la lista de tablas disponibles\n- Usa términos más generales en tu búsqueda' :
    this.analysis.type === 'column_not_found' ?
    '- Revisa los nombres de las columnas disponibles\n- Simplifica tu consulta\n- Describe lo que buscas de forma más general' :
    '- Reformula tu pregunta de manera más simple\n- Proporciona más contexto sobre lo que necesitas'
}

💡 **Sugerencia:** Puedo ayudarte a reformular tu consulta. ¿Podrías describir qué información específica necesitas?
        `;
    }
}

/**
 * Genera una respuesta inteligente cuando hay errores SQL usando RAG y análisis
 */
async function generateIntelligentErrorResponse(originalQuery, sqlError, ragContext, failedTodos) {
    try {
        console.log('🧠 [INTELLIGENT-RESPONSE] Generando respuesta inteligente...');
        
        // Construir contexto del error con TODOs fallidos
        const errorContext = failedTodos.map(todo => 
            `- ${todo.description}: ${todo.lastError}`
        ).join('\n');
        
        const intelligentPrompt = `
Eres un asistente experto en análisis de errores y resolución de problemas. Un usuario hizo una consulta que falló y necesitas proporcionar una respuesta inteligente y útil.

## 🔍 INFORMACIÓN DEL ERROR:

**Consulta original del usuario:** "${originalQuery}"
**Tipo de error:** ${sqlError.analysis.type}
**Severidad:** ${sqlError.analysis.severity}
**Intentos realizados:** ${sqlError.attempts}
**Mensaje de error técnico:** ${sqlError.message}

## 📚 CONOCIMIENTO EMPRESARIAL RELEVANTE:
${ragContext}

## 📋 ANÁLISIS DE FALLOS RECIENTES:
${errorContext}

## 🎯 TU MISIÓN:

1. **EXPLICA** de forma clara qué salió mal y por qué
2. **PROPORCIONA** información útil usando el conocimiento empresarial
3. **SUGIERE** alternativas prácticas para obtener la información
4. **MANTÉN** un tono empático y profesional

## ⚡ INSTRUCCIONES CRÍTICAS:

- NO menciones detalles técnicos de SQL o bases de datos
- SÍ explica qué información específica puede estar disponible
- USA el conocimiento empresarial para dar contexto útil
- OFRECE alternativas concretas y prácticas
- Mantén un tono natural y empático, no robótico

## 🚀 FORMATO DE RESPUESTA:

Estructura tu respuesta así:
1. Reconocimiento empático del problema
2. Explicación clara de qué información tienes disponible
3. Sugerencias específicas de cómo obtener lo que necesita
4. Pregunta de seguimiento para ayudar mejor

Ejemplo de tono: "Entiendo que buscas información sobre [tema]. Aunque no pude acceder a esos datos específicos, puedo ayudarte con [alternativas]. Te sugiero que..."

RESPONDE DIRECTAMENTE COMO SI FUERAS CHATGPT:
`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: intelligentPrompt
                },
                {
                    role: 'user',
                    content: originalQuery
                }
            ],
            max_tokens: 1500,
            temperature: 0.7,
            top_p: 0.9,
            frequency_penalty: 0.3,
            presence_penalty: 0.3
        });

        return response.choices[0].message.content;
        
    } catch (error) {
        console.error('❌ [INTELLIGENT-RESPONSE] Error generando respuesta:', error.message);
        return null;
    }
}

/**
 * Sistema de búsqueda alternativa cuando SQL falla
 */
async function attemptFallbackSearch(originalQuery, errorAnalysis, ragContext) {
    console.log('🔍 [FALLBACK-SEARCH] Intentando búsqueda alternativa...');
    
    const fallbackTodoId = todoManager.addTodo(
        `Búsqueda alternativa para: ${originalQuery.substring(0, 30)}...`, 
        'medium', 
        `Error original: ${errorAnalysis.type}`
    );
    
    try {
        // Estrategia 1: Buscar información general en RAG
        if (ragContext && ragContext.length > 50) {
            console.log('✅ [FALLBACK-SEARCH] Usando información de RAG como alternativa');
            todoManager.markCompleted(fallbackTodoId, { strategy: 'rag_info' });
            return ragContext;
        }
        
        // Estrategia 2: Sugerir consultas más simples
        const simplifiedSuggestions = generateSimplifiedQueries(originalQuery);
        if (simplifiedSuggestions.length > 0) {
            console.log('✅ [FALLBACK-SEARCH] Generando sugerencias simplificadas');
            todoManager.markCompleted(fallbackTodoId, { strategy: 'simplified_queries' });
            
            return `
No pude acceder a la información específica que solicitas, pero puedo ayudarte de estas formas:

${simplifiedSuggestions.map((suggestion, index) => 
    `${index + 1}. ${suggestion}`
).join('\n')}

¿Te gustaría que intentemos con alguna de estas alternativas?
            `;
        }
        
        todoManager.markFailed(fallbackTodoId, 'No se encontraron alternativas', false);
        return null;
        
    } catch (error) {
        console.error('❌ [FALLBACK-SEARCH] Error en búsqueda alternativa:', error.message);
        todoManager.markFailed(fallbackTodoId, error.message, false);
        return null;
    }
}

/**
 * Genera consultas simplificadas basadas en la consulta original
 */
function generateSimplifiedQueries(originalQuery) {
    const suggestions = [];
    const query = originalQuery.toLowerCase();
    
    // Detectar entidades comunes y sugerir alternativas
    if (query.includes('cliente') || query.includes('clientes')) {
        suggestions.push('Mostrar lista general de clientes');
        suggestions.push('Buscar cliente por nombre específico');
        suggestions.push('Consultar clientes por provincia');
    }
    
    if (query.includes('partida') || query.includes('partidas')) {
        suggestions.push('Ver partidas recientes');
        suggestions.push('Consultar partidas por tipo de planta');
        suggestions.push('Buscar partidas por fecha');
    }
    
    if (query.includes('técnico') || query.includes('tecnicos')) {
        suggestions.push('Lista de técnicos disponibles');
        suggestions.push('Consultar técnicos por zona');
    }
    
    if (query.includes('producto') || query.includes('articulo')) {
        suggestions.push('Ver catálogo de productos');
        suggestions.push('Buscar productos por tipo');
        suggestions.push('Consultar precios de productos');
    }
    
    // Si no se detectan entidades específicas, dar sugerencias generales
    if (suggestions.length === 0) {
        suggestions.push('Reformular la pregunta de forma más simple');
        suggestions.push('Especificar qué tipo de información necesitas');
        suggestions.push('Proporcionar más contexto sobre tu consulta');
    }
    
    return suggestions;
}

/**
 * Detecta si la consulta es sobre el estado del sistema
 */
function isSystemStatusQuery(query) {
    const statusKeywords = [
        'estado del sistema', 'estado sistema', 'como estas', 'cómo estás',
        'estado del asistente', 'estado asistente', 'todo list', 'todo-list',
        'tareas pendientes', 'errores del sistema', 'qué tal funciona',
        'como funciona el sistema', 'estado de la ia', 'estado ia',
        'diagnostico', 'diagnóstico', 'salud del sistema', 'monitoreo',
        'estadisticas del sistema', 'estadísticas', 'metricas', 'métricas'
    ];
    
    const queryLower = query.toLowerCase();
    return statusKeywords.some(keyword => queryLower.includes(keyword));
}

/**
 * Limpieza automática de TODOs antiguos (ejecutar periódicamente)
 */
function performSystemMaintenance() {
    console.log('🧹 [MAINTENANCE] Iniciando mantenimiento del sistema...');
    
    // Limpiar TODOs completados de más de 24 horas
    const removedTodos = todoManager.clearOldTodos();
    
    // Reintentar TODOs marcados para reintento
    const retryTodos = todoManager.getTodos('retry');
    console.log(`🔄 [MAINTENANCE] ${retryTodos.length} tareas marcadas para reintento`);
    
    // Log de estadísticas del sistema
    const systemStatus = todoManager.getSystemStatus();
    console.log('📊 [MAINTENANCE] Estadísticas del sistema:', systemStatus.stats);
    
    return {
        removedTodos,
        retryTodos: retryTodos.length,
        systemStats: systemStatus.stats
    };
}

// Ejecutar mantenimiento cada hora
setInterval(performSystemMaintenance, 60 * 60 * 1000);

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
        }, { merge: false });

        return true;
    } catch (error) {
        console.error('Error al guardar mensaje en Firestore:', error);
        return false;
    }
}

// Función para guardar mensaje del asistente en Firestore
async function saveAssistantMessageToFirestore(userId, message, trace = null, conversationId = null) {
    try {
        const now = new Date();
        const messageData = {
            content: message,
            role: 'assistant',
            timestamp: now,
            trace: trace // Incluir el trace del thinking
        };
        
        console.log('💾 [FIRESTORE] Guardando mensaje del asistente:', {
            userId,
            content: message.substring(0, 100) + '...',
            hasTrace: !!trace,
            trace: trace
        });

        const userChatRef = chatManager.chatsCollection.doc(userId);
        const conversationRef = userChatRef.collection('conversations').doc(conversationId || 'admin_conversation');
        
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
        }, { merge: false });

        console.log(`✅ [FIRESTORE] Mensaje guardado. Total mensajes: ${messages.length}`);
        return true;
    } catch (error) {
        console.error('Error al guardar mensaje del asistente en Firestore:', error);
        
        // Si el error es por tamaño, intentar limpiar la conversación
        if (error.message && error.message.includes('exceeds the maximum allowed size')) {
            console.log('🔄 [FIRESTORE] Intentando limpiar conversación por tamaño...');
            try {
                const userChatRef = chatManager.chatsCollection.doc(userId);
                const conversationRef = userChatRef.collection('conversations').doc(conversationId || 'admin_conversation');
                
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
            content: msg.content,
            trace: msg.trace // Incluir el trace del thinking
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
    console.log('🔍 [FLUJO] Usando processQueryStream (STREAMING) - openAI.js');
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
        // VERIFICAR SI ES CONSULTA SOBRE ESTADO DEL SISTEMA
        // =====================================
        
        if (isSystemStatusQuery(message)) {
            console.log('📋 [SYSTEM-STATUS] Consulta sobre estado del sistema detectada');
            
            const statusReport = todoManager.generateStatusReport();
            const systemInfo = `
🤖 **ESTADO GENERAL DEL ASISTENTE IA**

El sistema está funcionando correctamente con las siguientes capacidades activas:
- ✅ Análisis inteligente de consultas
- ✅ Ejecución de SQL con reintentos automáticos
- ✅ Sistema RAG para conocimiento empresarial [[memory:6759625]]
- ✅ Manejo inteligente de errores
- ✅ Gestor de tareas (TO-DO List)

${statusReport}

💡 **Funcionalidades disponibles:**
- Consultas sobre clientes, partidas, técnicos, productos
- Análisis de datos empresariales
- Recuperación automática de errores
- Sugerencias inteligentes cuando algo falla

¿Hay algo específico sobre el sistema que te gustaría saber?
            `;

            // Enviar respuesta directamente
            response.writeHead(200, {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            response.write(JSON.stringify({
                type: 'end',
                fullResponse: systemInfo,
                conversationId: conversationId,
                tokenCount: 0,
                timestamp: Date.now()
            }) + '\n');

            response.end();

            // Guardar en historial (async)
            if (conversationId) {
                chatManager.addMessageToConversation(userId, conversationId, {
                    role: 'assistant',
                    content: systemInfo
                }).catch(err => console.error('❌ [CHAT-HISTORY] Error:', err.message));
            }

            return { success: true, streamed: true, conversationId, systemStatus: true };
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

            // Variables para tracking del thinking
            let thinkingDetected = false;
            let thinkingContent = '';
            let insideThinking = false;
            let thinkingHeaderSent = false;
            let beforeThinkingContent = '';
            const tituloBreve = generarTituloBreve(message);

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
                        
                        console.log('\n✅ ==========================================');
                        console.log('✅ SQL EJECUTADO EXITOSAMENTE');
                        console.log('✅ ==========================================');
                        console.log(`✅ Resultados obtenidos: ${Array.isArray(results) ? results.length : results.length} registros`);
                        console.log('✅ Iniciando segunda llamada para formatear datos...');
                        console.log('✅ ==========================================\n');
                        
                        // Segunda llamada a la IA para explicar los datos reales de forma natural
                        // Segunda llamada específica para explicar datos (SIN sqlRules)
                        console.log('\n🔄 ==========================================');
                        console.log('🔄 FORMATEADOR DE DATOS - LLAMADA 2');
                        console.log('🔄 ==========================================');
                        console.log('🔄 Construyendo segunda llamada para explicar datos...');
                        console.log('🔄 Aplicando formato natural y análisis inteligente...');
                        console.log('🔄 ==========================================\n');
                        
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
                        
                        // ⚡ CONSTRUIR SEGUNDA LLAMADA CON MÁXIMA PRIORIDAD CHATGPT
                        let promptExplicacion = `${promptGlobalConFecha}\n`;
                        promptExplicacion += `${comportamientoGlobal}\n\n`;
                        console.log('🔍 [DEBUG] formatoRespuesta antes de concatenar:', typeof formatoRespuesta, formatoRespuesta ? formatoRespuesta.length : 'UNDEFINED');
                        promptExplicacion += `${formatoRespuesta}\n\n`;      // ⚡ FORMATO DE RESPUESTA
                        console.log('🔍 [DEBUG] promptExplicacion después de concatenar formatoRespuesta:', promptExplicacion.length, 'caracteres');
                        console.log('🔍 [DEBUG] guiaMarkdownCompleta type:', typeof guiaMarkdownCompleta, 'length:', guiaMarkdownCompleta ? guiaMarkdownCompleta.length : 'UNDEFINED');
                        console.log('🔍 [DEBUG] promptExplicacion ANTES de guiaMarkdownCompleta:', promptExplicacion.includes('formatoRespuesta') ? 'SÍ' : 'NO');
                        promptExplicacion += `${guiaMarkdownCompleta}\n\n`;  // ⚡ GUÍA COMPLETA DE MARKDOWN
                        console.log('🔍 [DEBUG] Después de guiaMarkdownCompleta:', promptExplicacion.includes('formatoRespuesta') ? 'SÍ' : 'NO');
                        console.log('🔍 [DEBUG] promptExplicacion length después de guiaMarkdownCompleta:', promptExplicacion.length);
                        console.log('🔍 [DEBUG] Muestra de promptExplicacion después de guiaMarkdownCompleta:', promptExplicacion.substring(0, 500));
                        promptExplicacion += `${identidadEmpresa}\n\n`;
                        console.log('🔍 [DEBUG] Después de identidadEmpresa:', promptExplicacion.includes('formatoRespuesta') ? 'SÍ' : 'NO');
                        promptExplicacion += `${terminologia}\n\n`;
                        console.log('🔍 [DEBUG] Después de terminologia:', promptExplicacion.includes('formatoRespuesta') ? 'SÍ' : 'NO');
                        
                        // 🔍 TEST: Verificar si los prompts base contienen patrones robóticos
                        const patronesRoboticosPrompts = [
                            'Estas son las',
                            'Aquí tienes',
                            'Aquí te presento',
                            'Te presento'
                        ];
                        
                        let patronPromptsDetectado = null;
                        for (const patron of patronesRoboticosPrompts) {
                            if (promptExplicacion.includes(patron)) {
                                patronPromptsDetectado = patron;
                                break;
                            }
                        }
                        
                        console.log('🤖 [PROMPTS-TEST] Patrón robótico en prompts:', patronPromptsDetectado || 'NINGUNO');
                        console.log('📄 [PROMPTS-TEST] Primeros 500 caracteres de prompts:', promptExplicacion.substring(0, 500));
                        
                        // =====================================
                        // LOGS DETALLADOS DE PROMPTS
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
                        
                        // Añadir contexto RAG si existe (CRÍTICO para evitar alucinaciones)
                        try {
                            const contextoRAGSegunda = await ragInteligente.recuperarConocimientoRelevante(message, 'sistema');
                            if (contextoRAGSegunda) {
                                console.log('🎯 [RAG] Incluyendo contexto empresarial en segunda llamada');
                                
                                // 🔍 TEST: Verificar si el RAG contiene patrones robóticos
                                const patronesRoboticosRAG = [
                                    'Estas son las',
                                    'Aquí tienes',
                                    'Aquí te presento',
                                    'Te presento'
                                ];
                                
                                let patronRAGDetectado = null;
                                for (const patron of patronesRoboticosRAG) {
                                    if (contextoRAGSegunda.includes(patron)) {
                                        patronRAGDetectado = patron;
                                        break;
                                    }
                                }
                                
                                console.log('🤖 [RAG-TEST] Patrón robótico en RAG:', patronRAGDetectado || 'NINGUNO');
                                console.log('📄 [RAG-TEST] Primeros 200 caracteres del RAG:', contextoRAGSegunda.substring(0, 200));
                                
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
                            promptExplicacion += `CONTEXTO CONVERSACIONAL RECIENTE:\n\n${contextoConversacional}\n\n`;
                        }
                        
                        // SOLO DATOS - Los prompts organizados ya tienen todas las instrucciones
                        promptExplicacion += `## 📊 DATOS PARA FORMATEAR:

CONSULTA ORIGINAL: "${message}"  
${Array.isArray(sql) ? 
    `SQL EJECUTADO: ${sql.length} consultas\n${sql.map((q, i) => `${i + 1}. ${q}`).join('\n')}` : 
    `SQL EJECUTADO: ${sql}`}  
RESULTADOS OBTENIDOS: ${JSON.stringify(results, null, 2)}

${Array.isArray(results) ? 
    `⚠️ MÚLTIPLES CONJUNTOS DE DATOS - formatea cada uno por separado` : 
    ''}

`;

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

                        console.log('🔄 [SEGUNDA-LLAMADA] Iniciando segunda llamada...');
                        console.log('📄 [SEGUNDA-LLAMADA] Número de mensajes:', mensajesSegundaLlamada.length);
                        console.log('📄 [SEGUNDA-LLAMADA] Longitud del prompt:', mensajesSegundaLlamada[0].content.length);
                        
                        const segundaLlamada = await openai.chat.completions.create({
                            model: 'gpt-4o-mini',  // ⚡ MODELO CONFIABLE Y ESTABLE
                            messages: mensajesSegundaLlamada,
                            max_tokens: 2000,
                            temperature: 0.7
                        });

                        console.log('✅ [SEGUNDA-LLAMADA] Respuesta recibida:');
                        console.log('📄 [SEGUNDA-LLAMADA] Respuesta completa:', JSON.stringify(segundaLlamada, null, 2));
                        console.log('📄 [SEGUNDA-LLAMADA] Content type:', typeof segundaLlamada.choices[0].message.content);
                        console.log('📄 [SEGUNDA-LLAMADA] Content length:', segundaLlamada.choices[0].message.content ? segundaLlamada.choices[0].message.content.length : 'UNDEFINED');
                        console.log('📄 [SEGUNDA-LLAMADA] Content value:', segundaLlamada.choices[0].message.content);

                        const explicacionNatural = segundaLlamada.choices[0].message.content;
                        
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
                        // Si no hay resultados, mantener la respuesta original del modelo
                        console.log('📚 [STREAMING] Sin resultados SQL - usar respuesta del modelo');
                    }
                } catch (error) {
                    console.error('❌ [STREAMING-SQL] Error ejecutando consulta:', error.message);
                    
                    // =====================================
                    // SISTEMA INTELIGENTE DE RECUPERACIÓN DE ERRORES
                    // =====================================
                    
                    if (error instanceof EnhancedSQLError) {
                        console.log('🧠 [INTELLIGENT-RECOVERY] Iniciando recuperación inteligente...');
                        
                        try {
                            // Usar RAG para buscar información relacionada con la consulta fallida
                            const ragResponse = await ragInteligente.recuperarConocimientoRelevante(
                                `${originalQuery} error SQL tabla columna estructura base datos`, 
                                'sistema'
                            );
                            
                            if (ragResponse && ragResponse.length > 100) {
                                console.log('🎯 [RAG-RECOVERY] Información relevante encontrada en RAG');
                                
                                // Crear respuesta inteligente usando RAG + análisis del error
                                const intelligentResponse = await generateIntelligentErrorResponse(
                                    message, 
                                    error, 
                                    ragResponse,
                                    todoManager.getTodos('failed')
                                );
                                
                                if (intelligentResponse) {
                                    finalMessage = intelligentResponse;
                                    console.log('✅ [INTELLIGENT-RECOVERY] Respuesta inteligente generada');
                                } else {
                                    finalMessage = error.getIntelligentResponse();
                                }
                            } else {
                                console.log('⚠️ [RAG-RECOVERY] No se encontró información relevante en RAG');
                                finalMessage = error.getIntelligentResponse();
                            }
                            
                        } catch (ragError) {
                            console.error('❌ [RAG-RECOVERY] Error en recuperación RAG:', ragError.message);
                            finalMessage = error.getIntelligentResponse();
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
            
            // Personalizar respuesta con nombre del usuario
            const respuestaPersonalizada = personalizarRespuesta(respuestaLimpia, infoUsuario.nombre);
            
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

            // Preparar el trace del thinking para guardar en Firebase
            const thinkingTrace = thinkingContent && thinkingContent.includes('</thinking>') ? [
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
                    status: "completed",
                    startTime: new Date().toISOString(),
                    endTime: new Date().toISOString(),
                    duration: 2
                }
            ] : null;

            // Enviar señal de finalización con conversationId y trace del thinking
            response.write(JSON.stringify({
                type: 'end',
                fullResponse: respuestaPersonalizada,
                conversationId: conversationId,
                tokenCount: tokenCount,
                timestamp: Date.now(),
                trace: thinkingTrace
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

            // Guardar respuesta completa en Firestore (async) con el trace del thinking
            console.log('💾 [FIRESTORE] Guardando respuesta con trace:', thinkingTrace)
            saveAssistantMessageToFirestore(userId, respuestaPersonalizada, thinkingTrace, conversationId).catch(err =>
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
   - **USA las descripciones** de las columnas del mapaERP para explicar qué vas a buscar
   - **CONECTA** tu razonamiento con la consulta SQL que vas a ejecutar
   - **EXPLICA** en lenguaje natural qué información específica necesita el usuario
   - **MENCIÓN** exactamente qué datos vas a consultar usando el lenguaje del mapaERP
   - **USA** las descripciones naturales de las columnas (ej: "denominaciones", "registro de clientes", "información de fincas")
   - **NO menciones** nombres técnicos de tablas o columnas
   - **USA** términos empresariales naturales y específicos del mapaERP
   - **SEA HONESTO** sobre lo que realmente vas a consultar
   - Cierra con: </thinking>

2. **SEGUNDO - SQL REAL:**
   - Formato: <sql>SELECT columnas FROM tabla WHERE condiciones LIMIT X</sql>
   - USA la base de datos real del mapaERP
   - JAMÁS inventes datos falsos

**IMPORTANTE - USO DEL MAPAERP:**
- El mapaERP contiene 800+ tablas con descripciones de columnas
- USA las descripciones de las columnas para explicar qué vas a buscar
- CONECTA el thinking con el SQL real que vas a ejecutar
- NO uses ejemplos genéricos, usa la información real del mapaERP
- El thinking debe reflejar EXACTAMENTE lo que hace el SQL

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
    
    // Sistema de gestión de errores y TODOs
    todoManager,
    SQLErrorAnalyzer,
    EnhancedSQLError,
    generateIntelligentErrorResponse,
    attemptFallbackSearch,
    performSystemMaintenance,
    isSystemStatusQuery
};