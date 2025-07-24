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
const { formatoObligatorio } = require('../prompts/formatoObligatorio');
const { promptGlobal } = require('../prompts/promptGlobal');

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
async function formatFinalResponse(results, query) {
    if (!results || results.length === 0) {
        return "No encontré información que coincida con tu consulta. ¿Quieres que busque algo similar, o puedes darme más detalles para afinar la búsqueda?";
    }

    // Detectar cantidad solicitada en la consulta
    const cantidadMatch = query.match(/(\d+)\s+/i);
    const cantidadSolicitada = cantidadMatch ? parseInt(cantidadMatch[1]) : null;
    
    // Detectar tipo de entidad
    let tipoEntidad = 'registros';
    let saludo = 'Aquí tienes';
    
    if (/almacenes?/i.test(query)) {
        tipoEntidad = results.length === 1 ? 'almacén' : 'almacenes';
        saludo = cantidadSolicitada ? `Los ${cantidadSolicitada} ${tipoEntidad} que me pediste son` : `Los ${tipoEntidad} disponibles son`;
    } else if (/tecnicos?/i.test(query)) {
        tipoEntidad = results.length === 1 ? 'técnico' : 'técnicos';
        saludo = cantidadSolicitada ? `Los ${cantidadSolicitada} ${tipoEntidad} que me pediste son` : `Los ${tipoEntidad} disponibles son`;
    } else if (/clientes?/i.test(query)) {
        tipoEntidad = results.length === 1 ? 'cliente' : 'clientes';
        saludo = cantidadSolicitada ? `Los ${cantidadSolicitada} ${tipoEntidad} que me pediste son` : `Los ${tipoEntidad} disponibles son`;
    } else if (/articulos?/i.test(query)) {
        tipoEntidad = results.length === 1 ? 'artículo' : 'artículos';
        saludo = cantidadSolicitada ? `Los ${cantidadSolicitada} ${tipoEntidad} que me pediste son` : `Los ${tipoEntidad} disponibles son`;
    } else if (/proveedores?/i.test(query)) {
        tipoEntidad = results.length === 1 ? 'proveedor' : 'proveedores';
        saludo = cantidadSolicitada ? `Los ${cantidadSolicitada} ${tipoEntidad} que me pediste son` : `Los ${tipoEntidad} disponibles son`;
    } else if (/bandejas?/i.test(query)) {
        tipoEntidad = results.length === 1 ? 'bandeja' : 'bandejas';
        saludo = cantidadSolicitada ? `Las ${cantidadSolicitada} ${tipoEntidad} que me pediste son` : `Las ${tipoEntidad} disponibles son`;
    }
    
    // Construir respuesta natural
    let respuesta = `${saludo}:\n\n`;
    
    // Filtrar resultados válidos (sin valores vacíos en los campos principales)
    const resultadosValidos = results.filter(resultado => {
        const campos = Object.entries(resultado);
        return campos.some(([campo, valor]) => {
            // Filtrar campos principales que no estén vacíos
            const esCampoPrincipal = campo.includes('DENO') || campo.includes('NOMBRE') || campo.includes('NAME');
            return esCampoPrincipal && valor && valor.toString().trim() !== '';
        });
    });
    
    // Si no hay resultados válidos después del filtro, usar los originales
    const resultadosFinales = resultadosValidos.length > 0 ? resultadosValidos : results;
    
    resultadosFinales.forEach((resultado, index) => {
        // Buscar el campo principal de nombre/denominación
        let nombrePrincipal = null;
        const campos = Object.entries(resultado);
        
        // Prioridad: DENO > NOMBRE > NAME > primer campo con valor
        for (const [campo, valor] of campos) {
            if (!nombrePrincipal && valor && valor.toString().trim() !== '') {
                if (campo.includes('DENO')) {
                    nombrePrincipal = valor;
                    break;
                } else if (campo.includes('NOMBRE') || campo.includes('NAME')) {
                    nombrePrincipal = valor;
                    break;
                }
            }
        }
        
        // Si no encontró campo principal, usar el primer campo con valor
        if (!nombrePrincipal) {
            for (const [campo, valor] of campos) {
                if (valor && valor.toString().trim() !== '') {
                    nombrePrincipal = valor;
                    break;
                }
            }
        }
        
        // Formatear el nombre principal
        if (nombrePrincipal) {
            nombrePrincipal = nombrePrincipal.toString().trim();
            // Capitalizar si está en mayúsculas
            if (nombrePrincipal === nombrePrincipal.toUpperCase() && nombrePrincipal.length > 3) {
                nombrePrincipal = nombrePrincipal.toLowerCase()
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
            }
        }
        
        if (nombrePrincipal) {
            respuesta += `${index + 1}. ${nombrePrincipal}\n`;
        } else {
            respuesta += `${index + 1}. [Sin nombre disponible]\n`;
        }
    });
    
    // Agregar nota adicional según el contexto
    if (resultadosValidos.length < results.length) {
        respuesta += `\n(Nota: Se filtraron algunos registros sin información válida)`;
    }
    
    // Pregunta de seguimiento natural
    if (resultadosFinales.length === 1) {
        respuesta += `\n\n¿Necesitas más información sobre este ${tipoEntidad.replace(/s$/, '')}?`;
    } else if (resultadosFinales.length <= 3) {
        respuesta += `\n\n¿Te interesa información específica de alguno de estos ${tipoEntidad}?`;
    } else {
        respuesta += `\n\n¿Quieres que te dé más detalles de alguno en particular?`;
    }
    
    return respuesta;
}

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
const { promptBase } = require('../prompts/base');
const { sqlRules, generarPromptSQL, generarPromptRAGSQL } = require('../prompts/sqlRules');
const { comportamientoChatGPT, comportamiento, comportamientoAsistente } = require('../prompts/comportamiento');
const { formatoRespuesta, generarPromptFormateador, generarPromptConversacional, generarPromptRAGSQLFormateador, generarPromptErrorFormateador } = require('../prompts/formatoRespuesta');
const ragInteligente = require('./ragInteligente');

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
    const necesitaRAG = intencion.tipo === 'rag_sql' || 
                       mensaje.toLowerCase().includes('qué significa') ||
                       mensaje.toLowerCase().includes('como funciona') ||
                       mensaje.toLowerCase().includes('proceso') ||
                       mensaje.toLowerCase().includes('protocolo') ||
                       mensaje.length > 100;
    
    if (necesitaRAG) {
        try {
            console.log('🧠 [RAG] Recuperando conocimiento empresarial...');
            contextoRAG = await ragInteligente.recuperarConocimientoRelevante(mensaje, 'sistema');
            console.log('✅ [RAG] Conocimiento recuperado:', contextoRAG ? contextoRAG.length : 0, 'caracteres');
        } catch (error) {
            console.error('❌ [RAG] Error recuperando conocimiento:', error.message);
        }
    } else {
        console.log('⚡ [OPTIMIZACIÓN] Saltando RAG - no necesario para esta consulta');
    }
    
    // 6. Ensamblar prompt final (OPTIMIZADO)
    const fechaActual = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' });
    const promptGlobalConFecha = promptGlobal.replace('{{FECHA_ACTUAL}}', fechaActual);
    let promptFinal = `${promptGlobalConFecha}\n` + instruccionesNaturales;
    
    // Añadir conocimiento empresarial solo si es necesario
    if (intencion.tipo === 'conversacion' || intencion.tipo === 'rag_sql' || necesitaRAG) {
        promptFinal += `${promptBase}\n\n`;
    }
    
    // Añadir estructura de datos SIEMPRE - la IA decide si la usa
    promptFinal += `${contextoMapaERP}\n\n`;
    
    // Añadir reglas SQL solo para consultas SQL
    if (intencion.tipo === 'sql' || intencion.tipo === 'rag_sql') {
        promptFinal += `${sqlRules}\n\n`;
    }
    
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
        intencion: intencion,
        tablasRelevantes: [], // IA analiza todas las tablas del mapaERP
        metricas: {
            usaIA: true, // IA analiza mapaERP completo
            tablasDetectadas: Object.keys(mapaERP).length,
            llamadasIA: 1, // ¡Solo UNA llamada!
            optimizado: true,
            modeloUnico: 'gpt-4o',
            mapaERPIncluido: true, // SIEMPRE incluido
            ragIncluido: necesitaRAG
        }
    };
}

