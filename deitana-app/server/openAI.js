const { OpenAI } = require('openai');
const pool = require('./db');
require('dotenv').config();
const promptBase = require('./promptBase').promptBase;
const mapaERP = require('./mapaERP');

console.log('=== VERIFICACIÓN DE IMPORTACIÓN ===');
console.log('mapaERP importado:', !!mapaERP);
console.log('Tipo de mapaERP importado:', typeof mapaERP);
console.log('Claves en mapaERP importado:', Object.keys(mapaERP));
console.log('=== FIN DE VERIFICACIÓN DE IMPORTACIÓN ===');

// Inicializar el cliente de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Variables globales para el historial y contexto
let messageHistory = [];
let conversationContext = {
    lastQuery: null,
    lastResults: null,
    currentTable: null
};

// Función para limpiar el historial y contexto
function clearHistory() {
    messageHistory = [];
    conversationContext = {
        lastQuery: null,
        lastResults: null,
        currentTable: null
    };
}

// Función para actualizar el historial
function updateHistory(role, content) {
    messageHistory.push({ role, content });
    if (messageHistory.length > 5) {
        messageHistory = messageHistory.slice(-5);
    }
}

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

// Función para ejecutar consultas SQL
async function executeQuery(sql) {
    try {
        console.log('Ejecutando consulta SQL:', sql);
        const [rows] = await pool.query(sql);
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
function validarRespuestaSQL(respuesta) {
    // Buscar la consulta SQL entre etiquetas <sql>
    const sqlMatch = respuesta.match(/<sql>([\s\S]*?)<\/sql>/i);
    if (!sqlMatch) {
        console.error('Respuesta sin formato SQL válido:', respuesta);
        throw new Error('La respuesta debe contener la consulta SQL entre etiquetas <sql> y </sql>');
    }
    
    const sql = sqlMatch[1].trim();
    if (!sql) {
        throw new Error('La consulta SQL está vacía');
    }
    
    // Validar que es una consulta SQL válida
    if (!sql.toLowerCase().startsWith('select')) {
        throw new Error('La consulta debe comenzar con SELECT');
    }
    
    return sql;
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
            if (col.toLowerCase().includes(' as ')) return col.split(/\s+as\s+/i)[0].trim();
            // Removemos el prefijo de tabla si existe
            return col.replace(/^[a-z]+\./, '');
        })
        .filter(col => col !== null); // Eliminamos las funciones SQL
    
    // Verificar que cada columna existe en mapaERP
    columnasEnSQL.forEach(columna => {
        if (!columnas.includes(columna)) {
            throw new Error(`La columna ${columna} no existe en la tabla ${tabla}. Columnas disponibles: ${columnas.join(', ')}`);
        }
    });
}

// Función para obtener el contenido relevante de mapaERP
function obtenerContenidoMapaERP(consulta) {
    try {
        console.log('=== VERIFICACIÓN DE MAPAERP ===');
        console.log('mapaERP está definido:', !!mapaERP);
        console.log('Tipo de mapaERP:', typeof mapaERP);
        console.log('Claves disponibles:', Object.keys(mapaERP));
        
        if (!mapaERP || typeof mapaERP !== 'object') {
            console.error('mapaERP no está definido o no es un objeto válido');
            return 'TABLAS DISPONIBLES: clientes, fpago, bancos';
        }

        const palabrasClave = consulta.toLowerCase().split(' ');
        console.log('Palabras clave de la consulta:', palabrasClave);
        const seccionesRelevantes = [];

        // Buscar secciones relevantes basadas en palabras clave
        for (const [clave, seccion] of Object.entries(mapaERP)) {
            if (!seccion || typeof seccion !== 'object') continue;

            const descripcion = (seccion.descripcion || '').toLowerCase();
            const alias = (seccion.alias || '').toLowerCase();
            
            if (palabrasClave.some(palabra => 
                descripcion.includes(palabra) || 
                alias.includes(palabra) || 
                clave.toLowerCase().includes(palabra)
            )) {
                console.log('Sección relevante encontrada:', clave);
                // Solo incluimos la información esencial
                seccionesRelevantes.push({
                    tabla: seccion.tabla || clave,
                    columnas: seccion.columnas || {}
                });
            }
        }

        console.log('Secciones relevantes encontradas:', seccionesRelevantes.length);
        console.log('=== FIN DE VERIFICACIÓN ===');

        // Si no se encontraron secciones, incluir solo las tablas principales
        if (seccionesRelevantes.length === 0) {
            return `TABLAS DISPONIBLES:\n${Object.keys(mapaERP).join(', ')}`;
        }

        // Formatear las secciones relevantes de manera concisa
        let respuesta = "ESTRUCTURA DE LA BASE DE DATOS:\n\n";
        seccionesRelevantes.forEach(seccion => {
            respuesta += `Tabla: ${seccion.tabla}\n`;
            respuesta += "Columnas:\n";
            Object.entries(seccion.columnas).forEach(([columna, descripcion]) => {
                respuesta += `- ${columna}\n`;
            });
            respuesta += "\n";
        });

        return respuesta;
    } catch (error) {
        console.error('Error al obtener contenido de mapaERP:', error);
        return `TABLAS DISPONIBLES:\n${Object.keys(mapaERP || {}).join(', ')}`;
    }
}

