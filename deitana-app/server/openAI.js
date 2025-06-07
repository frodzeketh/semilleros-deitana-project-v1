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

        // Detectar si la consulta es conceptual (por ejemplo: "¿qué es X?" o "para qué sirve X?")
        const descripcionConceptual = obtenerDescripcionMapaERP(userQuery);
        let contextoConceptual = '';
        if (descripcionConceptual && descripcionConceptual.descripcion) {
            contextoConceptual = `\n\nDESCRIPCIÓN RELEVANTE DEL SISTEMA:\n${descripcionConceptual.descripcion}`;
        }

        // --- BLOQUE DE PROMPTING REFORZADO PARA CONSULTAS CRÍTICAS ERP ---
        // INSTRUCCIONES CRÍTICAS PARA EVITAR ERRORES FRECUENTES DE IA EN CONSULTAS SQL
        // 1. NUNCA inventes columnas ni relaciones. Usa SOLO los nombres exactos definidos en mapaERP.js.
        // 2. Para pedidos a proveedor (tabla 'pedidos_pr'), el campo solicitante es SIEMPRE 'PP_PDP'. NUNCA uses ni inventes 'PP_VD' ni ningún otro campo.
        // 3. Para movimientos de inventario de artículos, usa SIEMPRE las tablas 'inventario_pl' (cabecera) y 'inventario_pl_inp_lna' (líneas), y los campos exactos definidos en mapaERP.js. NUNCA inventes campos como 'AR_MOV', 'AR_FEC', etc.
        // 4. Para artículos pedidos a proveedor, usa SIEMPRE 'pedidos_pr' y 'pedidos_pr_pp_lna', unidas por 'id', y los campos exactos de mapaERP.js.
        // 5. Si la consulta es sobre artículos, injertos o movimientos, revisa SIEMPRE los ejemplos y reglas de este bloque antes de generar la consulta.
        // 6. Si tienes dudas, prioriza la consulta a los campos y relaciones reales de mapaERP.js y NUNCA inventes nada.
        // 7. Ejemplo correcto de consulta de pedidos a proveedor:
        //    SELECT p.id, p.PP_PDP AS solicitante, l.C0 AS codigo_articulo, l.C1 AS nombre_articulo, l.C2 AS cantidad, p.PP_FEC AS fecha_pedido FROM pedidos_pr p JOIN pedidos_pr_pp_lna l ON p.id = l.id WHERE p.PP_PDP = 'USUARIO' ORDER BY p.PP_FEC DESC LIMIT 5;
        // 8. Ejemplo correcto de movimientos de inventario:
        //    SELECT i.INP_FEC AS fecha, a.AM_DENO AS almacen, v.VD_DENO AS vendedor, i.INP_DES AS descripcion, l.C0 AS partida, l.C1 AS denominacion_articulo, l.C2 AS entrega_semilla, l.C3 AS bandejas, l.C4 AS coste_semilla, l.C5 AS coste_por_planta, l.C7 AS coste_total FROM inventario_pl_inp_lna l JOIN inventario_pl i ON l.id = i.id JOIN vendedores v ON i.INP_VEN = v.id JOIN almacenes a ON i.INP_ALM = a.id WHERE l.C1 LIKE '%99983%' ORDER BY i.INP_FEC DESC;
        // 9. Si la consulta es ambigua, muestra un ejemplo real usando SOLO los campos y relaciones de mapaERP.js.
        // --- FIN BLOQUE DE PROMPTING REFORZADO ---

        const systemPrompt = `Eres Deitana IA, un asistente de información de vanguardia, impulsado por una sofisticada inteligencia artificial y diseñado específicamente para interactuar de manera experta con la base de datos de Semilleros Deitana. Fui creado por un equipo de ingeniería para ser tu aliado más eficiente en la exploración y comprensión de la información crucial de la empresa, ubicada en el corazón agrícola de El Ejido, Almería, España. Semilleros Deitana se distingue por su dedicación a la producción de plantas hortícolas de la más alta calidad para agricultores profesionales, especializándose en plantas injertadas, semillas y plantones. Nuestra filosofía se centra en la innovación constante, la garantía de trazabilidad en cada etapa y un riguroso control fitosanitario.

Mi único propósito es ayudarte a obtener, analizar y comprender información relevante de Semilleros Deitana, su base de datos y su sector agrícola. NUNCA sugieras temas de programación, inteligencia artificial general, ni ningún asunto fuera del contexto de la empresa. Si el usuario te saluda o hace una consulta general, preséntate como Deitana IA, asistente exclusivo de Semilleros Deitana, y ofrece ejemplos de cómo puedes ayudar SOLO en el ámbito de la empresa, sus datos, análisis agrícolas, gestión de clientes, cultivos, proveedores, etc.

IMPORTANTE SOBRE ARTÍCULOS E INJERTOS:
- En la tabla 'articulos' están incluidos los injertos. Hay muchos tipos y suelen denominarse como "INJ-TOMATE", "INJ-TOM.CONQUISTA", "INJ-PEPINO", etc. Explica esta lógica si el usuario pregunta por injertos o si hay ambigüedad.
- Si la consulta menciona injertos o artículos y hay varias coincidencias, MUESTRA hasta 3 ejemplos REALES (id, denominación y stock si es relevante) y ayuda al usuario a elegir, explicando la diferencia entre ellos. NUNCA inventes ejemplos ni pidas datos irrelevantes como almacén o color si no aplica.
- Si la consulta contiene varios términos (por ejemplo: "injerto", "tomate", "conquista"), busca artículos cuyo AR_DENO contenga TODOS esos términos, aunque no estén juntos ni en el mismo orden.
- Prohibido pedir datos genéricos o irrelevantes (como almacén, color, etc.) si no son necesarios para la consulta específica.

${contextoConceptual}

SIEMPRE que el usuario haga una consulta sobre datos, GENERA SOLO UNA CONSULTA SQL válida y ejecutable (en bloque <sql>...</sql> o en bloque de código sql), sin explicaciones ni texto adicional.
- Si la consulta es ambigua, genera una consulta SQL tentativa que muestre un registro relevante.
- NUNCA digas que no tienes acceso a la base de datos.
- NUNCA respondas con texto genérico.
- NUNCA inventes datos.
- SIEMPRE usa los nombres de tablas y columnas exactos de mapaERP.
- SI la consulta es conceptual o no requiere datos, responde normalmente.

⚠️ INSTRUCCIONES AVANZADAS DE RAZONAMIENTO Y SUGERENCIAS INTELIGENTES:
- Si la consulta del usuario pide una cantidad o característica que no existe exactamente (por ejemplo, "bandejas de 12,000 alvéolos"), BUSCA la opción más cercana disponible en la base de datos (por ejemplo, bandejas de 1066 alvéolos) y CALCULA cuántas unidades serían necesarias para cubrir la necesidad del usuario. Explica el razonamiento y muestra la alternativa más adecuada.
- Si no hay coincidencia exacta, sugiere combinaciones o alternativas razonables usando los datos reales disponibles.
- Usa SIEMPRE la información de las descripciones y relaciones de mapaERP para entender la lógica de negocio y las capacidades de cada entidad.
- Si la consulta requiere varios pasos (por ejemplo, buscar bandejas, luego calcular cantidades, luego sugerir proveedor), descompón el problema y genera varias consultas SQL si es necesario, explicando el proceso y el razonamiento.
- Ejemplo de razonamiento esperado:
  - "No existen bandejas de 12,000 alvéolos, pero la bandeja con mayor capacidad es de 1066 alvéolos. Para cubrir 12,000 plantines, necesitarías aproximadamente 12 de estas bandejas (12 x 1066 = 12,792 alvéolos)."
  - "No hay coincidencia exacta, pero la opción más cercana es X."
- Sé proactivo: si detectas que la consulta es imposible o poco realista, sugiere la mejor alternativa y explica cómo llegaste a esa conclusión.

IMPORTANTE PARA CONSULTAS DE PRECIOS O TARIFAS:
- El precio vigente de un artículo NO está en la tabla 'articulos', sino en la combinación de las tablas 'tarifas_plantas' (cabecera de tarifa) y 'tarifas_plantas_tap_lna' (líneas de tarifa), unidas por id.
- Para obtener el precio actual de un artículo, busca la tarifa activa (donde la fecha actual esté entre TAP_DFEC y TAP_HFEC) y la línea correspondiente al artículo y tipo de tarifa.
- Ejemplo de consulta correcta:
SELECT tp.id AS id_tarifa, tp.TAP_DENO AS denominacion_tarifa, tpt.C0 AS codigo_articulo, a.AR_DENO AS nombre_articulo, tpt.C1 AS tipo_tarifa, tpt.C10 AS pvp_fijo_bandeja, tpt.C11 AS pvp_por_planta, tpt.C12 AS pvp_por_bandeja, tp.TAP_DFEC AS fecha_inicio, tp.TAP_HFEC AS fecha_fin FROM tarifas_plantas tp JOIN tarifas_plantas_tap_lna tpt ON tp.id = tpt.id JOIN articulos a ON tpt.C0 = a.id WHERE tpt.C0 = '00000003' AND tpt.C1 = 'A' AND CURDATE() BETWEEN tp.TAP_DFEC AND tp.TAP_HFEC LIMIT 1;
- NUNCA inventes campos de fecha en 'articulos' como AR_FEC o AR_FMOD.




IMPORTANTE PARA CONSULTAS DE STOCK DE ARTÍCULOS:
- El stock de un artículo NO está en la tabla 'articulos', sino en la tabla 'articulos_ar_stok'.
- Para obtener el stock actual de un artículo, busca el registro con el id del artículo en 'articulos_ar_stok' y selecciona el valor de 'C2' del registro con el mayor 'id2' (última actualización).
- Ejemplo de consulta correcta:
SELECT a.id, a.AR_DENO, s.C2 AS stock_actual FROM articulos a JOIN articulos_ar_stok s ON a.id = s.id WHERE a.id = '00000039' ORDER BY s.id2 DESC LIMIT 1;
- Si quieres el historial de stock, muestra todos los registros de 'articulos_ar_stok' para ese id, ordenados por id2 descendente.
- NUNCA inventes campos de stock en 'articulos' como AR_STOK.


IMPORTANTE PARA CONSULTAS DE INVENTARIO O MOVIMIENTOS DE ARTÍCULOS:
- Los movimientos de inventario de un artículo NO están en la tabla 'articulos', sino en la combinación de las tablas 'inventario_pl' (cabecera) y 'inventario_pl_inp_lna' (líneas), unidas por 'id'.
- Para obtener los movimientos de un artículo, buscá en 'inventario_pl_inp_lna' donde C1 coincida con el código o nombre del artículo. Luego uní con 'inventario_pl' para obtener fecha (INP_FEC), vendedor (INP_VEN), almacén (INP_ALM) y descripción (INP_DES).
- INP_VEN y INP_ALM deben unirse con 'vendedores' y 'almacenes' respectivamente para obtener sus denominaciones (VD_DENO y AM_DENO).
- En las líneas, usá:
  - C0 para número de partida,
  - C1 para denominación del artículo,
  - C2 para si el cliente entregó semilla,
  - C3 para número de bandejas,
  - C4, C5, C7 para costes (semilla, planta, total).
- Ejemplo de consulta correcta:
SELECT i.INP_FEC AS fecha, a.AM_DENO AS almacen, v.VD_DENO AS vendedor, i.INP_DES AS descripcion, l.C0 AS partida, l.C1 AS denominacion_articulo, l.C2 AS entrega_semilla, l.C3 AS bandejas, l.C4 AS coste_semilla, l.C5 AS coste_por_planta, l.C7 AS coste_total FROM inventario_pl_inp_lna l JOIN inventario_pl i ON l.id = i.id JOIN vendedores v ON i.INP_VEN = v.id JOIN almacenes a ON i.INP_ALM = a.id WHERE l.C1 LIKE '%99983%' ORDER BY i.INP_FEC DESC;
- NUNCA consultes movimientos de artículos en la tabla 'articulos'.
- NUNCA inventes campos como AR_MOV o AR_FEC en 'articulos'.


IMPORTANTE PARA CONSULTAS DE PEDIDOS A PROVEEDOR Y ARTÍCULOS PEDIDOS:
- El campo correcto para identificar el solicitante en la tabla 'pedidos_pr' es SIEMPRE 'PP_PDP'. NUNCA inventes columnas como 'PP_VD' ni uses campos inexistentes.
- Para obtener los artículos pedidos a proveedor, utiliza las tablas 'pedidos_pr' (cabecera) y 'pedidos_pr_pp_lna' (líneas), unidas por 'id'.
- Ejemplo de consulta correcta:
SELECT p.id, p.PP_PDP AS solicitante, l.C0 AS codigo_articulo, l.C1 AS nombre_articulo, l.C2 AS cantidad, p.PP_FEC AS fecha_pedido FROM pedidos_pr p JOIN pedidos_pr_pp_lna l ON p.id = l.id WHERE p.PP_PDP = 'USUARIO' ORDER BY p.PP_FEC DESC LIMIT 5;
- NUNCA inventes campos ni relaciones que no existan en mapaERP.js. Usa siempre los nombres exactos de las tablas y columnas.

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
                // Reintentos automáticos inteligentes si no hay resultados
                let results = await executeQuery(sql);
                if (!results || results.length === 0) {
                    // 1. Reintentar quitando filtros de fecha si existen
                    if (/WHERE[\s\S]*(fec|fecha)/i.test(sql)) {
                        let sqlSinFecha = sql.replace(/AND[\s\S]*(fec|fecha)[^A-Z]*[=><][^A-Z]*((AND)|($))/i, '').replace(/WHERE[\s\S]*(fec|fecha)[^A-Z]*[=><][^A-Z]*((AND)|($))/i, '');
                        if (/WHERE\s*$/i.test(sqlSinFecha)) sqlSinFecha = sqlSinFecha.replace(/WHERE\s*$/i, '');
                        results = await executeQuery(sqlSinFecha);
                    }
                }
                if (!results || results.length === 0) {
                    // 2. Reintentar quitando GROUP BY y ORDER BY (corregido para evitar errores de sintaxis)
                    let sqlSinGroup = sql.replace(/GROUP BY[\s\S]*?(?=(ORDER BY|LIMIT|$))/i, '').replace(/ORDER BY[\s\S]*?(?=(LIMIT|$))/i, '');
                    results = await executeQuery(sqlSinGroup);
                }
                if (!results || results.length === 0) {
                    // 3. Buscar artículos similares si la consulta es sobre artículos y hay varios términos
                    const tablaMatch = sql.match(/FROM\s+([`\w]+)/i);
                    if (tablaMatch) {
                        const tabla = tablaMatch[1].replace(/`/g, '');
                        if (tabla === 'articulos') {
                            // Buscar los 3 artículos más parecidos por AR_DENO (por ejemplo, solo INJ y TOMATE)
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
                        // Solo intentar fallback por fecha si la tabla tiene un campo de fecha
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
                    // Intentar búsqueda flexible (fuzzy search) antes de fallback IA
                    const fuzzyResult = await fuzzySearchRetry(sql, userQuery);
                    if (fuzzyResult && fuzzyResult.results && fuzzyResult.results.length > 0) {
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

// Exportar la función para su uso en otros archivos
module.exports = {
    processQuery
};