/**
 * Analiza la intención de forma inteligente usando análisis de texto rápido
 */
async function analizarIntencionInteligente(mensaje) {
    console.log('🧠 [INTENCION-INTELIGENTE] Analizando consulta...');
    
    try {
        // Análisis de texto simple y rápido (sin embeddings costosos)
        const mensajeLower = mensaje.toLowerCase();
        
        // Patrones para consultas de datos
        const patronesSQL = [
            'cuántos', 'cuantas', 'cuanto', 'cuanta', 'dame', 'muestra', 'lista',
            'clientes', 'proveedores', 'artículos', 'bandejas', 'partidas',
            'registros', 'datos', 'información', 'tabla', 'cuántas', 'cuánto'
        ];
        
        // Patrones para consultas de conocimiento
        const patronesConocimiento = [
            'qué significa', 'que significa', 'como funciona', 'cómo funciona',
            'protocolo', 'proceso', 'procedimiento', 'cuando el cliente',
            'quiero todo', 'pedro muñoz', 'germinación', 'cámara',
            'entrada en cámara', 'desinfección', 'fertilizante', 'qué es',
            'que es', 'explica', 'describe'
        ];
        
        // Patrones para conversación simple
        const patronesConversacion = [
            'hola', 'buenos', 'buenas', 'saludos', 'gracias', 'ok', 'okay',
            'perfecto', 'genial', 'excelente', 'bien', 'mal', 'ayuda'
        ];
        
        // Análisis rápido por conteo de patrones
        const scoreSQL = patronesSQL.filter(patron => mensajeLower.includes(patron)).length;
        const scoreConocimiento = patronesConocimiento.filter(patron => mensajeLower.includes(patron)).length;
        const scoreConversacion = patronesConversacion.filter(patron => mensajeLower.includes(patron)).length;
        
        // Clasificación inteligente basada en scores
        if (scoreSQL > 0 && scoreConocimiento > 0) {
            return { tipo: 'rag_sql', confianza: 0.9 };
        } else if (scoreSQL > 0) {
            return { tipo: 'sql', confianza: 0.9 };
        } else if (scoreConocimiento > 0) {
            return { tipo: 'rag_sql', confianza: 0.8 };
        } else if (scoreConversacion > 0) {
            return { tipo: 'conversacion', confianza: 0.9 };
        }
        
        // Por defecto, asumir que necesita datos si es una pregunta
        if (mensajeLower.includes('?')) {
            return { tipo: 'sql', confianza: 0.7 };
        }
        
        // Si no hay patrones claros, asumir conversación
        return { tipo: 'conversacion', confianza: 0.8 };
        
    } catch (error) {
        console.error('❌ [INTENCION-INTELIGENTE] Error:', error.message);
        // Fallback a conversación
        return { tipo: 'conversacion', confianza: 0.5 };
    }
}

