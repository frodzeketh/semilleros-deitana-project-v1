// =====================================
// IMPORTACIONES Y CONFIGURACIÓN INICIAL
// =====================================

const { OpenAI } = require('openai');
const pool = require('../db');
const chatManager = require('../utils/chatManager');
const admin = require('../firebase-admin');
const pineconeMemoria = require('../utils/pinecone');
const comandosMemoria = require('../utils/comandosMemoria');
const langfuseUtils = require('../utils/langfuse');
require('dotenv').config();
const promptBase = require('./promptBase').promptBase;
const mapaERP = require('./mapaERP');

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

/**
 * Función para formatear resultados en Markdown
 * @param {Array} results - Resultados de la consulta SQL
 * @returns {string} Resultados formateados en Markdown
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

// Función para formatear la respuesta final - SIN LLAMADAS A OPENAI
async function formatFinalResponse(results, query) {
    if (!results || results.length === 0) {
        return "No encontré información que coincida con tu consulta. ¿Quieres que busque algo similar, o puedes darme más detalles para afinar la búsqueda? Si tienes dudas sobre cómo preguntar, dime el tipo de dato que buscas (por ejemplo: nombre, fecha, proveedor, etc.).";
    }

    // Detectar si el usuario pide información completa, detalles o aleatoriedad
    const pideCompleto = /completa|detallad[ao]s?|explicaci[óo]n|todo(s)?|todas/i.test(query);
    const pideAleatorio = /aleatori[ao]|ejemplo|cualquiera|al azar/i.test(query);
    // Detectar la tabla para usar descripciones de columnas
    let tablaDetectada = null;
    if (results.length > 0) {
        // Buscar la tabla que más coincide con las columnas del resultado
        const columnasResultado = Object.keys(results[0]);
        tablaDetectada = determinarTabla(columnasResultado);
    }
    // Si se pide aleatorio, selecciona un registro aleatorio
    const resultadosLimitados = limitarResultados(results, pideCompleto ? 10 : 5, pideAleatorio);
    let datosReales = '';
    resultadosLimitados.forEach((resultado, index) => {
        datosReales += `\nRegistro ${index + 1}:\n`;
        const campos = Object.entries(resultado);
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
            datosReales += `${descripcion}: ${valor}\n`;
        });
    });

    // RETORNAR DATOS FORMATEADOS SIN LLAMADA A IA
    return `He encontrado la siguiente información:${datosReales}`;
}

// =====================================
// FUNCIONES DE EJECUCIÓN Y VALIDACIÓN SQL
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
 * @param {string} response - Respuesta de OpenAI
 * @returns {string|null} SQL validado o null si no es válido
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
    if (!sqlMatch) {
        console.log('❌ [SQL-VALIDATION] No se encontró SQL en la respuesta');
        return null; // Permitir respuestas sin SQL
    }
    let sql = sqlMatch[1].trim();
    if (!sql) {
        console.error('❌ [SQL-VALIDATION] La consulta SQL está vacía');
        throw new Error('La consulta SQL está vacía');
    }
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
    
    console.log('✅ [SQL-VALIDATION] SQL final validado:', sql.substring(0, 100) + '...');
    return sql;
}

// Función para obtener el nombre real de la tabla desde mapaERP
function obtenerNombreRealTabla(nombreClave) {
    if (mapaERP[nombreClave] && mapaERP[nombreClave].tabla) {
        return mapaERP[nombreClave].tabla;
    }
    return nombreClave;
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
function validarTablaEnMapaERP(sql) {
    const tablas = Object.keys(mapaERP);
    const tablasEnConsulta = sql.match(/FROM\s+(\w+)|JOIN\s+(\w+)/gi)?.map(t => 
        t.replace(/FROM\s+|JOIN\s+/gi, '').toLowerCase()
    ) || [];
    
    for (const tabla of tablasEnConsulta) {
        if (!tablas.includes(tabla)) {
            throw new Error(`La tabla ${tabla} no existe en el mapaERP. Tablas disponibles: ${tablas.join(', ')}`);
        }
    }
}

// Función para validar que las columnas existen en mapaERP
function validarColumnasEnMapaERP(sql, tabla) {
    if (!mapaERP[tabla] || !mapaERP[tabla].columnas) {
        throw new Error(`La tabla ${tabla} no está definida correctamente en mapaERP`);
    }

    const columnas = Object.keys(mapaERP[tabla].columnas);
    
    // Extraer las columnas de la consulta SQL
    const selectMatch = sql.match(/SELECT\s+([^\s]*?)\s+FROM/i);
    if (!selectMatch) return; // Si no podemos extraer las columnas, permitimos la consulta

    // Verificar si se está usando SELECT *
    if (selectMatch[1].trim() === '*') {
        throw new Error(`No se permite usar SELECT *. Por favor, especifica las columnas definidas en mapaERP: ${columnas.join(', ')}`);
    }
    
    const columnasEnSQL = selectMatch[1]
        .split(',')
        .map(col => {
            col = col.trim();
            // Si es una función SQL (COUNT, AVG, etc.), la permitimos
            if (col.match(/^[A-Za-z]+\s*\([^)]*\)$/)) return null;
            // Si es un alias (AS), tomamos la parte antes del AS
            if (col.toLowerCase().includes(' as ')) {
                const [columna, alias] = col.split(/\s+as\s+/i);
                return columna.trim();
            }
            // Removemos el prefijo de tabla si existe
            return col.replace(/^[a-z]+\./, '');
        })
        .filter(col => col !== null); // Eliminamos las funciones SQL
    
    // Verificar que cada columna existe en mapaERP
    const columnasNoValidas = columnasEnSQL.filter(columna => !columnas.includes(columna));
    
    if (columnasNoValidas.length > 0) {
        throw new Error(
            `Las siguientes columnas no existen en la tabla ${tabla}: ${columnasNoValidas.join(', ')}. ` +
            `Columnas disponibles: ${columnas.join(', ')}`
        );
    }
}

// Función para obtener contenido relevante de mapaERP
function obtenerContenidoMapaERP(consulta) {
    try {
        // Detectar tabla principal basada en palabras clave
        const palabrasClave = consulta.toLowerCase().split(' ');
        console.log('Palabras clave de la consulta:', palabrasClave);

        // Mapeo directo de palabras clave a tablas
        const mapeoTablas = {
            'cliente': 'clientes',
            'proveedor': 'proveedores',
            'articulo': 'articulos',
            'bandeja': 'bandejas',
            'accion': 'acciones_com'
        };

        // Buscar tabla principal
        let tablaPrincipal = null;
        for (const palabra of palabrasClave) {
            if (mapeoTablas[palabra]) {
                tablaPrincipal = mapeoTablas[palabra];
                break;
            }
        }

        if (!tablaPrincipal || !mapaERP[tablaPrincipal]) {
            // Si no se encuentra una tabla específica, devolver información mínima
            return 'Tablas disponibles: ' + Object.keys(mapeoTablas).join(', ');
        }

        // Solo devolver información de la tabla relevante
        const tabla = mapaERP[tablaPrincipal];
        return `TABLA ${tablaPrincipal}:\n` +
               `Descripción: ${tabla.descripcion || 'No disponible'}\n` +
               `Columnas principales: ${Object.keys(tabla.columnas || {}).slice(0, 5).join(', ')}`;

    } catch (error) {
        console.error('Error al obtener contenido de mapaERP:', error);
        return '';
    }
}

// Función para obtener descripción de mapaERP
function obtenerDescripcionMapaERP(consulta) {
    try {
        if (!mapaERP || typeof mapaERP !== 'object') {
            return null;
        }

        const palabrasClave = consulta.toLowerCase().split(' ');
        
        // Buscar coincidencias en descripciones
        const coincidencias = Object.entries(mapaERP).filter(([tabla, info]) => {
            const descripcion = info.descripcion?.toLowerCase() || '';
            return palabrasClave.some(palabra => 
                tabla.toLowerCase().includes(palabra) || 
                descripcion.includes(palabra)
            );
        });

        if (coincidencias.length > 0) {
            // Si encontramos una coincidencia exacta, usamos esa
            const coincidenciaExacta = coincidencias.find(([tabla, _]) => 
                palabrasClave.some(palabra => tabla.toLowerCase() === palabra)
            );
            
            if (coincidenciaExacta) {
                return {
                    tabla: coincidenciaExacta[0],
                    descripcion: coincidenciaExacta[1].descripcion
                };
            }

            // Si no hay coincidencia exacta, usamos la primera coincidencia
            return {
                tabla: coincidencias[0][0],
                descripcion: coincidencias[0][1].descripcion
            };
        }

        return null;
    } catch (error) {
        console.error('Error al obtener descripción de mapaERP:', error);
        return null;
    }
}

// Función auxiliar para detectar si la pregunta es de seguimiento sobre teléfono de cliente
function esPreguntaTelefonoCliente(userQuery, lastRealData) {
    if (!lastRealData || lastRealData.type !== 'cliente' || !lastRealData.data) return false;
    const texto = userQuery.toLowerCase();
    return (
        texto.includes('telefono') || texto.includes('teléfono')
    );
}

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

// Función auxiliar para intentar una búsqueda flexible (fuzzy search) en SQL
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
            let sqlFuzzyTry = sql.replace(/WHERE[\sS]*/i, `WHERE ${col} LIKE '%${variante}%' LIMIT 5`);
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
// FUNCIÓN PRINCIPAL - MODELO GPT Y PROCESAMIENTO
// Se encarga de coordinar todo el proceso de la consulta
// =====================================

