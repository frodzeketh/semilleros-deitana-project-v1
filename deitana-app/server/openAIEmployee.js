const { OpenAI } = require('openai');
const pool = require('./db');
require('dotenv').config();
const promptBase = require('./promptBaseEmployee').promptBase;
const mapaERP = require('./mapaERPEmployee');

console.log('=== VERIFICACIÓN DE IMPORTACIÓN EMPLEADO ===');
console.log('mapaERP importado:', !!mapaERP);
console.log('Tipo de mapaERP importado:', typeof mapaERP);
console.log('Claves en mapaERP importado:', Object.keys(mapaERP));
console.log('=== FIN DE VERIFICACIÓN DE IMPORTACIÓN EMPLEADO ===');

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

// Función para limitar resultados
function limitarResultados(results, limite = 5, aleatorio = false) {
    if (!results || results.length === 0) return [];
    if (aleatorio && results.length > 1) {
        const shuffled = results.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, limite);
    }
    return results.slice(0, limite);
}

// Función para formatear la respuesta final
async function formatFinalResponse(results, query) {
    if (!results || results.length === 0) {
        return "No encontré información que coincida con tu consulta. ¿Quieres que busque algo similar, o puedes darme más detalles para afinar la búsqueda?";
    }

    const pideCompleto = /completa|detallad[ao]s?|explicaci[óo]n|todo(s)?|todas/i.test(query);
    const pideAleatorio = /aleatori[ao]|ejemplo|cualquiera|al azar/i.test(query);
    
    let tablaDetectada = null;
    if (results.length > 0) {
        const columnasResultado = Object.keys(results[0]);
        tablaDetectada = determinarTabla(columnasResultado);
    }

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

    const messages = [
        {
            role: "system",
            content: `Eres un asistente ultra inteligente y empático de Semilleros Deitana. Analiza los datos y responde SIEMPRE de forma clara, útil y natural.
\n- Si no hay datos, explica la situación y sugiere alternativas.
- Si la consulta es ambigua, pide más detalles.
- Si se pide un ejemplo, selecciona uno aleatorio.
- Explica el significado de los datos y su relevancia.
- Nunca repitas datos crudos, interpreta y resume.
- Sé proactivo y guía al usuario para obtener la mejor respuesta posible.
- Mantén un tono profesional, conversacional y humano.
- Si detectas errores en los datos, adviértelo de forma amable.
- Si hay relaciones (cliente, proveedor, etc.), explícalas.
- Si el usuario pide más ejemplos, ofrece variedad.
- Si la consulta es conceptual, responde normalmente.`
        },
        {
            role: "user",
            content: `Consulta: "${query}"
\nDatos encontrados:${datosReales}
\nPor favor, analiza estos datos y proporciona una respuesta útil, natural y relevante.`
        }
    ];

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: messages,
            temperature: 0.8,
            max_tokens: 600
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
    let sqlMatch = response.match(/<sql>([\s\S]*?)<\/sql>/);
    if (!sqlMatch) {
        sqlMatch = response.match(/```sql\s*([\s\S]*?)```/);
        if (sqlMatch) {
            console.log('Advertencia: SQL encontrado en formato markdown, convirtiendo a formato <sql>');
            response = response.replace(/```sql\s*([\s\S]*?)```/, '<sql>$1</sql>');
            sqlMatch = response.match(/<sql>([\s\S]*?)<\/sql>/);
        }
    }
    if (!sqlMatch) {
        return null;
    }
    let sql = sqlMatch[1].trim();
    if (!sql) {
        throw new Error('La consulta SQL está vacía');
    }
    if (!sql.toLowerCase().startsWith('select')) {
        throw new Error('La consulta debe comenzar con SELECT');
    }
    if (sql.includes('OFFSET')) {
        const offsetMatch = sql.match(/LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i);
        if (offsetMatch) {
            sql = sql.replace(
                /LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i,
                `LIMIT ${offsetMatch[2]}, ${offsetMatch[1]}`
            );
        }
    }
    const esConsultaConteo = sql.toLowerCase().includes('count(*)');
    const tieneDistinct = /select\s+distinct/i.test(sql);
    const tieneGroupBy = /group by/i.test(sql);
    const tieneJoin = /join/i.test(sql);
    const tieneFiltroFecha = /where[\s\S]*fpe_fec|where[\s\S]*fecha|where[\s\S]*_fec/i.test(sql);
    if (!esConsultaConteo && !tieneDistinct && !tieneGroupBy && !sql.toLowerCase().includes('limit') && !(tieneJoin && tieneFiltroFecha)) {
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
    
    const selectMatch = sql.match(/SELECT\s+([^\s]*?)\s+FROM/i);
    if (!selectMatch) return;

    if (selectMatch[1].trim() === '*') {
        throw new Error(`No se permite usar SELECT *. Por favor, especifica las columnas definidas en mapaERP: ${columnas.join(', ')}`);
    }
    
    const columnasEnSQL = selectMatch[1]
        .split(',')
        .map(col => {
            col = col.trim();
            if (col.match(/^[A-Za-z]+\s*\([^)]*\)$/)) return null;
            if (col.toLowerCase().includes(' as ')) {
                const [columna, alias] = col.split(/\s+as\s+/i);
                return columna.trim();
            }
            return col.replace(/^[a-z]+\./, '');
        })
        .filter(col => col !== null);
    
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
        const palabrasClave = consulta.toLowerCase().split(' ');
        console.log('Palabras clave de la consulta:', palabrasClave);

        const mapeoTablas = {
            'cliente': 'clientes',
            'proveedor': 'proveedores',
            'articulo': 'articulos'
        };

        let tablaPrincipal = null;
        for (const palabra of palabrasClave) {
            if (mapeoTablas[palabra]) {
                tablaPrincipal = mapeoTablas[palabra];
                break;
            }
        }

        if (!tablaPrincipal || !mapaERP[tablaPrincipal]) {
            return 'Tablas disponibles: ' + Object.keys(mapeoTablas).join(', ');
        }

        const tabla = mapaERP[tablaPrincipal];
        return `TABLA ${tablaPrincipal}:\n` +
               `Descripción: ${tabla.descripcion || 'No disponible'}\n` +
               `Columnas principales: ${Object.keys(tabla.columnas || {}).slice(0, 5).join(', ')}`;

    } catch (error) {
        console.error('Error al obtener contenido de mapaERP:', error);
        return '';
    }
}