/**
 * Detecta tablas relevantes usando SOLO mapaERP real (sin hardcodeo)
 */
async function detectarTablasInteligente(mensaje, mapaERP) {
    console.log('📊 [TABLAS-INTELIGENTE] Detectando tablas con mapaERP real...');
    
    try {
        const mensajeLower = mensaje.toLowerCase();
        const tablasDisponibles = Object.keys(mapaERP);
        console.log('📊 [TABLAS-INTELIGENTE] Tablas disponibles en mapaERP:', tablasDisponibles);
        
        // Análisis semántico usando SOLO las tablas que existen en mapaERP
        const tablasRelevantes = [];
        
        // Para cada tabla en mapaERP, buscar palabras clave en su descripción
        for (const [nombreTabla, infoTabla] of Object.entries(mapaERP)) {
            const descripcionTabla = infoTabla.descripcion?.toLowerCase() || '';
            const columnasTabla = Object.keys(infoTabla.columnas || {}).join(' ').toLowerCase();
            
            // Buscar palabras del mensaje en la descripción y columnas de la tabla
            const palabrasMensaje = mensajeLower.split(/\s+/);
            
            for (const palabra of palabrasMensaje) {
                if (palabra.length < 3) continue; // Ignorar palabras muy cortas
                
                // Buscar en descripción de tabla
                if (descripcionTabla.includes(palabra)) {
                    tablasRelevantes.push(nombreTabla);
                    console.log(`📊 [TABLAS-INTELIGENTE] Coincidencia: "${palabra}" en tabla "${nombreTabla}"`);
                    break;
                }
                
                // Buscar en nombres de columnas
                if (columnasTabla.includes(palabra)) {
                    tablasRelevantes.push(nombreTabla);
                    console.log(`📊 [TABLAS-INTELIGENTE] Coincidencia columna: "${palabra}" en tabla "${nombreTabla}"`);
                    break;
                }
            }
        }
        
        // Si no encuentra nada específico, incluir tablas comunes que SÍ existen
        if (tablasRelevantes.length === 0) {
            const tablasComunes = ['clientes', 'articulos', 'tecnicos'];
            const tablasComunesExistentes = tablasComunes.filter(tabla => tablasDisponibles.includes(tabla));
            tablasRelevantes.push(...tablasComunesExistentes);
            console.log('📊 [TABLAS-INTELIGENTE] Usando tablas comunes:', tablasComunesExistentes);
        }
        
        // Eliminar duplicados
        const tablasUnicas = [...new Set(tablasRelevantes)];
        
        console.log('📊 [TABLAS-INTELIGENTE] Tablas detectadas (reales):', tablasUnicas);
        return tablasUnicas;
        
    } catch (error) {
        console.error('❌ [TABLAS-INTELIGENTE] Error:', error.message);
        // Fallback a tablas que sabemos que existen
        return ['clientes', 'articulos', 'tecnicos'];
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

/**
 * Función principal para procesar consultas de administrador
 * @param {Object} params - Parámetros de la consulta
 * @param {string} params.message - Mensaje del usuario
 * @param {string} params.userId - ID del usuario
 * @param {string} params.conversationId - ID de la conversación (opcional)
 * @returns {Object} Respuesta procesada
 */
async function processQuery({ message, userId, conversationId }) {
    const tiempoInicio = Date.now();
    console.log('🚀 [SISTEMA] ===== INICIANDO PROCESO ULTRA-RÁPIDO =====');
    console.log('🚀 [SISTEMA] Procesando consulta:', message);
    console.log('🚀 [SISTEMA] Usuario ID:', userId);
    console.log('🚀 [SISTEMA] Conversación ID:', conversationId);
    
    // =====================================
    // LOGS PARA IDENTIFICAR ARCHIVOS USADOS EN ESTA CONSULTA
    // =====================================
    console.log('🔍 [CONSULTA] ===== ARCHIVOS USADOS EN ESTA CONSULTA =====');
    console.log('🟢 Se está usando: openAI.js (admin/core)');

    // =====================================
    // OBTENER INFORMACIÓN DEL USUARIO Y CONTEXTO (PARALELO)
    // =====================================
    
    const [infoUsuario, historialConversacion] = await Promise.all([
        obtenerInfoUsuario(userId),
        obtenerHistorialConversacion(userId, conversationId)
    ]);

    // =====================================
    // OPTIMIZACIÓN: Guardar mensaje al final (no bloquea)
    // =====================================
    const guardarMensaje = () => saveMessageToFirestore(userId, message).catch(err => 
        console.error('❌ [FIRESTORE] Error guardando mensaje:', err.message)
    );

    // =====================================
    // OPTIMIZACIÓN: Análisis rápido de tipo de consulta
    // =====================================
    const esConsultaSimple = message.length < 50 && !message.includes('?') && !message.includes('cuántos') && !message.includes('dame') && !message.includes('muestra');
    const tieneHistorial = historialConversacion && historialConversacion.length > 0;
    
    // =====================================
    // CONTEXTO DE MEMORIA (OPTIMIZADO)
    // =====================================
    
    let contextoPinecone = '';
    
    // Solo buscar memoria si hay historial Y no es consulta simple
    if (tieneHistorial && !esConsultaSimple) {
        console.log('🧠 [MEMORIA] Consulta requiere contexto - buscando en memoria...');
        
        const ultimosMensajes = historialConversacion.slice(-2);
        const contextoConversacional = ultimosMensajes.map(msg => 
            `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`
        ).join('\n');
            
        contextoPinecone += `\n=== CONTEXTO CONVERSACIONAL RECIENTE ===\n${contextoConversacional}\n\nINSTRUCCIÓN: Mantén la continuidad de la conversación anterior.`;
        
        // Memoria en background (no bloquear)
        pineconeMemoria.agregarContextoMemoria(userId, message)
            .catch(error => console.error('❌ [PINECONE] Error:', error.message));
    } else {
        console.log('⚡ [OPTIMIZACIÓN] Sin historial o consulta simple - saltando búsqueda de memoria');
    }

    // =====================================
    // CONSTRUIR PROMPT OPTIMIZADO
    // =====================================
    
    console.log('🧠 [IA-INTELIGENTE] Construyendo prompt OPTIMIZADO...');
    const promptBuilder = await construirPromptInteligente(
        message, 
        mapaERP,
        openai,
        contextoPinecone, 
        lastRealData || '',
        historialConversacion,
        false
    );
    
    console.log('🧠 [IA-INTELIGENTE] Intención:', promptBuilder.intencion.tipo, 'Modelo:', promptBuilder.configModelo.modelo);

    // =====================================
    // PROCESAMIENTO DE CONSULTA CON IA
    // =====================================

    console.log('🧠 [ETAPA-1] ===== GPT RECIBE LA CONSULTA =====');
    console.log('🧠 [ETAPA-1] Preparando llamada a OpenAI...');

    // Construir mensajes
    const mensajesLlamada = [
        {
            role: 'system',
            content: promptBuilder.prompt
        }
    ];

    // Agregar historial conversacional solo si existe
    if (tieneHistorial) {
        historialConversacion.forEach((msg) => {
            mensajesLlamada.push({
                role: msg.role,
                content: msg.content
            });
        });
    }

    // Agregar mensaje actual
    mensajesLlamada.push({
        role: 'user', 
        content: message
    });

    // =====================================
    // LLAMADA A OPENAI (OPTIMIZADA)
    // =====================================

    console.log('🤖 [OPENAI] Llamando a', promptBuilder.configModelo.modelo);

    try {
        const response = await openai.chat.completions.create({
            model: promptBuilder.configModelo.modelo,
            messages: mensajesLlamada,
            max_tokens: promptBuilder.configModelo.maxTokens,
            temperature: promptBuilder.configModelo.temperature,
            stream: false
        });

        const respuestaIA = response.choices[0].message.content;
        console.log('✅ [OPENAI] Respuesta recibida de OpenAI');
        console.log('📊 [OPENAI] Tokens usados:', response.usage?.total_tokens || 'N/A');

        // =====================================
        // PROCESAMIENTO POST-IA (OPTIMIZADO)
        // =====================================

        console.log('🔍 [POST-PROCESAMIENTO] Analizando respuesta para SQL...');
        
        // Verificar si la respuesta contiene SQL
        const sqlMatch = respuestaIA.match(/<sql>(.*?)<\/sql>/s);
        
        if (sqlMatch) {
            console.log('🔍 [SQL] SQL detectado en respuesta');
            const sql = sqlMatch[1].trim();
            
            try {
                console.log('🔍 [SQL] Ejecutando SQL:', sql);
                const resultados = await executeQuery(sql);
                
                if (resultados && resultados.length > 0) {
                    console.log('✅ [SQL] Resultados obtenidos:', resultados.length, 'registros');
                    
                    // Formatear resultados y generar explicación
                    const resultadosFormateados = formatResultsAsMarkdown(resultados);
                    const respuestaFinal = await formatFinalResponse(resultados, message);
                    
                    // Guardar mensaje al final (no bloquea)
                    guardarMensaje();
                    
                    const tiempoTotal = Date.now() - tiempoInicio;
                    console.log('✅ [SISTEMA] Proceso completado en', tiempoTotal, 'ms');
                    
                    return {
                        success: true,
                        response: respuestaFinal,
                        data: resultados,
                        sql: sql,
                        tiempo: tiempoTotal
                    };
                } else {
                    console.log('⚠️ [SQL] No se encontraron resultados');
                    const respuestaSinDatos = `No se encontraron registros en la base de datos para tu consulta.`;
                    
                    // Guardar mensaje al final (no bloquea)
                    guardarMensaje();
                    
                    const tiempoTotal = Date.now() - tiempoInicio;
                    console.log('✅ [SISTEMA] Proceso completado en', tiempoTotal, 'ms');
                    
                    return {
                        success: true,
                        response: respuestaSinDatos,
                        data: [],
                        sql: sql,
                        tiempo: tiempoTotal
                    };
                }
            } catch (error) {
                console.error('❌ [SQL] Error ejecutando SQL:', error.message);
                
                // Intentar retry con fuzzy search
                console.log('🔄 [SQL] Intentando retry con búsqueda fuzzy...');
                const resultadoRetry = await fuzzySearchRetry(sql, message);
                
                if (resultadoRetry.success) {
                    // Guardar mensaje al final (no bloquea)
                    guardarMensaje();
                    
                    const tiempoTotal = Date.now() - tiempoInicio;
                    console.log('✅ [SISTEMA] Proceso completado con retry en', tiempoTotal, 'ms');
                    
                    return resultadoRetry;
                } else {
                    const respuestaError = `Lo siento, no pude procesar tu consulta correctamente. Por favor, reformula tu pregunta de manera más específica.`;
                    
                    // Guardar mensaje al final (no bloquea)
                    guardarMensaje();
                    
                    const tiempoTotal = Date.now() - tiempoInicio;
                    console.log('❌ [SISTEMA] Proceso falló en', tiempoTotal, 'ms');
                    
                    return {
                        success: false,
                        response: respuestaError,
                        error: error.message,
                        tiempo: tiempoTotal
                    };
                }
            }
        } else {
            console.log('📚 [RESPUESTA] Sin SQL - usar respuesta del modelo tal como está');
            
            // Personalizar respuesta
            const respuestaPersonalizada = personalizarRespuesta(respuestaIA, infoUsuario.nombre);
            
            // Guardar mensaje al final (no bloquea)
            guardarMensaje();
            
            const tiempoTotal = Date.now() - tiempoInicio;
            console.log('✅ [SISTEMA] Proceso completado en', tiempoTotal, 'ms');
            
            return {
                success: true,
                response: respuestaPersonalizada,
                tiempo: tiempoTotal
            };
        }

    } catch (error) {
        console.error('❌ [OPENAI] Error en llamada a OpenAI:', error.message);
        
        // Guardar mensaje al final (no bloquea)
        guardarMensaje();
        
        const tiempoTotal = Date.now() - tiempoInicio;
        console.log('❌ [SISTEMA] Proceso falló en', tiempoTotal, 'ms');
        
        return {
            success: false,
            response: 'Lo siento, hubo un error procesando tu consulta. Por favor, intenta de nuevo.',
            error: error.message,
            tiempo: tiempoTotal
        };
    }
}

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
                            message: '🔎 Consultando la base de datos...',
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
                try {
                    const results = await executeQuery(sql);
                    
                    if (results && results.length > 0) {
                        // Guardar los resultados reales para contexto futuro
                        lastRealData = JSON.stringify(results);
                        
                        console.log('✅ [STREAMING] SQL ejecutado exitosamente - haciendo segunda llamada para explicar datos');
                        
                        // Segunda llamada a la IA para explicar los datos reales de forma natural
                        const promptExplicacion = `Eres un asistente experto de Semilleros Deitana. Tu tarea es explicar de forma natural y amigable los resultados de una consulta SQL.\n\nCONSULTA ORIGINAL: \"${message}\"\nSQL EJECUTADO: ${sql}\nRESULTADOS: ${JSON.stringify(results, null, 2)}\n\nINSTRUCCIONES:\n- Explica los resultados de forma natural y conversacional\n- Usa \"NOSOTROS\" y \"NUESTRA empresa\" como empleado interno\n- Sé específico sobre los datos encontrados\n- Si no hay resultados, explica claramente que no se encontraron registros\n- Mantén un tono amigable y profesional\n- Usa emojis apropiados para hacer la respuesta más atractiva\n\nResponde como si fueras un empleado de Semilleros Deitana explicando los datos a un compañero.`;

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
// Este módulo exporta las funciones principales:
// - processQuery: Procesamiento estándar de consultas
// - processQueryStream: Procesamiento con streaming en tiempo real
// 
// USO EN OTROS ARCHIVOS:
// const { processQuery, processQueryStream } = require('./admin/core/openAI');
// =====================================

/**
 * Exportar la función principal para su uso en otros archivos
 */
module.exports = {
    processQuery,
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
    // ✅ MODELO ÚNICO OPTIMIZADO PARA TODAS LAS TAREAS
    const config = {
        modelo: 'gpt-4o',           // Modelo más capaz para todas las tareas
        maxTokens: 2000,            // Tokens suficientes para consultas complejas
        temperature: 0.3,           // Balance entre creatividad y precisión
        razon: 'Modelo único optimizado: gpt-4o maneja SQL, conversación y RAG+SQL con excelente rendimiento'
    };
    

    
    return config;
}

/**
 * Construye las instrucciones naturales para el prompt
 */
function construirInstruccionesNaturales(intencion, tablasRelevantes, contextoPinecone) {
    let instrucciones = comportamientoChatGPT + '\n\n';
    instrucciones += `\n## 🏢 CONTEXTO EMPRESARIAL\n\nEres un empleado experto de **Semilleros Deitana** trabajando desde adentro de la empresa.\n\n**TU IDENTIDAD:**\n- 🏢 Trabajas EN Semilleros Deitana (no "para" - estás DENTRO)\n- 🌱 Conoces NUESTROS procesos de producción de semillas y plántulas\n- 🍅 Sabes cómo funcionar NUESTROS sistemas de cultivo e injertos  \n- 🔬 Entiendes NUESTRAS certificaciones ISO 9001 y estándares de calidad\n- 🏗️ Conoces NUESTRAS instalaciones en Totana, Murcia\n\n**FORMA DE HABLAR:**\n- Usa "NOSOTROS", "NUESTRA empresa", "NUESTROS sistemas"\n- Jamás digas "una empresa" o "la empresa" - es NUESTRA empresa\n- Habla como empleado que conoce los detalles internos\n- Sé específico sobre NUESTROS procesos reales\n\n## 🧠 INTELIGENCIA HÍBRIDA - CONOCIMIENTO + DATOS\n\n### 📚 **CONOCIMIENTO EMPRESARIAL (PRIORIDAD)**\n- Usa SIEMPRE el conocimiento empresarial como base principal\n- El contexto de Pinecone contiene información oficial de la empresa\n- Úsalo para explicar procedimientos, protocolos y conceptos\n\n### 🗄️ **DATOS DE BASE DE DATOS (CUANDO SEA NECESARIO)**\n- Si la consulta requiere datos actuales específicos, genera SQL\n- Formato: \`<sql>SELECT...</sql>\`\n- Usa EXACTAMENTE las columnas de la estructura proporcionada\n- Combina conocimiento + datos de forma natural\n- **NUNCA inventes datos de entidades** (clientes, proveedores, almacenes, etc.)\n- **SIEMPRE genera SQL real** y deja que el sistema ejecute y muestre datos reales\n- **SI no hay datos reales**, di claramente "No se encontraron registros en la base de datos"\n\n### 🤝 **COMBINACIÓN INTELIGENTE**\n- Explica el "por qué" usando conocimiento empresarial\n- Muestra el "qué" usando datos actuales cuando sea útil\n- Mantén respuestas naturales y conversacionales\n- **NUNCA mezcles datos inventados con datos reales**\n\n## 🎯 **EJEMPLOS DE USO**\n\n**Consulta sobre conocimiento:**\n"qué significa quando el cliente dice quiero todo"\n→ Usa SOLO conocimiento empresarial\n\n**Consulta sobre datos actuales:**\n"dame 2 clientes"\n→ Combina conocimiento + datos SQL\n\n**Consulta compleja:**\n"cuántos artículos hay y qué tipos"\n→ Explica con conocimiento + muestra datos actuales\n\n## ✅ **REGLAS IMPORTANTES**\n\n1. **SIEMPRE responde** - nunca digas "no tengo información"\n2. **Usa emojis** y tono amigable\n3. **Mantén personalidad** de empleado interno\n4. **Combina fuentes** cuando sea apropiado\n5. **Sé útil y completo** - no restrictivo\n\n`;
    instrucciones += formatoObligatorio;
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