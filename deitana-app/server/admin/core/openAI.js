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
const promptBase = require('./promptBase').promptBase;
const mapaERP = require('./mapaERP');
const { construirPromptInteligente } = require('../prompts/construirPrompt');

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

// Función para formatear la respuesta final - RESPUESTAS NATURALES
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
 * Función principal para procesar consultas de administrador
 * @param {Object} params - Parámetros de la consulta
 * @param {string} params.message - Mensaje del usuario
 * @param {string} params.userId - ID del usuario
 * @param {string} params.conversationId - ID de la conversación (opcional)
 * @returns {Object} Respuesta procesada
 */
async function processQuery({ message, userId, conversationId }) {
    const tiempoInicio = Date.now();
    console.log('🚀 [SISTEMA] ===== INICIANDO PROCESO DE CONSULTA OPTIMIZADO =====');
    console.log('🚀 [SISTEMA] Procesando consulta:', message);
    console.log('🚀 [SISTEMA] Usuario ID:', userId);
    console.log('🚀 [SISTEMA] Conversación ID:', conversationId);

    // =====================================
    // OBTENER INFORMACIÓN DEL USUARIO Y CONTEXTO
    // =====================================
    
    const infoUsuario = await obtenerInfoUsuario(userId);
    const historialConversacion = await obtenerHistorialConversacion(userId, conversationId);

        // =====================================
    // INICIALIZACIÓN DE LANGFUSE (temporalmente deshabilitado)
        // =====================================

    // const trace = langfuseUtils.iniciarTrace('consulta-optimizada', userId, message);
    
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
        
        // Detección mejorada para consultas que necesitan memoria o contexto
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
            
            try {
                const memoriaAdicional = await pineconeMemoria.agregarContextoMemoria(userId, message);
                if (memoriaAdicional) {
                    contextoPinecone += `\n${memoriaAdicional}`;
                }
            } catch (error) {
                console.error('❌ [PINECONE] Error buscando recuerdos:', error.message);
            }
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
        console.log('🧠 [IA-INTELIGENTE] Razón selección:', promptBuilder.configModelo.razon);
        console.log('🧠 [IA-INTELIGENTE] Tablas relevantes:', promptBuilder.tablasRelevantes);
        console.log('🧠 [IA-INTELIGENTE] Usa IA:', promptBuilder.metricas.usaIA);
        console.log('🧠 [IA-INTELIGENTE] Llamadas IA eliminadas:', promptBuilder.metricas.llamadasIA);
        console.log('🧠 [IA-INTELIGENTE] Optimizado:', promptBuilder.metricas.optimizado);

        // =====================================
        // PROCESAMIENTO DE CONSULTA CON UNA SOLA LLAMADA IA
        // =====================================

        let sql = null;
        let intentos = 0;
        const MAX_INTENTOS = 2;
        let feedback = '';
        let errorSQL = null;
        
        while (intentos < MAX_INTENTOS && !sql) {
        console.log('🧠 [ETAPA-1] ===== GPT RECIBE LA CONSULTA =====');
            console.log('🧠 [ETAPA-1] Preparando llamada ÚNICA a OpenAI...');
            console.log('🧠 [ETAPA-1] Intento:', intentos + 1);

            try {
                const mensajesLlamada = [
                    {
                        role: 'system',
                        content: promptBuilder.prompt
                    },
                    {
                        role: 'user', 
                        content: message
                    }
                ];

                if (feedback) {
                    mensajesLlamada.push({
                        role: 'assistant',
                        content: 'Error en la consulta anterior.'
                    });
                    mensajesLlamada.push({
                        role: 'user',
                        content: `Error anterior: ${feedback}. Corrige la consulta.`
                    });
                }

                console.log('🧠 [ETAPA-1] Mensajes a enviar:', mensajesLlamada.length);
                console.log('📊 [OPENAI] Registrando llamada ÚNICA a OpenAI...');

                // CONFIGURACIÓN DEL MODELO DINÁMICO
                console.log('🤖 [MODELO-DINÁMICO] Usando modelo:', promptBuilder.configModelo.modelo);
                console.log('🤖 [MODELO-DINÁMICO] Max tokens:', promptBuilder.configModelo.maxTokens);
                console.log('🤖 [MODELO-DINÁMICO] Temperature:', promptBuilder.configModelo.temperature);

                // Llamada directa a OpenAI sin Langfuse temporalmente
                const response = await openai.chat.completions.create({
                    model: promptBuilder.configModelo.modelo,
                    messages: mensajesLlamada,
                    max_tokens: promptBuilder.configModelo.maxTokens,
                    temperature: promptBuilder.configModelo.temperature
                });

                console.log('✅ [ETAPA-1] Respuesta recibida de OpenAI');
                const respuestaIA = response.choices[0].message.content;
                
                // Métricas básicas sin Langfuse
                const tokensLlamada = response.usage;
                const costoEstimado = (tokensLlamada.total_tokens * 0.00003);

                console.log('📊 [TOKENS] Input:', tokensLlamada.prompt_tokens);
                console.log('📊 [TOKENS] Output:', tokensLlamada.completion_tokens);
                console.log('📊 [TOKENS] Total:', tokensLlamada.total_tokens);
                console.log('💰 [COSTO] Estimado: $', costoEstimado.toFixed(6));
                
                // =====================================
                // PROCESAMIENTO DE RESPUESTA ÚNICA
                // =====================================
                
                // =====================================
                // PROCESAMIENTO SEGÚN TIPO DE CONSULTA
                // =====================================
                
                if (promptBuilder.intencion.tipo === 'rag_sql') {
                    console.log('🔄 [RAG-SQL] Procesando consulta RAG + SQL combinado');
                    
                    // Extraer SQL si existe en la respuesta
                    sql = validarRespuestaSQL(respuestaIA);
                    
                    let finalMessage = respuestaIA;
                    
                    // Si hay SQL, ejecutarlo y combinar con la respuesta RAG
                    if (sql) {
                        console.log('✅ [RAG-SQL] SQL encontrado, ejecutando para ejemplos');
                        const results = await executeQuery(sql);
                        
                        // Guardar los resultados reales para contexto futuro
                        lastRealData = JSON.stringify(results);
                        
                        // Mantener la respuesta original de la IA - NO formatear artificialmente
                        console.log('✅ [RAG-SQL] SQL ejecutado exitosamente - manteniendo respuesta natural de la IA');
                    }
                    
                    console.log('📋 [RAG-SQL] Respuesta combinada:', finalMessage.substring(0, 200) + '...');
                    console.log('📋 [RAG-SQL] Longitud:', finalMessage.length, 'caracteres');
                    
                    // Guardar async para no bloquear la respuesta
                    saveAssistantMessageToFirestore(userId, finalMessage).catch(err =>
                        console.error('❌ [FIRESTORE] Error guardando respuesta:', err.message)
                    );
                    console.log('✅ [SISTEMA] Respuesta RAG+SQL enviada correctamente (async)');
                    
                    // Guardado en memoria para RAG+SQL (solo si es importante)
                    if (finalMessage.length > 200 || message.includes('proceso') || message.includes('procedimiento')) {
                        try {
                            console.log('💾 [PINECONE] Guardando conversación RAG+SQL importante en memoria...');
                            await pineconeMemoria.guardarAutomatico(userId, message, finalMessage);
                            console.log('✅ [PINECONE] Memoria actualizada exitosamente');
                        } catch (error) {
                            console.error('❌ [PINECONE] Error guardando en memoria:', error.message);
                        }
                    } else {
                        console.log('⚡ [OPTIMIZACIÓN] Respuesta simple - saltando guardado en memoria');
                    }
                    
                    const tiempoTotal = Date.now() - tiempoInicio;
                    console.log('📊 [MÉTRICAS] Tiempo total:', tiempoTotal, 'ms');
                    console.log('📊 [MÉTRICAS] Tokens totales:', tokensLlamada.total_tokens);
                    console.log('📊 [MÉTRICAS] Costo estimado: $', costoEstimado.toFixed(6));
                    console.log('📊 [MÉTRICAS] RAG+SQL exitoso - Optimizado: true, Llamadas IA: 1');
                    
                    return { success: true, data: { message: finalMessage } };
                    
                } else {
                    // Procesamiento normal para SQL puro o conversación
                    sql = validarRespuestaSQL(respuestaIA);
                    
                    if (sql) {
                        console.log('✅ [SQL-ENCONTRADO] SQL válido generado en el primer intento');
                        
                        // Ejecutar SQL
                        const results = await executeQuery(sql);
                        
                        // Guardar los resultados reales para contexto futuro
                        lastRealData = JSON.stringify(results);
                        
                        // Segunda llamada a la IA para explicar los datos reales de forma natural
                        let finalMessage = respuestaIA;
                        
                        if (results && results.length > 0) {
                            console.log('✅ [PROCESS-QUERY] SQL ejecutado exitosamente - haciendo segunda llamada para explicar datos');
                            
                            const promptExplicacion = `Eres un asistente operativo de Semilleros Deitana. 
                            
El usuario preguntó: "${message}"

La IA generó este SQL: ${sql}

Y estos son los resultados reales obtenidos de la base de datos:
${JSON.stringify(results, null, 2)}

## 🏢 CONTEXTO EMPRESARIAL

Eres un empleado experto de **Semilleros Deitana** trabajando desde adentro de la empresa.

**TU IDENTIDAD:**
- 🏢 Trabajas EN Semilleros Deitana (no "para" - estás DENTRO)
- 🌱 Conoces NUESTROS procesos de producción de semillas y plántulas
- 🍅 Sabes cómo funcionar NUESTROS sistemas de cultivo e injertos  
- 🔬 Entiendes NUESTRAS certificaciones ISO 9001 y estándares de calidad
- 🏗️ Conoces NUESTRAS instalaciones en Totana, Murcia

**FORMA DE HABLAR:**
- Usa "NOSOTROS", "NUESTRA empresa", "NUESTROS sistemas"
- Jamás digas "una empresa" o "la empresa" - es NUESTRA empresa
- Habla como empleado que conoce los detalles internos
- Sé específico sobre NUESTROS procesos reales

## 🎯 TU TAREA

Explica estos datos de forma natural, amigable y útil, igual que cuando explicas información del conocimiento empresarial.

**REGLAS IMPORTANTES:**
- ❌ NO menciones que es una "segunda llamada" ni que "procesaste datos"
- ✅ Explica los resultados de forma natural y contextualizada
- ✅ Si hay pocos resultados, explícalos uno por uno
- ✅ Si hay muchos, haz un resumen y menciona algunos ejemplos
- ✅ Usa un tono profesional pero amigable
- ✅ Incluye información relevante como ubicaciones, contactos, etc. si están disponibles
- ✅ Usa emojis y formato atractivo como ChatGPT

## 🎨 FORMATO OBLIGATORIO

**OBLIGATORIO en cada respuesta:**
- 🏷️ **Título con emoji** relevante
- 📋 **Estructura organizada** con encabezados
- ✅ **Listas con emojis** para puntos clave
- 💡 **Blockquotes** para tips importantes
- 🔧 **Código formateado** cuando corresponda
- 📊 **Tablas** para comparaciones/datos
- 😊 **Emojis apropiados** al contexto
- 🤔 **Preguntas de seguimiento** útiles

**¡Sé exactamente como ChatGPT: útil, inteligente y visualmente atractivo!** 🚀

Responde de forma natural, como si estuvieras explicando información del conocimiento empresarial:`;

                            const segundaLlamada = await openai.chat.completions.create({
                                model: 'gpt-3.5-turbo',
                                messages: [
                                    {
                                        role: 'system',
                                        content: promptExplicacion
                                    }
                                ],
                                max_tokens: 500,
                                temperature: 0.7
                            });

                            const explicacionNatural = segundaLlamada.choices[0].message.content;
                            
                            // Reemplazar la respuesta técnica con la explicación natural
                            finalMessage = explicacionNatural;
                            
                            console.log('✅ [PROCESS-QUERY] Segunda llamada completada - respuesta natural generada');
                        }
                        
                        // =====================================
                        // PERSONALIZAR RESPUESTA CON NOMBRE DEL USUARIO
                        // =====================================
                        const respuestaPersonalizada = personalizarRespuesta(finalMessage, infoUsuario.nombre);
                        
                        console.log('📋 [RESPUESTA-FINAL] Respuesta optimizada:', respuestaPersonalizada.substring(0, 200) + '...');
                        console.log('📋 [RESPUESTA-FINAL] Longitud:', respuestaPersonalizada.length, 'caracteres');
                
                        // Guardar async para no bloquear la respuesta
                        saveAssistantMessageToFirestore(userId, respuestaPersonalizada).catch(err =>
                            console.error('❌ [FIRESTORE] Error guardando respuesta:', err.message)
                        );
                        console.log('✅ [SISTEMA] Respuesta final enviada correctamente (async)');
                        console.log('🎯 [RESUMEN] OPTIMIZACIÓN EXITOSA: Una sola llamada GPT generó respuesta completa');
                        
                        const tiempoTotal = Date.now() - tiempoInicio;
                        console.log('📊 [MÉTRICAS] Tiempo total:', tiempoTotal, 'ms');
                        console.log('📊 [MÉTRICAS] Tokens totales:', tokensLlamada.total_tokens);
                        console.log('📊 [MÉTRICAS] Costo estimado: $', costoEstimado.toFixed(6));
                        console.log('📊 [MÉTRICAS] Consulta SQL exitosa - Optimizado: true, Llamadas IA: 1');
                        
                        return {
                            success: true,
                            data: {
                                message: respuestaPersonalizada
                            }
                        };
                    } else {
                        // No hay SQL, puede ser respuesta conversacional
                        console.log('ℹ️ [CONVERSACION] No se detectó SQL, procesando como conversación');
                        
                        // =====================================
                        // PERSONALIZAR RESPUESTA CONVERSACIONAL CON NOMBRE DEL USUARIO
                        // =====================================
                        const respuestaPersonalizada = personalizarRespuesta(respuestaIA, infoUsuario.nombre);
                        
                        // Guardar async para no bloquear la respuesta
                        saveAssistantMessageToFirestore(userId, respuestaPersonalizada).catch(err =>
                            console.error('❌ [FIRESTORE] Error guardando respuesta:', err.message)
                        );
                        console.log('✅ [SISTEMA] Respuesta conversacional enviada (async)');
                        
                        // Guardado en memoria (solo si es importante)
                        if (respuestaPersonalizada.length > 400 || message.includes('importante') || message.includes('recuerda') || message.includes('proceso') || message.includes('procedimiento')) {
                            try {
                                console.log('💾 [PINECONE] Guardando conversación importante en memoria...');
                                await pineconeMemoria.guardarAutomatico(userId, message, respuestaPersonalizada);
                                console.log('✅ [PINECONE] Memoria actualizada exitosamente');
                            } catch (error) {
                                console.error('❌ [PINECONE] Error guardando en memoria:', error.message);
                            }
                        } else {
                            console.log('⚡ [OPTIMIZACIÓN] Conversación simple - saltando guardado en memoria');
                        }
                        
                        const tiempoTotal = Date.now() - tiempoInicio;
                        console.log('📊 [MÉTRICAS] Tiempo total:', tiempoTotal, 'ms');
                        console.log('📊 [MÉTRICAS] Tokens totales:', tokensLlamada.total_tokens);
                        console.log('📊 [MÉTRICAS] Costo estimado: $', costoEstimado.toFixed(6));
                        
                        return {
                            success: true,
                            data: {
                                message: respuestaPersonalizada
                            }
                        };
                    }
                }
                
            } catch (error) {
                console.error('❌ [SQL-ERROR] Error en llamada a OpenAI:', error.message);
                
                feedback = 'Error en la llamada a OpenAI. Por favor, genera una consulta SQL válida y ejecutable.';
                errorSQL = error;
                intentos++;
                sql = null;
                
                console.log('🔄 [SISTEMA] Reintentando... Intento:', intentos + 1);
            }
        }
        
        // =====================================
        // FALLBACK FINAL SI NO HAY RESPUESTA VÁLIDA
        // =====================================
        
        console.log('⚠️ [FALLBACK] No se pudo procesar después de 2 intentos');
        console.log('⚠️ [FALLBACK] Enviando respuesta de fallback conversacional');
        
        const fallbackResponse = {
            success: true,
            data: {
                message: "No pude procesar tu consulta. ¿Podrías intentar ser más específico? Puedo ayudarte con información de clientes, técnicos, almacenes o artículos."
            }
        };
        
        await saveAssistantMessageToFirestore(userId, fallbackResponse.data.message);
        console.log('✅ [FALLBACK] Respuesta de fallback enviada');
        
        // No guardar fallbacks en memoria - no aportan valor
        console.log('⚡ [OPTIMIZACIÓN] Fallback - no guardando en memoria');
        
        const tiempoTotal = Date.now() - tiempoInicio;
        console.log('📊 [MÉTRICAS] Tiempo total:', tiempoTotal, 'ms');
        console.log('📊 [MÉTRICAS] Fallback enviado - Optimizado: true, Llamadas IA: 0');
        
        return fallbackResponse;
        
    } catch (error) {
        console.error('💥 [SISTEMA-ERROR] Error crítico en processQuery:', error);
        console.error('💥 [SISTEMA-ERROR] Stack trace:', error.stack);
        
        // langfuseUtils.registrarError(trace, error, 'sistema-critico');
        
        const errorMessage = "Disculpa, tuve un problema procesando tu consulta. ¿Podrías intentar de nuevo con una pregunta más específica?";
        await saveAssistantMessageToFirestore(userId, errorMessage);
        
        console.log('🚨 [SISTEMA-ERROR] Respuesta de error enviada al usuario');
        
        // No guardar errores en memoria - no aportan valor
        console.log('⚡ [OPTIMIZACIÓN] Error - no guardando en memoria');
        
        const tiempoTotal = Date.now() - tiempoInicio;
        console.log('📊 [MÉTRICAS] Tiempo total:', tiempoTotal, 'ms');
        console.log('📊 [MÉTRICAS] Error crítico - Optimizado: true, Llamadas IA: 0');
        
        return {
            success: true,
            data: { message: errorMessage }
        };
    }
}