// Función para procesar la consulta del usuario
async function processQuery(userQuery) {
    try {
        const contenidoMapaERP = obtenerContenidoMapaERP(userQuery);
        conversationHistory.push({ role: "user", content: userQuery });

        const historyForAI = conversationHistory.slice(-10);
        let contextoDatos = '';
        if (lastRealData && lastRealData.type && lastRealData.data) {
            contextoDatos = `\n\nDATOS REALES DISPONIBLES DE LA CONSULTA ANTERIOR:\nTipo: ${lastRealData.type}\nDatos: ${JSON.stringify(lastRealData.data)}`;
        }

        const systemPrompt = `Eres Deitana IA, un asistente de información de vanguardia, impulsado por una sofisticada inteligencia artificial y diseñado específicamente para interactuar de manera experta con la base de datos de Semilleros Deitana.

Mi único propósito es ayudarte a obtener, analizar y comprender información relevante de Semilleros Deitana, su base de datos y su sector agrícola.

IMPORTANTE:
- En la tabla 'clientes' están todos los clientes de la empresa. Las columnas principales son:
  * CL_DENO: Denominación del cliente
  * CL_DOM: Dirección del cliente
  * CL_POB: Población del cliente
  * CL_TEL: Teléfono del cliente
  * CL_MAIL: Email del cliente

- En la tabla 'articulos' están todos los artículos e injertos.
- En la tabla 'proveedores' están todos los proveedores.

${contenidoMapaERP}${contextoDatos}

INSTRUCCIONES PARA GENERAR CONSULTAS SQL:
1. SIEMPRE usa los nombres exactos de las tablas y columnas definidos en mapaERP.
2. Para clientes, usa la tabla 'clientes' (no 'cliente').
3. Para buscar por población, usa la columna CL_POB.
4. Para buscar por dirección, usa la columna CL_DOM.
5. Para buscar por nombre, usa la columna CL_DENO.

Ejemplos de consultas correctas:
- Para clientes de El Ejido: SELECT CL_DENO, CL_DOM, CL_POB, CL_TEL FROM clientes WHERE CL_POB LIKE '%El Ejido%' LIMIT 3;
- Para clientes por nombre: SELECT CL_DENO, CL_DOM, CL_POB FROM clientes WHERE CL_DENO LIKE '%nombre%' LIMIT 3;

SIEMPRE que el usuario haga una consulta sobre datos, GENERA SOLO UNA CONSULTA SQL válida y ejecutable (en bloque <sql>...</sql> o en bloque de código sql), sin explicaciones ni texto adicional.
- Si la consulta es ambigua, genera una consulta SQL tentativa que muestre un registro relevante.
- NUNCA digas que no tienes acceso a la base de datos.
- NUNCA respondas con texto genérico.
- NUNCA inventes datos.
- SIEMPRE usa los nombres de tablas y columnas exactos de mapaERP.
- SI la consulta es conceptual o no requiere datos, responde normalmente.`;

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
            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: messages,
                temperature: 0.7,
                max_tokens: 1000
            });
            response = completion.choices[0].message.content;
            conversationHistory.push({ role: "assistant", content: response });
            sql = validarRespuestaSQL(response);
            if (!sql) {
                feedback = 'Por favor, responde SOLO con una consulta SQL válida y ejecutable, sin explicaciones ni texto adicional.';
                intentos++;
                continue;
            }
            try {
                let results = await executeQuery(sql);
                if (!results || results.length === 0) {
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
                                const finalResponse = await formatFinalResponse(similares, userQuery + ' (artículos similares)');
                                return {
                                    success: true,
                                    data: {
                                        message: finalResponse + '\n\n(Nota: No se encontró coincidencia exacta, se muestran los artículos más similares disponibles)'
                                    }
                                };
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
                        } else {
                            results = [];
                        }
                    }
                }
                if (!results || results.length === 0) {
                    const noResultPrompt = [
                        {
                            role: "system",
                            content: `Eres Deitana IA, un asistente ultra inteligente, empático y proactivo para Semilleros Deitana.\n\nLa consulta SQL generada no devolvió resultados.\n\n- Analiza la situación y sugiere alternativas al usuario.\n- Propón buscar artículos o proveedores similares, usando coincidencias aproximadas o palabras clave.\n- Si crees que hay un error de escritura, sugiere correcciones.\n- Pide más detalles si es necesario.\n- Ofrece ejemplos de cómo preguntar.\n- Mantén siempre un tono conversacional, profesional y humano.\n- Nunca uses respuestas técnicas ni genéricas.\n- Si la consulta es conceptual, responde normalmente.`
                        },
                        {
                            role: "user",
                            content: `No se encontraron resultados para la consulta: "${userQuery}".\n\nPor favor, sugiere alternativas, busca aproximaciones o pide más detalles al usuario para ayudarle a encontrar lo que busca.`
                        }
                    ];
                    try {
                        const completion = await openai.chat.completions.create({
                            model: "gpt-4-turbo-preview",
                            messages: noResultPrompt,
                            temperature: 0.8,
                            max_tokens: 350
                        });
                        return {
                            success: true,
                            data: {
                                message: completion.choices[0].message.content
                            }
                        };
                    } catch (error) {
                        return {
                            success: true,
                            data: {
                                message: "No pude encontrar resultados ni sugerir alternativas. ¿Podrías intentar ser más específico o darme algún dato adicional? Si tienes dudas sobre cómo preguntar, dime el tipo de dato que buscas (por ejemplo: nombre, fecha, proveedor, etc.)."
                            }
                        };
                    }
                }
                let tipo = 'dato';
                if (results[0] && results[0].CL_DENO) tipo = 'cliente';
                if (results[0] && results[0].AR_NOMB) tipo = 'articulo';
                lastRealData = { type: tipo, data: results };
                const finalResponse = await formatFinalResponse(results, userQuery);
                return {
                    success: true,
                    data: {
                        message: finalResponse
                    }
                };
            } catch (error) {
                feedback = 'La consulta SQL generada fue inválida o produjo un error. Por favor, genera SOLO una consulta SQL válida y ejecutable.';
                errorSQL = error;
                intentos++;
                sql = null;
            }
        }
        lastRealData = null;
        const fallbackPrompt = [
            {
                role: "system",
                content: `Eres Deitana IA, un asistente ultra inteligente, empático y proactivo para Semilleros Deitana.\n\n- Si la consulta del usuario es ambigua, falta información clave, o no puedes generar una consulta SQL válida, responde SIEMPRE de manera conversacional, profesional y humana.\n- Explica la situación, pide amablemente más detalles, sugiere ejemplos de cómo el usuario puede especificar la consulta, y adapta el tono según el contexto.\n- Nunca uses respuestas técnicas ni genéricas.\n- Nunca digas que no puedes ayudar.\n- Sé proactivo y guía al usuario para que obtenga la información que necesita.\n- Si el usuario parece frustrado, tranquilízalo y ofrece ayuda extra.\n- Si la consulta es conceptual, responde normalmente.`
            },
            {
                role: "user",
                content: `Consulta ambigua o falta información clave. Consulta original: "${userQuery}". Por favor, responde de manera conversacional, sugiere cómo el usuario puede especificar mejor su consulta y ofrece ejemplos de preguntas útiles.`
            }
        ];
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: fallbackPrompt,
                temperature: 0.8,
                max_tokens: 350
            });
            return {
                success: true,
                data: {
                    message: completion.choices[0].message.content
                }
            };
        } catch (error) {
            return {
                success: true,
                data: {
                    message: "No pude procesar tu consulta. ¿Podrías intentar ser más específico o darme algún dato adicional? Si tienes dudas sobre cómo preguntar, dime el tipo de dato que buscas (por ejemplo: nombre, fecha, proveedor, etc.)."
                }
            };
        }
    } catch (error) {
        lastRealData = null;
        return {
            success: true,
            data: {
                message: "Entiendo tu consulta. Déjame ayudarte con eso. " + error.message
            }
        };
    }
}

module.exports = {
    processQuery
}; 