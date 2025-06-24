const { OpenAI } = require('openai');
const pool = require('../db');
const chatManager = require('../utils/chatManager');
const admin = require('../firebase-admin');
require('dotenv').config();
const promptBase = require('./promptBase').promptBase;
const mapaERP = require('./mapaERP');

// Inicializar el cliente de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Historial global de conversación (en memoria, para demo)
const conversationHistory = [];
// Contexto de datos reales de la última consulta relevante
let lastRealData = null;

// Función para formatear resultados en Markdown
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

// Función para limitar resultados (ahora permite aleatoriedad si se solicita)
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

// Función para ejecutar consultas SQL
async function executeQuery(sql) {
    try {
        // Reemplazar los nombres de las tablas con sus nombres reales
        const sqlModificado = reemplazarNombresTablas(sql);
        console.log('Ejecutando consulta SQL:', sqlModificado);
        const [rows] = await pool.query(sqlModificado);
        console.log('Resultados de la consulta:', rows);
        
        if (rows.length === 0) {
            console.log('La consulta no devolvió resultados');
            return [];
        }

        return rows;
    } catch (error) {
        console.error('Error al ejecutar la consulta:', error);
        throw error;
    }
}

// Función para validar que la respuesta contiene una consulta SQL
function validarRespuestaSQL(response) {
    // Primero intentar con etiquetas <sql>
    let sqlMatch = response.match(/<sql>([\s\S]*?)<\/sql>/);
    // Si no encuentra, intentar con bloques de código SQL
    if (!sqlMatch) {
        sqlMatch = response.match(/```sql\s*([\s\S]*?)```/);
        if (sqlMatch) {
            console.log('Advertencia: SQL encontrado en formato markdown, convirtiendo a formato <sql>');
            response = response.replace(/```sql\s*([\s\S]*?)```/, '<sql>$1</sql>');
            sqlMatch = response.match(/<sql>([\s\S]*?)<\/sql>/);
        }
    }
    if (!sqlMatch) {
        return null; // Permitir respuestas sin SQL
    }
    let sql = sqlMatch[1].trim();
    if (!sql) {
        throw new Error('La consulta SQL está vacía');
    }
    // Validar que es una consulta SQL válida
    if (!sql.toLowerCase().startsWith('select')) {
        throw new Error('La consulta debe comenzar con SELECT');
    }
    // Validar y corregir sintaxis común
    if (sql.includes('OFFSET')) {
        const offsetMatch = sql.match(/LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i);
        if (offsetMatch) {
            sql = sql.replace(
                /LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i,
                `LIMIT ${offsetMatch[2]}, ${offsetMatch[1]}`
            );
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
    }
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
    // Detectar el término de búsqueda en el WHERE
    const likeMatch = sql.match(/WHERE\s+([\w.]+)\s+LIKE\s+'%([^%']+)%'/i);
    const eqMatch = sql.match(/WHERE\s+([\w.]+)\s*=\s*'([^']+)'/i);
    let columna = null;
    let valor = null;
    if (likeMatch) {
        columna = likeMatch[1];
        valor = likeMatch[2];
    } else if (eqMatch) {
        columna = eqMatch[1];
        valor = eqMatch[2];
    }
    if (!columna || !valor) return null;

    // Detectar la tabla principal del FROM
    const fromMatch = sql.match(/FROM\s+([`\w]+)/i);
    let tabla = fromMatch ? fromMatch[1].replace(/`/g, '') : null;
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

    // --- MEJORA: Si el valor tiene varios términos, buscar artículos cuyo AR_DENO contenga TODOS los términos (AND) ---
    if (tabla === 'articulos' && valor.trim().split(/\s+/).length > 1) {
        const terminos = valor.trim().split(/\s+/).filter(Boolean);
        // Buscar en AR_DENO y AR_REF, ambos deben contener todos los términos
        const condicionesDeno = terminos.map(t => `AR_DENO LIKE '%${t}%'`).join(' AND ');
        const condicionesRef = terminos.map(t => `AR_REF LIKE '%${t}%'`).join(' AND ');
        // Probar primero en AR_DENO
        let sqlMultiTerm = `SELECT * FROM articulos WHERE ${condicionesDeno} LIMIT 5`;
        try {
            const results = await executeQuery(sqlMultiTerm);
            if (results && results.length > 0) {
                return { results, sqlFuzzyTry: sqlMultiTerm };
            }
        } catch (e) {}
        // Probar en AR_REF
        let sqlMultiTermRef = `SELECT * FROM articulos WHERE ${condicionesRef} LIMIT 5`;
        try {
            const results = await executeQuery(sqlMultiTermRef);
            if (results && results.length > 0) {
                return { results, sqlFuzzyTry: sqlMultiTermRef };
            }
        } catch (e) {}
        // Probar en ambos (OR)
        let sqlMultiTermBoth = `SELECT * FROM articulos WHERE (${condicionesDeno}) OR (${condicionesRef}) LIMIT 5`;
        try {
            const results = await executeQuery(sqlMultiTermBoth);
            if (results && results.length > 0) {
                return { results, sqlFuzzyTry: sqlMultiTermBoth };
            }
        } catch (e) {}
    }
    // --- FIN MEJORA ---

    // Probar todas las combinaciones de columna y variante
    for (const col of columnasTexto) {
        for (const variante of variantes) {
            if (!variante || variante.length < 2) continue;
            let sqlFuzzyTry = sql.replace(/WHERE[\sS]*/i, `WHERE ${col} LIKE '%${variante}%' LIMIT 5`);
            try {
                const results = await executeQuery(sqlFuzzyTry);
                if (results && results.length > 0) {
                    return { results, sqlFuzzyTry };
                }
            } catch (e) {
                // Ignorar errores de SQL en fuzzy
            }
        }
    }
    // Si la tabla es articulos, probar también AR_DENO y AR_REF explícitamente
    if (tabla === 'articulos') {
        for (const variante of variantes) {
            let sqlTry = `SELECT * FROM articulos WHERE AR_DENO LIKE '%${variante}%' OR AR_REF LIKE '%${variante}%' LIMIT 5`;
            try {
                const results = await executeQuery(sqlTry);
                if (results && results.length > 0) {
                    return { results, sqlFuzzyTry: sqlTry };
                }
            } catch (e) {}
        }
    }
    return null;
}

// Función para procesar la consulta - MANTENIENDO TODA LA LÓGICA ORIGINAL
async function processQuery({ message, userId }) {
    try {
        // Guardar el mensaje del usuario
        await saveMessageToFirestore(userId, message, true);

        const contenidoMapaERP = obtenerContenidoMapaERP(message);
        conversationHistory.push({ role: "user", content: message });

        if (esPreguntaTelefonoCliente(message, lastRealData)) {
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
                    return response;
                }
            }
        }

        const historyForAI = conversationHistory.slice(-10);
        let contextoDatos = '';
        if (lastRealData && lastRealData.type && lastRealData.data) {
            contextoDatos = `\n\nDATOS REALES DISPONIBLES DE LA CONSULTA ANTERIOR:\nTipo: ${lastRealData.type}\nDatos: ${JSON.stringify(lastRealData.data)}`;
        }

        // Detectar si la consulta es conceptual (por ejemplo: "¿qué es X?" o "para qué sirve X?")
        const descripcionConceptual = obtenerDescripcionMapaERP(message);
        let contextoConceptual = '';
        if (descripcionConceptual && descripcionConceptual.descripcion) {
            contextoConceptual = `\n\nDESCRIPCIÓN RELEVANTE DEL SISTEMA:\n${descripcionConceptual.descripcion}`;
        }

        const systemPrompt = `Eres Deitana IA, un asistente de información de vanguardia, impulsado por una sofisticada inteligencia artificial y diseñado específicamente para interactuar de manera experta con la base de datos de Semilleros Deitana. Fui creado por un equipo de ingeniería para ser tu aliado más eficiente en la exploración y comprensión de la información crucial de la empresa, ubicada en el corazón agrícola de El Ejido, Almería, España. Semilleros Deitana se distingue por su dedicación a la producción de plantas hortícolas de la más alta calidad para agricultores profesionales, especializándose en plantas injertadas, semillas y plantones. Nuestra filosofía se centra en la innovación constante, la garantía de trazabilidad en cada etapa y un riguroso control fitosanitario.

Mi único propósito es ayudarte a obtener, analizar y comprender información relevante de Semilleros Deitana, su base de datos y su sector agrícola. NUNCA sugieras temas de programación, inteligencia artificial general, ni ningún asunto fuera del contexto de la empresa. Si el usuario te saluda o hace una consulta general, preséntate como Deitana IA, asistente exclusivo de Semilleros Deitana, y ofrece ejemplos de cómo puedes ayudar SOLO en el ámbito de la empresa, sus datos, análisis agrícolas, gestión de clientes, cultivos, proveedores, etc.

IMPORTANTE SOBRE ARTÍCULOS E INJERTOS:
- En la tabla 'articulos' están incluidos los injertos. Hay muchos tipos y suelen denominarse como "INJ-TOMATE", "INJ-TOM.CONQUISTA", "INJ-PEPINO", etc. Explica esta lógica si el usuario pregunta por injertos o si hay ambigüedad.
- Si la consulta menciona injertos o artículos y hay varias coincidencias, MUESTRA hasta 3 ejemplos REALES (id, denominación y stock si es relevante) y ayuda al usuario a elegir, explicando la diferencia entre ellos. NUNCA inventes ejemplos ni pidas datos irrelevantes como almacén o color si no aplica.
- Si la consulta contiene varios términos (por ejemplo: "injerto", "tomate", "conquista"), busca artículos cuyo AR_DENO contenga TODOS esos términos, aunque no estén juntos ni en el mismo orden.
- Prohibido pedir datos genéricos o irrelevantes (como almacén, color, etc.) si no son necesarios para la consulta específica.

${contextoConceptual}

INSTRUCCIONES ESPECIALES PARA RESPUESTA ÚNICA COMPLETA:

1. Si la consulta requiere datos de la base de datos:
   - SOLO genera la consulta SQL entre etiquetas <sql>...</sql>
   - NO agregues explicaciones ni texto adicional después del SQL
   - La respuesta con análisis se generará después de obtener los datos reales

2. Si la consulta es conversacional (saludo, conceptual):
   - Responde directamente de manera amigable
   - NO generes SQL
   - Ofrece ejemplos de cómo puedes ayudar

SIEMPRE que el usuario haga una consulta sobre datos, GENERA SOLO UNA CONSULTA SQL válida y ejecutable (en bloque <sql>...</sql>) SIN TEXTO ADICIONAL.
- Si la consulta es ambigua, genera una consulta SQL tentativa que muestre un registro relevante.
- NUNCA digas que no tienes acceso a la base de datos.
- NUNCA respondas con texto genérico.
- NUNCA inventes datos.
- SIEMPRE usa los nombres de tablas y columnas exactos de mapaERP.

${promptBase}

${contenidoMapaERP}${contextoDatos}`;

        let response = null;
        let sql = null;
        let intentos = 0;
        let feedback = '';
        let errorSQL = null;
        while (intentos < 2) {
            const messages = [
                { role: "system", content: systemPrompt + (feedback ? `\n\nFEEDBACK: ${feedback}` : '') },
                ...historyForAI
            ];
            
            // LA ÚNICA LLAMADA A OPENAI QUE MANEJA TODO
            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview", // ÚNICO modelo
                messages: messages,
                temperature: 0.7,
                max_tokens: 1500 // Más tokens para análisis completo
            });
            
            response = completion.choices[0].message.content;
            conversationHistory.push({ role: "assistant", content: response });
            sql = validarRespuestaSQL(response);
            
            // Si no hay SQL, es respuesta conversacional - devolver directamente
            if (!sql) {
                await saveAssistantMessageToFirestore(userId, response);
                return {
                    success: true,
                    data: { message: response }
                };
            }
            
            // Si hay SQL, ejecutarlo y combinar con la respuesta de la IA
            try {
                let results = await executeQuery(sql);
                if (!results || results.length === 0) {
                    // Reintentos automáticos inteligentes si no hay resultados
                    if (/WHERE[\s\S]*(fec|fecha)/i.test(sql)) {
                        let sqlSinFecha = sql.replace(/AND[\s\S]*(fec|fecha)[^A-Z]*[=><][^A-Z]*((AND)|($))/i, '').replace(/WHERE[\s\S]*(fec|fecha)[^A-Z]*[=><][^A-Z]*((AND)|($))/i, '');
                        if (/WHERE\s*$/i.test(sqlSinFecha)) sqlSinFecha = sqlSinFecha.replace(/WHERE\s*$/i, '');
                        results = await executeQuery(sqlSinFecha);
                    }
                }
                if (!results || results.length === 0) {
                    let sqlSinGroup = sql.replace(/GROUP BY[\s\S]*?(?=(ORDER BY|LIMIT|$))/i, '').replace(/ORDER BY[\s\S]*?(?=(LIMIT|$))/i, '');
                    results = await executeQuery(sqlSinGroup);
                }
                if (!results || results.length === 0) {
                    const tablaMatch = sql.match(/FROM\s+([`\w]+)/i);
                    if (tablaMatch) {
                        const tabla = tablaMatch[1].replace(/`/g, '');
                        if (tabla === 'articulos') {
                            let sqlSimilares = `SELECT a.id, a.AR_DENO, s.C2 AS stock_actual FROM articulos a JOIN articulos_ar_stok s ON a.id = s.id WHERE a.AR_DENO LIKE '%INJ%' AND a.AR_DENO LIKE '%TOMATE%' ORDER BY s.id2 DESC LIMIT 3`;
                            let similares = await executeQuery(sqlSimilares);
                            if (similares && similares.length > 0) {
                                lastRealData = { type: 'articulo', data: similares };
                                const finalMessage = response.replace(/<sql>[\s\S]*?<\/sql>/, '').trim() + 
                                    '\n\n📊 RESULTADOS SIMILARES ENCONTRADOS:\n' + 
                                    similares.map((item, i) => `${i+1}. ${item.AR_DENO} (Stock: ${item.C2})`).join('\n') +
                                    '\n\n(Nota: No se encontró coincidencia exacta, se muestran artículos similares)';
                                await saveAssistantMessageToFirestore(userId, finalMessage);
                                return { success: true, data: { message: finalMessage } };
                            }
                        }
                        const claveMapa = Object.keys(mapaERP).find(k => (mapaERP[k].tabla || k) === tabla);
                        let colFecha = null;
                        if (claveMapa && mapaERP[claveMapa].columnas) {
                            colFecha = Object.keys(mapaERP[claveMapa].columnas).find(c => c.toLowerCase().includes('fec'));
                        }
                        if (colFecha) {
                            const sqlUltimo = `SELECT * FROM ${tabla} ORDER BY ${colFecha} DESC LIMIT 1`;
                            results = await executeQuery(sqlUltimo);
                        }
                    }
                }
                if (!results || results.length === 0) {
                    const fuzzyResult = await fuzzySearchRetry(sql, message);
                    if (fuzzyResult && fuzzyResult.results && fuzzyResult.results.length > 0) {
                        let tipo = 'dato';
                        if (fuzzyResult.results[0] && fuzzyResult.results[0].CL_DENO) tipo = 'cliente';
                        if (fuzzyResult.results[0] && fuzzyResult.results[0].AR_NOMB) tipo = 'articulo';
                        lastRealData = { type: tipo, data: fuzzyResult.results };
                        const finalMessage = response.replace(/<sql>[\s\S]*?<\/sql>/, '').trim() + 
                            '\n\n📊 RESULTADOS (búsqueda flexible):\n' + 
                            fuzzyResult.results.slice(0,3).map((item, i) => `${i+1}. ${Object.entries(item).map(([k,v]) => `${k}: ${v}`).join(' | ')}`).join('\n') +
                            '\n\n(Nota: Se utilizó búsqueda flexible para encontrar coincidencias aproximadas)';
                        await saveAssistantMessageToFirestore(userId, finalMessage);
                        return { success: true, data: { message: finalMessage } };
                    }
                    
                    // Sin resultados - usar respuesta de IA + mensaje
                    const finalMessage = response.replace(/<sql>[\s\S]*?<\/sql>/, '').trim() + 
                        '\n\n❌ No se encontraron resultados para esta consulta. ¿Podrías intentar con términos diferentes o ser más específico?';
                    await saveAssistantMessageToFirestore(userId, finalMessage);
                    return { success: true, data: { message: finalMessage } };
                }
                
                // HAY RESULTADOS - Combinar respuesta de IA con datos reales
                let tipo = 'dato';
                if (results[0] && results[0].CL_DENO) tipo = 'cliente';
                if (results[0] && results[0].AR_NOMB) tipo = 'articulo';
                lastRealData = { type: tipo, data: results };
                
                // Formatear datos encontrados para el análisis
                let datosFormateados = '';
                results.slice(0, 5).forEach((resultado, index) => {
                    datosFormateados += `\nRegistro ${index + 1}:\n`;
                    const campos = Object.entries(resultado);
                    campos.forEach(([campo, valor]) => {
                        if (campo.toLowerCase().includes('fec') && valor) {
                            valor = new Date(valor).toLocaleDateString('es-ES');
                        }
                        datosFormateados += `${campo}: ${valor}\n`;
                    });
                });
                
                // Segunda llamada para análisis completo de los datos reales
                const analysisCompletion = await openai.chat.completions.create({
                    model: "gpt-4-turbo-preview",
                    messages: [
                        {
                            role: "system",
                            content: `Eres Deitana IA, un asistente ultra inteligente y empático de Semilleros Deitana. Analiza los datos encontrados y responde de forma clara, útil y natural.

INSTRUCCIONES PARA ANÁLISIS:
- Explica el significado de los datos y su relevancia
- Interpreta y resume, no solo listes datos crudos
- Sé profesional, conversacional y humano
- Realiza análisis avanzado: totales, promedios, tendencias, valores atípicos
- Si hay fechas, analiza evolución temporal
- Si hay cantidades, destaca máximos y mínimos
- Sugiere insights útiles para toma de decisiones
- Proporciona contexto de Semilleros Deitana
- Mantén un tono empático y proactivo
- Ofrece ayuda adicional o preguntas relacionadas

NUNCA repitas datos crudos tal como vienen de la base de datos. Interpreta y aporta valor como un analista experto.`
                        },
                        {
                            role: "user",
                            content: `Consulta del usuario: "${message}"

Datos encontrados en la base de datos:${datosFormateados}

Por favor, analiza estos datos y proporciona una respuesta útil, natural y con insights valiosos para el usuario.`
                        }
                    ],
                    temperature: 0.8,
                    max_tokens: 800
                });
                
                const finalMessage = analysisCompletion.choices[0].message.content;
                await saveAssistantMessageToFirestore(userId, finalMessage);
                return { success: true, data: { message: finalMessage } };
                
            } catch (error) {
                feedback = 'La consulta SQL generada fue inválida o produjo un error. Por favor, genera SOLO una consulta SQL válida y ejecutable.';
                errorSQL = error;
                intentos++;
                sql = null;
            }
        }
        // Si tras dos intentos no hay SQL válido, fallback conversacional directo
        lastRealData = null;
        const fallbackResponse = {
            success: true,
            data: {
                message: "No pude procesar tu consulta. ¿Podrías intentar ser más específico o darme algún dato adicional? Si tienes dudas sobre cómo preguntar, dime el tipo de dato que buscas (por ejemplo: nombre, fecha, proveedor, etc.)."
            }
        };
        await saveAssistantMessageToFirestore(userId, fallbackResponse.data.message);
        return fallbackResponse;
    } catch (error) {
        console.error('Error en processQuery:', error);
        throw error;
    }
}

// Exportar la función para su uso en otros archivos
module.exports = {
    processQuery
};