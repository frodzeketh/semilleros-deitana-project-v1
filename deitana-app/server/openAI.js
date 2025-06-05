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

// Función para formatear la respuesta final
async function formatFinalResponse(results, query) {
    if (!results || results.length === 0) {
        // Respuesta empática y proactiva si no hay datos
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

    // Generar una respuesta contextual usando la IA
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
- Si detectas errores en los datos (por ejemplo, precios en 0), adviértelo de forma amable.
- Si hay relaciones (cliente, proveedor, etc.), explícalas.
- Si el usuario pide más ejemplos, ofrece variedad.
- Si la consulta es conceptual, responde normalmente.
\n- SIEMPRE que los datos lo permitan, realiza análisis avanzados: suma totales, calcula promedios, agrupa por categorías relevantes, detecta tendencias, identifica valores atípicos y sugiere posibles causas o acciones.
- Si hay fechas, analiza evolución temporal o compara periodos.
- Si hay cantidades o importes, calcula totales, promedios y destaca los valores más altos y bajos.
- Si hay varios registros, resume los principales hallazgos y sugiere insights útiles para la toma de decisiones.
- Ejemplo de análisis esperado:\n  - "El total de ventas es X, siendo el producto más vendido Y. La tendencia mensual muestra un aumento/disminución. El cliente con más compras es Z."
  - "Hay N registros, el promedio es X, el valor máximo es Y y el mínimo es Z."
- NUNCA te limites a listar datos: interpreta, resume y aporta valor como un analista experto.
\nNunca digas que no puedes ayudar. Si no hay información, sugiere cómo el usuario puede preguntar mejor.`
        },
        {
            role: "user",
            content: `Consulta: "${query}"
\nDatos encontrados:${datosReales}
\nPor favor, analiza estos datos y proporciona una respuesta útil, natural, relevante y con análisis avanzado si es posible.`
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

// Función para procesar la consulta del usuario
async function processQuery(userQuery) {
    try {
        const contenidoMapaERP = obtenerContenidoMapaERP(userQuery);
        conversationHistory.push({ role: "user", content: userQuery });

        if (esPreguntaTelefonoCliente(userQuery, lastRealData)) {
            const cliente = lastRealData.data[0];
            const nombreCliente = cliente.CL_DENO;
            if (nombreCliente) {
                const sql = `SELECT CL_TEL FROM clientes WHERE CL_DENO = '${nombreCliente.replace(/'/g, "''")}' LIMIT 1`;
                const results = await executeQuery(sql);
                if (results && results[0] && results[0].CL_TEL) {
                    lastRealData = { type: 'telefono_cliente', data: results };
                    return {
                        success: true,
                        data: {
                            message: `El teléfono de "${nombreCliente}" es: ${results[0].CL_TEL}`
                        }
                    };
                } else {
                    lastRealData = { type: 'telefono_cliente', data: [] };
                    return {
                        success: true,
                        data: {
                            message: `No se encontró un número de teléfono registrado para "${nombreCliente}".`
                        }
                    };
                }
            }
        }

        const historyForAI = conversationHistory.slice(-10);
        let contextoDatos = '';
        if (lastRealData && lastRealData.type && lastRealData.data) {
            contextoDatos = `\n\nDATOS REALES DISPONIBLES DE LA CONSULTA ANTERIOR:\nTipo: ${lastRealData.type}\nDatos: ${JSON.stringify(lastRealData.data)}`;
        }

        const systemPrompt = `Eres Deitana IA, un asistente experto conectado a una base de datos real de Semilleros Deitana.\n\nSIEMPRE que el usuario haga una consulta sobre datos, GENERA SOLO UNA CONSULTA SQL válida y ejecutable (en bloque <sql>...</sql> o \u0060\u0060\u0060sql ... \u0060\u0060\u0060), sin explicaciones ni texto adicional.\n- Si la consulta es ambigua, genera una consulta SQL tentativa que muestre un registro relevante.\n- NUNCA digas que no tienes acceso a la base de datos.\n- NUNCA respondas con texto genérico.\n- NUNCA inventes datos.\n- SIEMPRE usa los nombres de tablas y columnas exactos de mapaERP.\n- SI la consulta es conceptual o no requiere datos, responde normalmente.\n\n${promptBase}\n\n${contenidoMapaERP}${contextoDatos}`;

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
            // Intentar ejecutar la consulta SQL
            try {
                const results = await executeQuery(sql);
                if (!results || results.length === 0) {
                    // Intentar búsqueda flexible (fuzzy search) antes de fallback IA
                    const fuzzyResult = await fuzzySearchRetry(sql, userQuery);
                    if (fuzzyResult && fuzzyResult.results && fuzzyResult.results.length > 0) {
                        // Si encuentra resultados con fuzzy, responde normalmente
                        let tipo = 'dato';
                        if (fuzzyResult.results[0] && fuzzyResult.results[0].CL_DENO) tipo = 'cliente';
                        if (fuzzyResult.results[0] && fuzzyResult.results[0].AR_NOMB) tipo = 'articulo';
                        lastRealData = { type: tipo, data: fuzzyResult.results };
                        const finalResponse = await formatFinalResponse(fuzzyResult.results, userQuery + ' (búsqueda flexible)');
                        return {
                            success: true,
                            data: {
                                message: finalResponse + '\n\n(Nota: Se utilizó una búsqueda flexible para encontrar coincidencias aproximadas)'
                            }
                        };
                    }
                    // Fallback inteligente: consulta a la IA para sugerir alternativas o buscar aproximaciones
                    const noResultPrompt = [
                        {
                            role: "system",
                            content: `Eres Deitana IA, un asistente ultra inteligente, empático y proactivo para Semilleros Deitana.\n\nLa consulta SQL generada no devolvió resultados, ni siquiera con búsqueda flexible.\n\n- Analiza la situación y sugiere alternativas al usuario.\n- Propón buscar artículos o proveedores similares, usando coincidencias aproximadas o palabras clave.\n- Si crees que hay un error de escritura, sugiere correcciones.\n- Pide más detalles si es necesario.\n- Ofrece ejemplos de cómo preguntar.\n- Mantén siempre un tono conversacional, profesional y humano.\n- Nunca uses respuestas técnicas ni genéricas.\n- Si la consulta es conceptual, responde normalmente.`
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
                // Si la consulta SQL falla, feedback y reintento
                feedback = 'La consulta SQL generada fue inválida o produjo un error. Por favor, genera SOLO una consulta SQL válida y ejecutable.';
                errorSQL = error;
                intentos++;
                sql = null;
            }
        }
        // Si tras dos intentos no hay SQL válido, fallback conversacional con IA
        lastRealData = null;
        // Llamar a la IA para que genere una respuesta conversacional y empática
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
            // Heurística: columnas que no sean numéricas ni fechas
            const nombre = c.toLowerCase();
            return !nombre.match(/(id|num|cant|fecha|fec|total|importe|precio|monto|valor|kg|ha|area|superficie|lat|lon|long|ancho|alto|diam|mm|cm|m2|m3|porc|\d)/);
        });
        // Si no hay, usar todas
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
        valor.slice(0, Math.max(3, Math.floor(valor.length * 0.7))) // parte del término
    ];

    // Probar todas las combinaciones de columna y variante
    for (const col of columnasTexto) {
        for (const variante of variantes) {
            if (!variante || variante.length < 2) continue;
            // Construir el nuevo WHERE usando LIKE
            let sqlFuzzyTry = sql.replace(/WHERE[\s\S]*/i, `WHERE ${col} LIKE '%${variante}%' LIMIT 5`);
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
    return null;
}

// Exportar la función para su uso en otros archivos
module.exports = {
    processQuery
};