// Función para procesar la consulta del usuario
async function processQuery(userQuery) {
    try {
        console.log('Procesando consulta:', userQuery);

        // Verificar que mapaERP esté definido
        console.log('=== VERIFICACIÓN DE MAPAERP ===');
        console.log('mapaERP está definido:', !!mapaERP);
        console.log('Tipo de mapaERP:', typeof mapaERP);
        console.log('Claves disponibles:', Object.keys(mapaERP));

        // Analizar palabras clave
        const palabrasClave = userQuery.toLowerCase().split(' ');
        console.log('Palabras clave de la consulta:', palabrasClave);

        // Encontrar secciones relevantes
        const seccionesRelevantes = Object.keys(mapaERP).filter(seccion => {
            const descripcion = mapaERP[seccion].descripcion?.toLowerCase() || '';
            return palabrasClave.some(palabra => 
                seccion.toLowerCase().includes(palabra) || 
                descripcion.includes(palabra)
            );
        });

        console.log('Secciones relevantes encontradas:', seccionesRelevantes.length);
        console.log('=== FIN DE VERIFICACIÓN ===');

        // Obtener contenido relevante de mapaERP
        const contenidoMapaERP = obtenerContenidoMapaERP(userQuery);

        // Preparar mensajes con contexto
        const contextMessage = conversationContext.lastResults ? 
            `Última consulta sobre: ${conversationContext.currentTable}\nResultados previos: ${JSON.stringify(conversationContext.lastResults)}` : '';

        const messages = [
            { role: "system", content: promptBase + "\n\n" + contenidoMapaERP },
            ...messageHistory,
            { role: "system", content: contextMessage },
            { role: "user", content: userQuery }
        ];

        // Llamar a la API de OpenAI con el contexto
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000
        });

        // Extraer la respuesta
        const response = completion.choices[0].message.content;
        console.log('Respuesta generada:', response);

        // Validar que la respuesta contiene una consulta SQL
        const sql = validarRespuestaSQL(response);
        
        // Validar que las tablas existen en mapaERP
        validarTablaEnMapaERP(sql);

        // Validar que las columnas existen en mapaERP
        const tabla = sql.match(/FROM\s+(\w+)/i)?.[1].toLowerCase();
        if (tabla) {
            validarColumnasEnMapaERP(sql, tabla);
        }

        // Ejecutar la consulta
        const results = await executeQuery(sql);
        
        // Formatear los resultados en Markdown
        const markdownResults = formatResultsAsMarkdown(results);

        // Actualizar el contexto con los resultados
        const tablaMatch = sql.match(/FROM\s+(\w+)/i);
        conversationContext = {
            lastQuery: sql,
            lastResults: results,
            currentTable: tablaMatch ? tablaMatch[1].toLowerCase() : null
        };

        // Actualizar el historial
        updateHistory("assistant", response);

        // Crear un nuevo mensaje para que la IA analice los resultados
        const analysisPrompt = `Los datos EXACTOS de la base de datos son:\n\n${markdownResults}\n\n
        INSTRUCCIONES:
        1. Usa SOLO los datos mostrados
        2. NO inventes números ni datos
        3. NO uses placeholders
        4. NO muestres la consulta SQL
        5. Muestra los números exactos
        6. Si no hay datos, di que no hay datos
        7. Formatea en texto legible
        8. Mantén un tono conversacional`;

        // Obtener el análisis de la IA
        const analysisCompletion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "Eres un asistente que muestra datos exactos de la base de datos en formato legible."
                },
                {
                    role: "user",
                    content: analysisPrompt
                }
            ],
            temperature: 0.1,
            max_tokens: 500
        });

        const analysis = analysisCompletion.choices[0].message.content;
        console.log('Análisis generado:', analysis);
        
        return {
            success: true,
            data: {
                message: response + "\n\n" + analysis
            }
        };

    } catch (error) {
        console.error('Error al procesar la consulta:', error);
        return {
            success: false,
            error: 'Error al procesar la consulta: ' + error.message
        };
    }
}

// Exportar la función para su uso en otros archivos
module.exports = {
    processQuery,
    clearHistory
};