// =====================================
// FUNCIÓN STREAMING PARA TIEMPO REAL
// =====================================

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
        
        // Detección mejorada para consultas que necesitan memoria o contexto
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
            
            try {
                const memoriaAdicional = await pineconeMemoria.agregarContextoMemoria(userId, message);
                if (memoriaAdicional) {
                    contextoPinecone += `\n${memoriaAdicional}`;
                }
            } catch (error) {
                console.error('❌ [PINECONE] Error buscando recuerdos:', error.message);
            }
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

        const mensajesLlamada = [
            {
                role: 'system',
                content: promptBuilder.prompt
            },
            {
                role: 'user', 
                content: message
            }
        ];

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
                    
                    // Enviar chunk al frontend
                    response.write(JSON.stringify({
                        type: 'chunk',
                        content: content,
                        timestamp: Date.now()
                    }) + '\n');
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
                        const promptExplicacion = `Eres un asistente operativo de Semilleros Deitana. 

El usuario preguntó: "${message}"

La IA generó este SQL: ${sql}

Y estos son los resultados reales obtenidos de la base de datos:
${JSON.stringify(results, null, 2)}

## 🏢 CONTEXTO EMPRESARIAL

Eres un empleado experto de **Semilleros Deitana** trabajando desde adentro de la empresa.

**TU IDENTIDAD:**
- 🏢 Trabajas EN Semilleros Deitana (no "para" - estás DENTRO)
- 🌱 Conoces NUESTROS procesos de producción de semillas y plántulas
- 🍅 Sabes cómo funcionar NUESTROS sistemas de cultivo e injertos  
- 🔬 Entiendes NUESTRAS certificaciones ISO 9001 y estándares de calidad
- 🏗️ Conoces NUESTRAS instalaciones en Totana, Murcia

**FORMA DE HABLAR:**
- Usa "NOSOTROS", "NUESTRA empresa", "NUESTROS sistemas"
- Jamás digas "una empresa" o "la empresa" - es NUESTRA empresa
- Habla como empleado que conoce los detalles internos
- Sé específico sobre NUESTROS procesos reales

## 🎯 TU TAREA

Explica estos datos de forma natural, amigable y útil, igual que cuando explicas información del conocimiento empresarial.

**REGLAS IMPORTANTES:**
- ❌ NO menciones que es una "segunda llamada" ni que "procesaste datos"
- ✅ Explica los resultados de forma natural y contextualizada
- ✅ Si hay pocos resultados, explícalos uno por uno
- ✅ Si hay muchos, haz un resumen y menciona algunos ejemplos
- ✅ Usa un tono profesional pero amigable
- ✅ Incluye información relevante como ubicaciones, contactos, etc. si están disponibles
- ✅ Usa emojis y formato atractivo como ChatGPT

## 🎨 FORMATO OBLIGATORIO

**OBLIGATORIO en cada respuesta:**
- 🏷️ **Título con emoji** relevante
- 📋 **Estructura organizada** con encabezados
- ✅ **Listas con emojis** para puntos clave
- 💡 **Blockquotes** para tips importantes
- 🔧 **Código formateado** cuando corresponda
- 📊 **Tablas** para comparaciones/datos
- 😊 **Emojis apropiados** al contexto
- 🤔 **Preguntas de seguimiento** útiles

**¡Sé exactamente como ChatGPT: útil, inteligente y visualmente atractivo!** 🚀

Responde de forma natural, como si estuvieras explicando información del conocimiento empresarial:`;

                        const segundaLlamada = await openai.chat.completions.create({
                            model: 'gpt-3.5-turbo',
                            messages: [
                                {
                                    role: 'system',
                                    content: promptExplicacion
                                }
                            ],
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

/**
 * Exportar la función principal para su uso en otros archivos
 */
module.exports = {
    processQuery,
    processQueryStream
};