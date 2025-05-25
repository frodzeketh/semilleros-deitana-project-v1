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

// Función para obtener contenido relevante de mapaERP
function obtenerContenidoMapaERP(consulta) {
    try {
        if (!mapaERP || typeof mapaERP !== 'object') {
            console.error('mapaERP no está definido o no es un objeto válido');
            return 'Error al procesar la estructura de la base de datos';
        }

        const palabrasClave = consulta.toLowerCase().split(' ');
        console.log('Palabras clave de la consulta:', palabrasClave);

        // Encontrar secciones relevantes basadas en las palabras clave
        const seccionesRelevantes = Object.entries(mapaERP).filter(([tabla, info]) => {
            const descripcion = info.descripcion?.toLowerCase() || '';
            return palabrasClave.some(palabra => 
                tabla.toLowerCase().includes(palabra) || 
                descripcion.includes(palabra)
            );
        });

        // Si no encontramos secciones relevantes, mostrar todas las tablas
        if (seccionesRelevantes.length === 0) {
            console.log('No se encontraron secciones relevantes, mostrando todas las tablas');
            return Object.entries(mapaERP).map(([tabla, info]) => {
                return `Tabla: ${tabla}\nDescripción: ${info.descripcion || 'Sin descripción'}\nColumnas: ${Object.keys(info.columnas || {}).join(', ')}\n`;
            }).join('\n');
        }

        // Construir el contenido con la información detallada
        let contenido = 'ESTRUCTURA DE LA BASE DE DATOS:\n\n';
        seccionesRelevantes.forEach(([tabla, info]) => {
            contenido += `Tabla: ${tabla}\n`;
            contenido += `Descripción: ${info.descripcion || 'Sin descripción'}\n`;
            contenido += `Columnas:\n`;
            Object.entries(info.columnas || {}).forEach(([columna, tipo]) => {
                contenido += `  - ${columna}: ${tipo}\n`;
            });
            contenido += '\n';
        });

        return contenido;

    } catch (error) {
        console.error('Error al obtener contenido de mapaERP:', error);
        return 'Error al procesar la estructura de la base de datos';
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

// Función para procesar la consulta del usuario
async function processQuery(userQuery) {
    try {
        // Obtener contenido relevante de mapaERP
        const contenidoMapaERP = obtenerContenidoMapaERP(userQuery);

        const messages = [
            { 
                role: "system", 
                content: promptBase + "\n\n" + contenidoMapaERP + "\n\nIMPORTANTE: Para cualquier consulta que requiera datos, DEBES generar una consulta SQL usando las tablas y columnas definidas arriba. NO inventes datos. Si no puedes generar una consulta SQL válida, indica que necesitas más información. SIEMPRE incluye la consulta SQL entre etiquetas <sql>.</sql>" 
            },
            { role: "user", content: userQuery }
        ];

        // Obtener la respuesta inicial de la IA
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            temperature: 0.3,
            max_tokens: 1000
        });

        const response = completion.choices[0].message.content;
        console.log('Respuesta generada:', response);

        // Verificar si la respuesta contiene una consulta SQL
        const sql = validarRespuestaSQL(response);

        if (!sql) {
            // Si no hay SQL, forzar una consulta básica basada en las palabras clave
            const palabrasClave = userQuery.toLowerCase().split(' ');
            const tablaEncontrada = Object.entries(mapaERP).find(([tabla, info]) => {
                const descripcion = info.descripcion?.toLowerCase() || '';
                return palabrasClave.some(palabra => 
                    tabla.toLowerCase().includes(palabra) || 
                    descripcion.includes(palabra)
                );
            });

            if (tablaEncontrada) {
                const [tabla, info] = tablaEncontrada;
                const columnas = Object.keys(info.columnas || {});
                const limite = userQuery.toLowerCase().includes('2') ? 2 : 1;
                const sqlBasico = `SELECT ${columnas.join(', ')} FROM ${tabla} LIMIT ${limite}`;
                
                try {
                    console.log('Ejecutando consulta básica:', sqlBasico);
                    const results = await executeQuery(sqlBasico);
                    console.log('Resultados de la consulta básica:', results);
                    
                    if (!results || results.length === 0) {
                        return {
                            success: true,
                            data: {
                                message: "Lo siento, no he encontrado información en la base de datos. ¿Te gustaría intentar con otra búsqueda?"
                            }
                        };
                    }

                    const finalResponse = formatFinalResponse(results, userQuery);
                    return {
                        success: true,
                        data: {
                            message: finalResponse
                        }
                    };
                } catch (error) {
                    console.error('Error al ejecutar consulta básica:', error);
                }
            }
        } else {
            // Ejecutar la consulta SQL generada
            try {
                console.log('Ejecutando consulta SQL:', sql);
                const results = await executeQuery(sql);
                console.log('Resultados de la consulta SQL:', results);
                
                if (!results || results.length === 0) {
                    return {
                        success: true,
                        data: {
                            message: "Lo siento, no he encontrado información en la base de datos. ¿Te gustaría intentar con otra búsqueda?"
                        }
                    };
                }

                const finalResponse = formatFinalResponse(results, userQuery);
                return {
                    success: true,
                    data: {
                        message: finalResponse
                    }
                };
            } catch (error) {
                console.error('Error al ejecutar consulta SQL:', error);
            }
        }

        // Si llegamos aquí, algo salió mal
        return {
            success: false,
            error: "No se pudo obtener la información solicitada. Por favor, intenta reformular tu consulta."
        };

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