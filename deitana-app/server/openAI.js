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

// Función para formatear la respuesta final
function formatFinalResponse(results, query) {
    if (!results || results.length === 0) {
        return "Lo siento, no he encontrado información en la base de datos. ¿Te gustaría intentar con otra búsqueda?";
    }

    // Si es un conteo simple
    if (results.length === 1 && Object.keys(results[0]).length === 1) {
        const value = Object.values(results[0])[0];
        return `He encontrado un total de ${value} registros en la base de datos.`;
    }

    // Formatear la respuesta de manera conversacional
    let response = "He encontrado los siguientes registros en la base de datos:\n\n";
    
    results.forEach((row, index) => {
        response += `${index + 1}. `;
        // Solo mostrar los valores reales de la base de datos
        const entries = Object.entries(row).filter(([_, value]) => value !== null && value !== undefined);
        entries.forEach(([key, value]) => {
            response += `${key}: ${value}\n`;
        });
        response += "\n";
    });

    return response;
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

        const messages = [
            { role: "system", content: promptBase + "\n\n" + contenidoMapaERP },
            { role: "user", content: userQuery }
        ];

        // Obtener la respuesta inicial de la IA
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            temperature: 0.2,
            max_tokens: 1000
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
            
            // Formatear la respuesta final de manera conversacional
            const finalResponse = formatFinalResponse(results, userQuery);

            return {
                success: true,
                data: {
                    message: finalResponse
                }
            };
        } else {
            // Si no hay SQL, verificar si la tabla existe en mapaERP
            const palabrasClave = userQuery.toLowerCase().split(' ');
            const tablaEncontrada = Object.keys(mapaERP).find(tabla => 
                palabrasClave.some(palabra => tabla.toLowerCase().includes(palabra))
            );

            if (tablaEncontrada) {
                // Si la tabla existe pero no se generó SQL, forzar una consulta básica
                const columnas = Object.keys(mapaERP[tablaEncontrada].columnas);
                const sqlBasico = `SELECT ${columnas.join(', ')} FROM ${tablaEncontrada} LIMIT 5`;
                const results = await executeQuery(sqlBasico);
                const finalResponse = formatFinalResponse(results, userQuery);
                return {
                    success: true,
                    data: {
                        message: finalResponse
                    }
                };
            }

            // Si no hay tabla encontrada, permitir respuesta conversacional
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
    processQuery
};