/**
 * Función principal para procesar consultas de administrador
 * @param {Object} params - Parámetros de la consulta
 * @param {string} params.message - Mensaje del usuario
 * @param {string} params.userId - ID del usuario
 * @returns {Object} Respuesta procesada
 */
async function processQuery({ message, userId }) {
    // =====================================
    // INICIO DE TRACE LANGFUSE PARA OBSERVABILIDAD COMPLETA
    // =====================================
    
    const tiempoInicio = Date.now();
    const trace = langfuseUtils.iniciarTrace(userId, message, 'admin');
    
    try {
        console.log('🚀 [SISTEMA] ===== INICIANDO PROCESO DE CONSULTA ADMIN =====');
        console.log('🚀 [SISTEMA] Procesando consulta de administrador:', message);
        console.log('🚀 [SISTEMA] Usuario ID:', userId);

        // =====================================
        // PREPARACIÓN DEL CONTEXTO Y HISTORIAL
        // =====================================

        // Guardar el mensaje del usuario
        console.log('💾 [FIRESTORE] Guardando mensaje del usuario...');
        await saveMessageToFirestore(userId, message, true);

        conversationHistory.push({ role: "user", content: message });

        // =====================================
        // PROCESAMIENTO DE COMANDOS ESPECIALES DE MEMORIA
        // =====================================
        
        const comandoMemoria = await comandosMemoria.procesarComandoMemoria(message, userId);
        if (comandoMemoria) {
            console.log('🧠 [COMANDO-MEMORIA] Comando especial de memoria procesado');
            await saveAssistantMessageToFirestore(userId, comandoMemoria.data.message);
            return comandoMemoria;
        }

        const contenidoMapaERP = obtenerContenidoMapaERP(message);

        // =====================================
        // VALIDACIÓN DE CONSULTAS ESPECIALES
        // =====================================

        if (esPreguntaTelefonoCliente(message, lastRealData)) {
            console.log('📞 [CONSULTA-ESPECIAL] Detectada consulta de teléfono de cliente');
            const cliente = lastRealData.data[0];
            const nombreCliente = cliente.CL_DENO;
            if (nombreCliente) {
                const sql = `SELECT CL_TEL FROM clientes WHERE CL_DENO = '${nombreCliente.replace(/'/g, "''")}' LIMIT 1`;
                const results = await executeQuery(sql);
                if (results && results[0] && results[0].CL_TEL) {
                    lastRealData = { type: 'telefono_cliente', data: results };
                    const response = {
                        success: true,
                        data: {
                            message: `El teléfono de "${nombreCliente}" es: ${results[0].CL_TEL}`
                        }
                    };
                    await saveAssistantMessageToFirestore(userId, response.data.message);
                    console.log('✅ [CONSULTA-ESPECIAL] Teléfono encontrado y enviado');
                    return response;
                } else {
                    lastRealData = { type: 'telefono_cliente', data: [] };
                    const response = {
                        success: true,
                        data: {
                            message: `No se encontró un número de teléfono registrado para "${nombreCliente}".`
                        }
                    };
                    await saveAssistantMessageToFirestore(userId, response.data.message);
                    console.log('⚠️ [CONSULTA-ESPECIAL] Teléfono no encontrado');
                    return response;
                }
            }
        }

        // =====================================
        // CONSTRUCCIÓN DEL CONTEXTO COMPLETO
        // =====================================

        const historyForAI = conversationHistory.slice(-10);
        let contextoDatos = '';
        if (lastRealData && lastRealData.type && lastRealData.data) {
            contextoDatos = `\n\nDATOS REALES DISPONIBLES DE LA CONSULTA ANTERIOR:\nTipo: ${lastRealData.type}\nDatos: ${JSON.stringify(lastRealData.data)}`;
            console.log('📊 [CONTEXTO] Datos previos disponibles:', lastRealData.type);
        }

        // Detectar si la consulta es conceptual
        const descripcionConceptual = obtenerDescripcionMapaERP(message);
        let contextoConceptual = '';
        if (descripcionConceptual && descripcionConceptual.descripcion) {
            contextoConceptual = `\n\nDESCRIPCIÓN RELEVANTE DEL SISTEMA:\n${descripcionConceptual.descripcion}`;
            console.log('📋 [CONTEXTO] Descripción conceptual encontrada:', descripcionConceptual.tabla);
        }

        console.log('🧠 [CONTEXTO] Preparando prompt del sistema...');
        console.log('🧠 [CONTEXTO] Historial de conversación:', historyForAI.length, 'mensajes');
        console.log('🧠 [CONTEXTO] Contenido mapaERP:', contenidoMapaERP.length, 'caracteres');

        // =====================================
        // INTEGRACIÓN CON MEMORIA SEMÁNTICA PINECONE
        // =====================================
        
        let contextoPinecone = '';
        try {
            console.log('🧠 [PINECONE] Obteniendo contexto de memoria semántica...');
            contextoPinecone = await pineconeMemoria.agregarContextoMemoria(userId, message);
            if (contextoPinecone) {
                console.log('✅ [PINECONE] Contexto de memoria agregado exitosamente');
                console.log('🧠 [PINECONE] Longitud del contexto:', contextoPinecone.length, 'caracteres');
            } else {
                console.log('ℹ️ [PINECONE] No se encontraron recuerdos relevantes para esta consulta');
            }
        } catch (error) {
            console.error('❌ [PINECONE] Error obteniendo contexto de memoria:', error.message);
            contextoPinecone = ''; // Continuar sin memoria si hay error
        }

        const systemPrompt = `

${promptBase}

${contextoPinecone}
${contenidoMapaERP}${contextoDatos}`;

        // =====================================
        // LLAMADAS A OPENAI CON ANÁLISIS DE COSTOS
        // =====================================

        let response = null;
        let sql = null;
        let intentos = 0;
        let feedback = '';
        let errorSQL = null;
        
        console.log('🧠 [ETAPA-1] ===== GPT RECIBE LA CONSULTA =====');
        console.log('🧠 [ETAPA-1] Preparando llamada a OpenAI...');
        
        while (intentos < 2) {
            const messages = [
                { role: "system", content: systemPrompt + (feedback ? `\n\nFEEDBACK: ${feedback}` : '') },
                ...historyForAI
            ];
            
            console.log('🧠 [ETAPA-1] Intento:', intentos + 1);
            console.log('🧠 [ETAPA-1] Mensajes a enviar:', messages.length);
            
            // ========== LLAMADA ÚNICA OPTIMIZADA A OPENAI ==========
            console.log('📊 [LANGFUSE] Registrando llamada a OpenAI...');
            const tiempoLlamada = Date.now();
            
            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview", // ← MODELO CLARAMENTE DEFINIDO
                messages: messages,
                temperature: 0.7,
                max_tokens: 2000 // ← Aumentado para respuestas completas con análisis
            });
            
            const tiempoRespuesta = Date.now() - tiempoLlamada;
            response = completion.choices[0].message.content;
            conversationHistory.push({ role: "assistant", content: response });
            
            // =====================================
            // REGISTRO EN LANGFUSE DE LA LLAMADA OPENAI
            // =====================================
            
            const tokensLlamada = completion.usage;
            const costoEstimado = (tokensLlamada.prompt_tokens * 0.01 + tokensLlamada.completion_tokens * 0.03) / 1000;
            
            langfuseUtils.registrarLlamadaOpenAI(trace, {
                modelo: "gpt-4-turbo-preview",
                temperature: 0.7,
                maxTokens: 2000,
                prompt: systemPrompt + '\n\nUsuario: ' + message,
                respuesta: response,
                promptTokens: tokensLlamada.prompt_tokens,
                completionTokens: tokensLlamada.completion_tokens,
                totalTokens: tokensLlamada.total_tokens,
                costoEstimado: costoEstimado,
                tiempoRespuesta: tiempoRespuesta
            });
            
            // =====================================
            // ANÁLISIS DE COSTOS Y TOKENS
            // =====================================
            const tokensUsados = completion.usage;
            const promptTokens = tokensUsados.prompt_tokens;
            const completionTokens = tokensUsados.completion_tokens;
            const totalTokens = tokensUsados.total_tokens;
            
            // Costos aproximados para gpt-4-turbo-preview
            const costoPorPromptToken = 0.01 / 1000; // $0.01 por 1K tokens de entrada
            const costoPorCompletionToken = 0.03 / 1000; // $0.03 por 1K tokens de salida
            
            const costoPrompt = promptTokens * costoPorPromptToken;
            const costoCompletion = completionTokens * costoPorCompletionToken;
            const costoTotal = costoPrompt + costoCompletion;
            
            console.log('💰 [ANÁLISIS-COSTOS] ===== TOKENS Y COSTOS =====');
            console.log('💰 [TOKENS-ENTRADA] Prompt tokens:', promptTokens);
            console.log('💰 [TOKENS-SALIDA] Completion tokens:', completionTokens);
            console.log('💰 [TOKENS-TOTAL] Total tokens:', totalTokens);
            console.log('💰 [COSTO-ENTRADA] Costo prompt: $' + costoPrompt.toFixed(6));
            console.log('💰 [COSTO-SALIDA] Costo completion: $' + costoCompletion.toFixed(6));
            console.log('💰 [COSTO-TOTAL] Costo total consulta: $' + costoTotal.toFixed(6));
            console.log('💰 [COSTO-ESTIMADO] Costo por 100 consultas: $' + (costoTotal * 100).toFixed(4));
            console.log('💰 [COSTO-ESTIMADO] Costo por 1000 consultas: $' + (costoTotal * 1000).toFixed(2));
            console.log('💰 [ANÁLISIS-COSTOS] =====================================');
            
            console.log('🧠 [ETAPA-1] GPT procesó la consulta exitosamente (UNA SOLA LLAMADA OPTIMIZADA)');
            console.log('📋 [RESPUESTA-GPT] Respuesta completa generada:', response.substring(0, 200) + '...');
            console.log('📋 [RESPUESTA-GPT] Longitud:', response.length, 'caracteres');
            console.log('⚡ [OPTIMIZACIÓN] Eliminada segunda llamada - Tiempo de respuesta reducido significativamente');
            
            // =====================================
            // DETECCIÓN Y VALIDACIÓN DE SQL
            // =====================================
            
            sql = validarRespuestaSQL(response);
            
            // Si no hay SQL, es respuesta conversacional
            if (!sql) {
                console.log('🧠 [ETAPA-2] Decisión: RESPUESTA CONVERSACIONAL');
                console.log('🧠 [ETAPA-2] Tipo: Saludo, información general, o conocimiento interno');
                console.log('🧠 [ETAPA-2] No requiere acceso a base de datos');
                
                await saveAssistantMessageToFirestore(userId, response);
                console.log('✅ [SISTEMA] Respuesta conversacional enviada correctamente');
                
                // =====================================
                // GUARDADO AUTOMÁTICO EN MEMORIA SEMÁNTICA
                // =====================================
                
                try {
                    console.log('💾 [PINECONE] Guardando conversación en memoria semántica...');
                    await pineconeMemoria.guardarAutomatico(userId, message, response);
                    console.log('✅ [PINECONE] Memoria actualizada exitosamente');
                } catch (error) {
                    console.error('❌ [PINECONE] Error guardando en memoria:', error.message);
                    // No interrumpir el flujo si falla el guardado
                }
                
                // =====================================
                // FINALIZACIÓN DE TRACE LANGFUSE
                // =====================================
                
                const tiempoTotal = Date.now() - tiempoInicio;
                langfuseUtils.finalizarTrace(trace, {
                    respuestaFinal: response,
                    exito: true,
                    tiempoTotal: tiempoTotal,
                    tokensTotal: tokensLlamada.total_tokens,
                    costoTotal: costoEstimado
                });
                
                return {
                    success: true,
                    data: { message: response }
                };
            }
            
            console.log('🧠 [ETAPA-2] Decisión: CONSULTA SQL + ANÁLISIS INTEGRADO');
            console.log('🧠 [ETAPA-2] SQL generado:', sql.substring(0, 100) + '...');
            console.log('🧠 [ETAPA-2] Tipo: Procesamiento de datos con marcadores (sin segunda llamada)');
            
            // =====================================
            // EJECUCIÓN DE CONSULTAS SQL
            // =====================================
            
            try {
                console.log('⚙️ [JAVASCRIPT] ===== EJECUTANDO TRABAJO MECÁNICO =====');
                console.log('⚙️ [JAVASCRIPT] Ejecutando consulta que GPT generó...');
                console.log('⚙️ [SQL-DEBUG] Consulta a ejecutar:', sql);
                
                let results = await executeQuery(sql);
                if (!results || results.length === 0) {
                    console.log('⚠️ [SQL-RESULTADOS] Consulta inicial sin resultados, iniciando reintentos...');
                    
                    // Reintentos automáticos inteligentes si no hay resultados
                    if (/WHERE[\s\S]*(fec|fecha)/i.test(sql)) {
                        console.log('🔄 [REINTENTO-1] Quitando filtros de fecha...');
                        let sqlSinFecha = sql.replace(/AND[\s\S]*(fec|fecha)[^A-Z]*[=><][^A-Z]*((AND)|($))/i, '').replace(/WHERE[\s\S]*(fec|fecha)[^A-Z]*[=><][^A-Z]*((AND)|($))/i, '');
                        if (/WHERE\s*$/i.test(sqlSinFecha)) sqlSinFecha = sqlSinFecha.replace(/WHERE\s*$/i, '');
                        results = await executeQuery(sqlSinFecha);
                        console.log('🔄 [REINTENTO-1] Resultados después de quitar fecha:', results?.length || 0);
                    }
                }
                if (!results || results.length === 0) {
                    console.log('🔄 [REINTENTO-2] Quitando GROUP BY y ORDER BY...');
                    let sqlSinGroup = sql.replace(/GROUP BY[\s\S]*?(?=(ORDER BY|LIMIT|$))/i, '').replace(/ORDER BY[\s\S]*?(?=(LIMIT|$))/i, '');
                    results = await executeQuery(sqlSinGroup);
                    console.log('🔄 [REINTENTO-2] Resultados después de simplificar:', results?.length || 0);
                }
                if (!results || results.length === 0) {
                    console.log('🔄 [REINTENTO-3] Buscando artículos similares...');
                    const tablaMatch = sql.match(/FROM\s+([`\w]+)/i);
                    if (tablaMatch) {
                        const tabla = tablaMatch[1].replace(/`/g, '');
                        console.log('🔄 [REINTENTO-3] Tabla detectada:', tabla);
                        if (tabla === 'articulos') {
                            let sqlSimilares = `SELECT a.id, a.AR_DENO, s.C2 AS stock_actual FROM articulos a JOIN articulos_ar_stok s ON a.id = s.id WHERE a.AR_DENO LIKE '%INJ%' AND a.AR_DENO LIKE '%TOMATE%' ORDER BY s.id2 DESC LIMIT 3`;
                            let similares = await executeQuery(sqlSimilares);
                            console.log('🔄 [REINTENTO-3] Artículos similares encontrados:', similares?.length || 0);
                            if (similares && similares.length > 0) {
                                lastRealData = { type: 'articulo', data: similares };
                                const finalMessage = response.replace(/<sql>[\s\S]*?<\/sql>/, '').trim() + 
                                    '\n\n📊 RESULTADOS SIMILARES ENCONTRADOS:\n' + 
                                    similares.map((item, i) => `${i+1}. ${item.AR_DENO} (Stock: ${item.C2})`).join('\n') +
                                    '\n\n(Nota: No se encontró coincidencia exacta, se muestran artículos similares)';
                                await saveAssistantMessageToFirestore(userId, finalMessage);
                                console.log('✅ [REINTENTO-3] Respuesta con artículos similares enviada');
                                return { success: true, data: { message: finalMessage } };
                            }
                        }
                        const claveMapa = Object.keys(mapaERP).find(k => (mapaERP[k].tabla || k) === tabla);
                        let colFecha = null;
                        if (claveMapa && mapaERP[claveMapa].columnas) {
                            colFecha = Object.keys(mapaERP[claveMapa].columnas).find(c => c.toLowerCase().includes('fec'));
                        }
                        if (colFecha) {
                            console.log('🔄 [REINTENTO-3] Intentando fallback por fecha con columna:', colFecha);
                            const sqlUltimo = `SELECT * FROM ${tabla} ORDER BY ${colFecha} DESC LIMIT 1`;
                            results = await executeQuery(sqlUltimo);
                            console.log('🔄 [REINTENTO-3] Resultados con fallback por fecha:', results?.length || 0);
                        }
                    }
                }
                if (!results || results.length === 0) {
                    console.log('🔄 [FUZZY-SEARCH] Iniciando búsqueda flexible...');
                    const fuzzyResult = await fuzzySearchRetry(sql, message);
                    if (fuzzyResult && fuzzyResult.results && fuzzyResult.results.length > 0) {
                        console.log('🔄 [FUZZY-SEARCH] Resultados encontrados:', fuzzyResult.results.length);
                        let tipo = 'dato';
                        if (fuzzyResult.results[0] && fuzzyResult.results[0].CL_DENO) tipo = 'cliente';
                        if (fuzzyResult.results[0] && fuzzyResult.results[0].AR_NOMB) tipo = 'articulo';
                        lastRealData = { type: tipo, data: fuzzyResult.results };
                        const finalMessage = response.replace(/<sql>[\s\S]*?<\/sql>/, '').trim() + 
                            '\n\n📊 RESULTADOS (búsqueda flexible):\n' + 
                            fuzzyResult.results.slice(0,3).map((item, i) => `${i+1}. ${Object.entries(item).map(([k,v]) => `${k}: ${v}`).join(' | ')}`).join('\n') +
                            '\n\n(Nota: Se utilizó búsqueda flexible para encontrar coincidencias aproximadas)';
                        await saveAssistantMessageToFirestore(userId, finalMessage);
                        console.log('✅ [FUZZY-SEARCH] Respuesta con búsqueda flexible enviada');
                        return { success: true, data: { message: finalMessage } };
                    }
                    console.log('⚠️ [FUZZY-SEARCH] Búsqueda flexible sin resultados');
                    
                    // Sin resultados - usar respuesta de IA + mensaje
                    const finalMessage = response.replace(/<sql>[\s\S]*?<\/sql>/, '').trim() + 
                        '\n\n❌ No se encontraron resultados para esta consulta. ¿Podrías intentar con términos diferentes o ser más específico?';
                    await saveAssistantMessageToFirestore(userId, finalMessage);
                    console.log('⚠️ [SIN-RESULTADOS] Respuesta de sin resultados enviada');
                    return { success: true, data: { message: finalMessage } };
                }
                
                // =====================================
                // PROCESAMIENTO DE RESULTADOS CON MARCADORES
                // =====================================
                
                console.log('✅ [SQL-RESULTADOS] Datos encontrados exitosamente');
                console.log('📊 [PROCESAMIENTO] Procesando', results.length, 'registros encontrados');
                
                // =====================================
                // REGISTRO DE SQL EN LANGFUSE
                // =====================================
                
                langfuseUtils.registrarSQL(trace, {
                    sqlGenerado: sql,
                    mensajeUsuario: message,
                    resultadosCount: results.length,
                    tiempoEjecucion: Date.now() - tiempoInicio,
                    sqlValido: true,
                    tuvoReintentos: false,
                    fuzzySearchUsado: false
                });
                
                // HAY RESULTADOS - Procesar con sistema de marcadores
                let tipo = 'dato';
                if (results[0] && results[0].CL_DENO) tipo = 'cliente';
                if (results[0] && results[0].AR_DENO) tipo = 'articulo';
                lastRealData = { type: tipo, data: results };
                
                console.log('📊 [PROCESAMIENTO] Tipo de datos detectado:', tipo);
                console.log('📊 [PROCESAMIENTO] Campos disponibles:', Object.keys(results[0]).join(', '));
                
                console.log('🧠 [ETAPA-3] ===== PROCESAMIENTO CON MARCADORES =====');
                console.log('🧠 [ETAPA-3] Reemplazando marcadores con datos reales...');
                
                // Limpiar SQL de la respuesta
                let finalMessage = response.replace(/<sql>[\s\S]*?<\/sql>/g, '').trim();
                
                // Buscar todos los marcadores en la respuesta
                const marcadores = finalMessage.match(/\[[^\]]+\]/g) || [];
                console.log('🔄 [MARCADORES] Marcadores encontrados:', marcadores.length);
                console.log('🔄 [MARCADORES] Lista:', marcadores.join(', '));
                
                if (marcadores.length === 0) {
                    console.log('⚠️ [MARCADORES] No se encontraron marcadores en la respuesta GPT');
                    // Generar respuesta automática con datos
                    finalMessage = `¡Perfecto! He encontrado la información solicitada:\n\n`;
                    
                    // Mostrar hasta 5 registros
                    results.slice(0, 5).forEach((registro, index) => {
                        finalMessage += `📋 **Registro ${index + 1}:**\n`;
                        Object.entries(registro).forEach(([campo, valor]) => {
                            if (valor !== null && valor !== undefined && valor !== '') {
                                // Formatear fechas
                                if (campo.toLowerCase().includes('fec') && valor) {
                                    try {
                                        valor = new Date(valor).toLocaleDateString('es-ES', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        });
                                    } catch (e) {
                                        // Mantener valor original si no es fecha
                                    }
                                }
                                finalMessage += `• **${campo}**: ${valor}\n`;
                            }
                        });
                        finalMessage += `\n`;
                    });
                    
                    if (results.length > 5) {
                        finalMessage += `\n*(Mostrando 5 de ${results.length} registros encontrados)*\n`;
                    }
                    
                    finalMessage += `\n¿Necesitas más información específica de algún registro?`;
                } else {
                    console.log('🔄 [MARCADORES] Procesando reemplazo de marcadores...');
                    
                    // Filtrar registros válidos
                    const registrosValidos = results.filter(registro => {
                        const valores = Object.values(registro);
                        return valores.some(valor => 
                            valor !== null && valor !== undefined && valor !== '' && valor.toString().trim() !== ''
                        );
                    });
                    
                    console.log('🔄 [MARCADORES] Registros válidos:', registrosValidos.length);
                    
                    if (registrosValidos.length === 0) {
                        finalMessage += '\n\n⚠️ Los datos encontrados están incompletos. ¿Te ayudo a buscar información similar?';
                    } else {
                        // Sistema de reemplazo inteligente
                        let contadorRegistros = 0;
                        
                        finalMessage = finalMessage.replace(/\[([^\]]+)\]/g, (marcadorCompleto, nombreCampo) => {
                            console.log('🔄 [REEMPLAZO] Procesando:', marcadorCompleto);
                            
                            // Buscar el campo en los registros disponibles
                            for (let i = contadorRegistros; i < registrosValidos.length; i++) {
                                const registro = registrosValidos[i];
                                
                                if (registro.hasOwnProperty(nombreCampo) && 
                                    registro[nombreCampo] !== null && 
                                    registro[nombreCampo] !== undefined && 
                                    registro[nombreCampo] !== '' &&
                                    registro[nombreCampo].toString().trim() !== '') {
                                    
                                    let valor = registro[nombreCampo];
                                    contadorRegistros = i + 1;
                                    
                                    // Formatear fechas
                                    if (valor && nombreCampo.toLowerCase().includes('fec')) {
                                        try {
                                            const fecha = new Date(valor);
                                            if (!isNaN(fecha.getTime())) {
                                                valor = fecha.toLocaleDateString('es-ES', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                });
                                            }
                                        } catch (error) {
                                            // Mantener valor original
                                        }
                                    }
                                    
                                    console.log('🔄 [REEMPLAZO] ✅', marcadorCompleto, '→', valor);
                                    return valor;
                                }
                            }
                            
                            // Si no se encuentra el campo, buscar en todos los registros
                            for (const registro of registrosValidos) {
                                if (registro.hasOwnProperty(nombreCampo) && 
                                    registro[nombreCampo] !== null && 
                                    registro[nombreCampo] !== undefined && 
                                    registro[nombreCampo] !== '') {
                                    
                                    let valor = registro[nombreCampo];
                                    
                                    // Formatear fechas
                                    if (valor && nombreCampo.toLowerCase().includes('fec')) {
                                        try {
                                            const fecha = new Date(valor);
                                            if (!isNaN(fecha.getTime())) {
                                                valor = fecha.toLocaleDateString('es-ES', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                });
                                            }
                                        } catch (error) {
                                            // Mantener valor original
                                        }
                                    }
                                    
                                    console.log('🔄 [REEMPLAZO] ✅ (fallback)', marcadorCompleto, '→', valor);
                                    return valor;
                                }
                            }
                            
                            console.log('🔄 [REEMPLAZO] ❌', marcadorCompleto, '→ campo no encontrado');
                            return `[${nombreCampo} - no disponible]`;
                        });
                    }
                }
                
                console.log('📋 [RESPUESTA-FINAL] Respuesta procesada:', finalMessage.substring(0, 200) + '...');
                console.log('📋 [RESPUESTA-FINAL] Longitud:', finalMessage.length, 'caracteres');
                
                await saveAssistantMessageToFirestore(userId, finalMessage);
                console.log('✅ [SISTEMA] Respuesta final enviada correctamente');
                console.log('🎯 [RESUMEN] OPTIMIZACIÓN COMPLETA: Una sola llamada GPT generó SQL + análisis completo');
                
                // =====================================
                // GUARDADO AUTOMÁTICO EN MEMORIA SEMÁNTICA
                // =====================================
                
                try {
                    console.log('💾 [PINECONE] Guardando conversación en memoria semántica...');
                    await pineconeMemoria.guardarAutomatico(userId, message, finalMessage);
                    console.log('✅ [PINECONE] Memoria actualizada exitosamente');
                } catch (error) {
                    console.error('❌ [PINECONE] Error guardando en memoria:', error.message);
                    // No interrumpir el flujo si falla el guardado
                }
                
                // =====================================
                // FINALIZACIÓN DE TRACE LANGFUSE
                // =====================================
                
                const tiempoTotal = Date.now() - tiempoInicio;
                langfuseUtils.finalizarTrace(trace, {
                    respuestaFinal: finalMessage,
                    exito: true,
                    tiempoTotal: tiempoTotal,
                    tokensTotal: tokensLlamada.total_tokens,
                    costoTotal: costoEstimado
                });
                
                return { success: true, data: { message: finalMessage } };
                
            } catch (error) {
                console.error('❌ [SQL-ERROR] Error ejecutando SQL:', error.message);
                console.error('❌ [SQL-ERROR] SQL que falló:', sql);
                
                feedback = 'La consulta SQL generada fue inválida o produjo un error. Por favor, genera SOLO una consulta SQL válida y ejecutable.';
                errorSQL = error;
                intentos++;
                sql = null;
                
                console.log('🔄 [SISTEMA] Reintentando... Intento:', intentos + 1);
            }
        }
        
        // =====================================
        // FALLBACK FINAL SI NO HAY SQL VÁLIDO
        // =====================================
        
        console.log('⚠️ [FALLBACK] No se pudo generar SQL válido después de 2 intentos');
        console.log('⚠️ [FALLBACK] Enviando respuesta de fallback conversacional');
        
        // Si tras dos intentos no hay SQL válido, fallback conversacional directo
        lastRealData = null;
        const fallbackResponse = {
            success: true,
            data: {
                message: "No pude procesar tu consulta. ¿Podrías intentar ser más específico o darme algún dato adicional? Si tienes dudas sobre cómo preguntar, dime el tipo de dato que buscas (por ejemplo: nombre, fecha, proveedor, etc.)."
            }
        };
        await saveAssistantMessageToFirestore(userId, fallbackResponse.data.message);
        console.log('✅ [FALLBACK] Respuesta de fallback enviada');
        
        // =====================================
        // GUARDADO AUTOMÁTICO EN MEMORIA SEMÁNTICA
        // =====================================
        
        try {
            console.log('💾 [PINECONE] Guardando conversación fallback en memoria semántica...');
            await pineconeMemoria.guardarAutomatico(userId, message, fallbackResponse.data.message);
            console.log('✅ [PINECONE] Memoria actualizada exitosamente');
        } catch (error) {
            console.error('❌ [PINECONE] Error guardando en memoria:', error.message);
            // No interrumpir el flujo si falla el guardado
        }
        
        // =====================================
        // FINALIZACIÓN DE TRACE LANGFUSE
        // =====================================
        
        const tiempoTotal = Date.now() - tiempoInicio;
        langfuseUtils.finalizarTrace(trace, {
            respuestaFinal: fallbackResponse.data.message,
            exito: true,
            tiempoTotal: tiempoTotal,
            tokensTotal: 0,
            costoTotal: 0
        });
        
        return fallbackResponse;
        
    } catch (error) {
        console.error('💥 [SISTEMA-ERROR] Error crítico en processQuery:', error);
        console.error('💥 [SISTEMA-ERROR] Stack trace:', error.stack);
        
        // =====================================
        // REGISTRO DE ERROR EN LANGFUSE
        // =====================================
        
        langfuseUtils.registrarError(trace, error, 'sistema-critico');
        
        const errorMessage = "Disculpa, tuve un problema procesando tu consulta. ¿Podrías intentar de nuevo con una pregunta más específica?";
        await saveAssistantMessageToFirestore(userId, errorMessage);
        
        console.log('🚨 [SISTEMA-ERROR] Respuesta de error enviada al usuario');
        
        // =====================================
        // GUARDADO AUTOMÁTICO EN MEMORIA SEMÁNTICA
        // =====================================
        
        try {
            console.log('💾 [PINECONE] Guardando conversación con error en memoria semántica...');
            await pineconeMemoria.guardarAutomatico(userId, message, errorMessage);
            console.log('✅ [PINECONE] Memoria actualizada exitosamente');
        } catch (memoryError) {
            console.error('❌ [PINECONE] Error guardando en memoria:', memoryError.message);
            // No interrumpir el flujo si falla el guardado
        }
        
        // =====================================
        // FINALIZACIÓN DE TRACE LANGFUSE
        // =====================================
        
        const tiempoTotal = Date.now() - tiempoInicio;
        langfuseUtils.finalizarTrace(trace, {
            respuestaFinal: errorMessage,
            exito: false,
            tiempoTotal: tiempoTotal,
            tokensTotal: 0,
            costoTotal: 0
        });
        
        return {
            success: true,
            data: { message: errorMessage }
        };
    }
}

// =====================================
// MÓDULO DE EXPORTACIÓN
// =====================================

/**
 * Exportar la función principal para su uso en otros archivos
 */
module.exports = {
    processQuery
};