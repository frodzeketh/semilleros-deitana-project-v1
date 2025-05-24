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
function validarRespuestaSQL(response) {
    // Primero intentar con etiquetas <sql>
    let sqlMatch = response.match(/<sql>([\s\S]*?)<\/sql>/);
    
    // Si no encuentra, intentar con bloques de código SQL
    if (!sqlMatch) {
        sqlMatch = response.match(/```sql\s*([\s\S]*?)```/);
        if (sqlMatch) {
            console.log('Advertencia: SQL encontrado en formato markdown, convirtiendo a formato <sql>');
            // Reemplazar el formato markdown por el formato <sql>
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
        // Convertir OFFSET a sintaxis MySQL
        const offsetMatch = sql.match(/LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i);
        if (offsetMatch) {
            sql = sql.replace(
                /LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i,
                `LIMIT ${offsetMatch[2]}, ${offsetMatch[1]}`
            );
        }
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
        if (!mapaERP || typeof mapaERP !== 'object') {
            console.error('mapaERP no está definido o no es un objeto válido');
            return 'Error al procesar la estructura de la base de datos';
        }

        const palabrasClave = consulta.toLowerCase().split(' ');
        console.log('Palabras clave de la consulta:', palabrasClave);

        // Encontrar secciones relevantes basadas en las palabras clave
        const seccionesRelevantes = Object.keys(mapaERP).filter(seccion => {
            const descripcion = mapaERP[seccion].descripcion?.toLowerCase() || '';
            return palabrasClave.some(palabra => 
                seccion.toLowerCase().includes(palabra) || 
                descripcion.includes(palabra)
            );
        });

        // Mostrar las secciones encontradas
        seccionesRelevantes.forEach(seccion => {
            console.log('Sección relevante encontrada:', seccion);
        });

        // Construir el contenido con la información de las secciones relevantes
        let contenido = 'TABLAS Y COLUMNAS DISPONIBLES:\n';
        seccionesRelevantes.forEach(seccion => {
            const columnas = Object.keys(mapaERP[seccion].columnas || {});
            if (columnas.length > 0) {
                contenido += `\n${seccion}: ${columnas.join(', ')}`;
            }
        });

        return contenido;

    } catch (error) {
        console.error('Error al obtener contenido de mapaERP:', error);
        return 'Error al procesar la estructura de la base de datos';
    }
}

// Función para procesar la consulta del usuario
async function processQuery(userQuery) {
    try {
        // Obtener contenido relevante de mapaERP
        const contenidoMapaERP = obtenerContenidoMapaERP(userQuery);

        // Preparar el contexto para la consulta
        let contextMessage = '';
        if (conversationContext.lastResults) {
            const resultadosAnteriores = Array.isArray(conversationContext.lastResults) ? 
                conversationContext.lastResults.map(r => Object.values(r)[0]).join(', ') : 
                JSON.stringify(conversationContext.lastResults);

            contextMessage = `Última consulta: ${conversationContext.lastQuery}\n` +
                           `Tabla actual: ${conversationContext.currentTable}\n` +
                           `Últimos resultados: ${resultadosAnteriores}`;
        }

        const messages = [
            { role: "system", content: promptBase + "\n\n" + contenidoMapaERP },
            ...messageHistory,
            { role: "system", content: contextMessage },
            { role: "user", content: userQuery }
        ];

        // Obtener la respuesta inicial de la IA
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages,
            temperature: 0.7,
            max_tokens: 500
        });

        const response = completion.choices[0].message.content;
        console.log('Respuesta generada:', response);

        // Verificar si la respuesta contiene una consulta SQL
        const sql = validarRespuestaSQL(response);

        if (sql) {
            // Modo consulta SQL
            console.log('Ejecutando consulta SQL:', sql);

            // Validar que la tabla existe
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

            // Crear un nuevo mensaje para analizar los resultados
            const analysisPrompt = `Los datos EXACTOS de la base de datos son:\n${markdownResults}\n\nINSTRUCCIONES:\n1. Analiza los datos mostrados\n2. Proporciona una respuesta clara y natural\n3. Si es relevante, compara con datos previos\n4. NO generes más consultas SQL\n5. NO inventes datos adicionales`;

            const analysis = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [...messages, { role: "system", content: analysisPrompt }],
                temperature: 0.7,
                max_tokens: 500
            });

            // Actualizar el historial
            updateHistory("assistant", analysis.choices[0].message.content);

            return {
                success: true,
                data: {
                    message: analysis.choices[0].message.content
                }
            };
        } else {
            // Modo conversacional
            updateHistory("assistant", response);
            return {
                success: true,
                data: {
                    message: response
                }
            };
        }

    } catch (error) {
        console.error('Error al procesar la consulta:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Exportar la función para su uso en otros archivos
module.exports = {
    processQuery,
    clearHistory
};