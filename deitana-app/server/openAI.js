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

// Función para limitar resultados
function limitarResultados(results, limite = 5) {
    if (!results || results.length === 0) return [];
    return results.slice(0, limite);
}

// Función para formatear la respuesta final
async function formatFinalResponse(results, query) {
    if (!results || results.length === 0) {
        return "No encontré información que coincida con tu consulta. ¿Podrías reformularla o ser más específico?";
    }

    // Limitar el número de resultados
    const resultadosLimitados = limitarResultados(results);
    const totalResultados = results.length;

    // Formatear los datos reales
    let datosReales = '';
    resultadosLimitados.forEach((resultado, index) => {
        datosReales += `\nRegistro ${index + 1}:\n`;
        Object.entries(resultado).forEach(([campo, valor]) => {
            if (campo.toLowerCase().includes('fec') && valor) {
                const fecha = new Date(valor);
                valor = fecha.toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }
            datosReales += `${campo}: ${valor}\n`;
        });
    });

    // Generar una respuesta contextual usando la IA
    const messages = [
        {
            role: "system",
            content: `Eres un asistente especializado en Semilleros Deitana. Tu tarea es analizar los datos y proporcionar una respuesta clara y útil.
            
            Para consultas de conteo:
            - Muestra el número total de manera clara
            - Proporciona contexto sobre qué representa ese número
            
            Para consultas de datos:
            - Explica el significado de los datos mostrados
            - Destaca la información más relevante
            - Proporciona contexto sobre por qué es importante
            - Si hay relaciones (como nombres de clientes o vendedores), explícalas
            
            Mantén un tono profesional pero conversacional.
            Sé conciso pero informativo.
            No repitas los datos crudos, interpreta su significado.`
        },
        {
            role: "user",
            content: `Consulta: "${query}"\n\nDatos encontrados:${datosReales}\n\nPor favor, analiza estos datos y proporciona una respuesta útil que explique su significado y relevancia.`
        }
    ];

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: messages,
            temperature: 0.7,
            max_tokens: 500
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('Error al generar respuesta:', error);
        return `He encontrado la siguiente información:${datosReales}`;
    }
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

    // Verificar si es una consulta de conteo
    const esConsultaConteo = sql.toLowerCase().includes('count(*)');
    
    // Solo requerir LIMIT si NO es una consulta de conteo
    if (!esConsultaConteo && !sql.toLowerCase().includes('limit')) {
        throw new Error('La consulta debe incluir un LIMIT para evitar resultados excesivos');
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

// Función para procesar la consulta del usuario
async function processQuery(userQuery) {
    try {
        // Obtener contenido relevante de mapaERP
        const contenidoMapaERP = obtenerContenidoMapaERP(userQuery);

        const messages = [
            { 
                role: "system", 
                content: promptBase + "\n\n" + contenidoMapaERP + "\n\nIMPORTANTE: Para consultas de conteo (cuántos, total, etc.), usa COUNT(*) sin LIMIT. Para consultas de listado, SIEMPRE incluye un LIMIT." 
            },
            { 
                role: "user", 
                content: userQuery 
            }
        ];

        // Calcular tokens aproximados del prompt
        const promptTokens = messages.reduce((acc, msg) => {
            return acc + Math.ceil(msg.content.length / 4);
        }, 0);

        console.log('Tokens estimados del prompt:', promptTokens);

        if (promptTokens > 16000) {
            console.log('ADVERTENCIA: El prompt excede el límite de tokens del modelo');
            return {
                success: false,
                error: "La consulta es demasiado compleja. Por favor, simplifica tu pregunta."
            };
        }

        // Obtener la respuesta inicial de la IA
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: messages,
            temperature: 0.5,
            max_tokens: 800
        });

        console.log('Consumo de tokens:', {
            prompt_tokens: completion.usage.prompt_tokens,
            completion_tokens: completion.usage.completion_tokens,
            total_tokens: completion.usage.total_tokens
        });

        const response = completion.choices[0].message.content;
        console.log('Respuesta generada:', response);

        // Verificar si la respuesta contiene una consulta SQL
        const sql = validarRespuestaSQL(response);

        if (!sql) {
            return {
                success: true,
                data: {
                    message: "No pude generar una consulta SQL válida. Por favor, reformula tu pregunta para que sea más específica."
                }
            };
        }

        // Ejecutar la consulta SQL generada
        try {
            console.log('Ejecutando consulta SQL:', sql);
            const results = await executeQuery(sql);
            
            if (!results || results.length === 0) {
                return {
                    success: true,
                    data: {
                        message: "No encontré información en la base de datos. ¿Podrías reformular tu consulta o proporcionar más detalles?"
                    }
                };
            }

            const finalResponse = await formatFinalResponse(results, userQuery);
            return {
                success: true,
                data: {
                    message: finalResponse
                }
            };
        } catch (error) {
            console.error('Error al ejecutar consulta SQL:', error);
            return {
                success: false,
                error: "Error al ejecutar la consulta SQL. Por favor, intenta con otra pregunta o proporciona más detalles."
            };
        }

    } catch (error) {
        console.error('Error al procesar la consulta:', error);
        if (error.response?.data?.usage) {
            console.log('Consumo de tokens (error):', error.response.data.usage);
        }
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