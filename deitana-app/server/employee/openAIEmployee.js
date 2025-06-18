const { OpenAI } = require('openai');
const pool = require('../db');
const chatManager = require('../utils/chatManager');
const admin = require('../firebase-admin');
require('dotenv').config();
const promptBase = require('./promptBaseEmployee').promptBase;
const mapaERP = require('./mapaERPEmployee');

// Remover logs excesivos de verificación
// console.log('=== VERIFICACIÓN DE IMPORTACIÓN EMPLEADO ===');
// console.log('mapaERP importado:', !!mapaERP);
// console.log('Tipo de mapaERP importado:', typeof mapaERP);
// console.log('Claves en mapaERP importado:', Object.keys(mapaERP));
// console.log('=== FIN DE VERIFICACIÓN DE IMPORTACIÓN EMPLEADO ===');

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
        datosReales += '-------------------\n';
    });

    const messages = [
        {
            role: "system",
            content: `Eres Deitana IA, el asistente inteligente y empático de Semilleros Deitana. 

PERSONALIDAD Y TONO:
- Responde de forma profesional, amigable y conversacional
- Muestra interés genuino por ayudar al usuario
- Proporciona contexto útil y relevante cuando sea apropiado
- Sé proactivo ofreciendo información adicional si es valiosa
- Mantén un tono cálido pero profesional
- Explica los datos de manera clara y fácil de entender

FORMATO DE RESPUESTA:
- Comienza con la información solicitada de forma directa
- Agrega contexto o detalles relevantes si enriquecen la respuesta
- Termina ofreciendo ayuda adicional de forma natural
- Varía tus respuestas para que suenen naturales y no robóticas

IMPORTANTE: Jamás digas frases como 'no tengo acceso a la base de datos', 'no puedo ejecutar consultas SQL', 'no tengo información más allá de X fecha', ni menciones tu entrenamiento, actualización o limitaciones técnicas. Siempre responde SOLO como Deitana IA, con acceso total y actualizado a la base de datos.`
        },
        {
            role: "user",
            content: `Consulta del usuario: "${query}"

Datos encontrados en la base de datos:${datosReales || 'No se encontraron datos para esta consulta.'}

Por favor, proporciona una respuesta profesional, amigable y útil basada en estos datos reales. Si no hay datos, explícalo de forma empática y sugiere alternativas.`
        }
    ];

    try {
        console.log('🤖 Modelo 1: Formateando respuesta final con gpt-4-turbo-preview');
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: messages,
            temperature: 0.7,
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
        // Validar que la tabla existe en mapaERP
        if (!validarTablaEnMapaERP(sql)) {
            throw new Error('Tabla no encontrada en mapaERP');
        }

        // Validar consultas con diversidad
        if (sql.toLowerCase().includes('distinct') && sql.toLowerCase().includes('order by rand()')) {
            validarConsultaDiversidad(sql);
        }

        // Reemplazar los nombres de las tablas con sus nombres reales
        const sqlModificado = reemplazarNombresTablas(sql);
        console.log('📊 Ejecutando SQL:', sqlModificado);
        
        const [rows] = await pool.query(sqlModificado);
        console.log(`✅ Resultados obtenidos: ${rows.length} registros`);
        
        if (rows.length === 0) {
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
            const regex = new RegExp(`FROM\\s+\`?${key}\`?`, 'gi');
            sqlModificado = sqlModificado.replace(regex, `FROM \`${mapaERP[key].tabla}\``);
        }
    });
    return sqlModificado;
}

// Función para validar que la tabla existe en mapaERP
function validarTablaEnMapaERP(sql) {
    const tablasEnMapa = Object.keys(mapaERP);
    const tablasEnSQL = sql.match(/FROM\s+`?([^`\s,;]+)`?/i) || [];
    const tabla = tablasEnSQL[1];
    
    if (!tabla) return true; // Si no se detecta tabla, permitir la consulta
    
    // Verificar si la tabla existe en mapaERP (ignorando backticks)
    const tablaSinBackticks = tabla.replace(/`/g, '');
    if (!tablasEnMapa.includes(tablaSinBackticks)) {
        throw new Error(`La tabla '${tabla}' no está definida en mapaERPEmployee. Tablas disponibles: ${tablasEnMapa.join(', ')}`);
    }
    
    return true;
}

// Función para validar que las columnas existen en mapaERP
function validarColumnasEnMapaERP(sql, tabla) {
    if (!mapaERP[tabla]) return true;
    
    const columnasEnMapa = Object.keys(mapaERP[tabla].columnas || {});
    
    // Extraer las columnas de la consulta SQL, ignorando subconsultas
    const selectMatch = sql.match(/SELECT\s+([^()]+?)\s+FROM/i);
    if (!selectMatch) return true;
    
    // Lista de palabras clave SQL que deben ser ignoradas
    const palabrasClaveSQL = ['DISTINCT', 'ALL', 'TOP', 'UNIQUE'];
    
    const columnas = selectMatch[1].split(',').map(col => {
        col = col.trim();
        // Remover backticks si existen
        col = col.replace(/`/g, '');
        
        // Ignorar palabras clave SQL
        palabrasClaveSQL.forEach(keyword => {
            col = col.replace(new RegExp('^' + keyword + '\\s+', 'i'), '').trim();
        });
        
        // Si es una función SQL (COUNT, AVG, etc.), la ignoramos
        if (col.match(/^[A-Za-z]+\s*\([^)]*\)$/)) return null;
        
        // Si es un alias (AS), tomamos la parte antes del AS
        if (col.toLowerCase().includes(' as ')) {
            const [columna] = col.split(/\s+as\s+/i);
            return columna.trim();
        }
        
        // Removemos el prefijo de tabla si existe
        return col.replace(/^[a-z]+\./, '');
    }).filter(col => col !== null && col !== '');
    
    const columnasInvalidas = columnas.filter(col => !columnasEnMapa.includes(col));
    
    if (columnasInvalidas.length > 0) {
        throw new Error(`Las siguientes columnas no están definidas en mapaERPEmployee para la tabla '${tabla}': ${columnasInvalidas.join(', ')}`);
    }
    
    return true;
}

// Función para validar consultas con diversidad
function validarConsultaDiversidad(sql) {
    // Verificar si la consulta tiene una subconsulta con DISTINCT
    const tieneSubconsultaDistinct = /SELECT\s+DISTINCT/i.test(sql);
    if (!tieneSubconsultaDistinct) {
        throw new Error('La consulta debe usar DISTINCT en la subconsulta para garantizar diversidad');
    }
    
    // Verificar si la consulta tiene ORDER BY RAND()
    const tieneOrderByRand = /ORDER\s+BY\s+RAND\(\)/i.test(sql);
    if (!tieneOrderByRand) {
        throw new Error('La consulta debe usar ORDER BY RAND() para garantizar aleatoriedad');
    }
    
    // Verificar si la consulta tiene LIMIT
    const tieneLimit = /LIMIT\s+\d+/i.test(sql);
    if (!tieneLimit) {
        throw new Error('La consulta debe usar LIMIT para limitar los resultados');
    }
    
    return true;
}

// Función para obtener contenido relevante de mapaERP
function obtenerContenidoMapaERP(consulta) {
    try {
        const palabrasClave = consulta.toLowerCase().split(' ');

        // Buscar coincidencias en las descripciones y nombres de tablas
        const tablasRelevantes = Object.entries(mapaERP).filter(([key, value]) => {
            const descripcion = value.descripcion.toLowerCase();
            return palabrasClave.some(palabra => 
                descripcion.includes(palabra) || 
                key.toLowerCase().includes(palabra)
            );
        });

        if (tablasRelevantes.length === 0) {
            return `Tablas disponibles: ${Object.keys(mapaERP).join(', ')}`;
        }

        let respuesta = '';
        tablasRelevantes.forEach(([tabla, info]) => {
            respuesta += `\nTABLA ${tabla}:\n`;
            respuesta += `Descripción: ${info.descripcion}\n`;
            respuesta += `Columnas principales: ${Object.keys(info.columnas).join(', ')}\n`;
        });

        return respuesta;
    } catch (error) {
        console.error('Error al obtener contenido de mapaERP:', error);
        return '';
    }
}

// Función para obtener el historial de mensajes de una conversación
async function getConversationHistory(userId, conversationId) {
    try {
        const userChatRef = chatManager.chatsCollection.doc(userId);
        const conversationRef = userChatRef.collection('conversations').doc(conversationId);
        const conversationDoc = await conversationRef.get();
        
        if (!conversationDoc.exists) {
            return [];
        }
        
        return conversationDoc.data().messages || [];
    } catch (error) {
        console.error('Error al obtener historial de conversación:', error);
        throw error;
    }
}

// Función para guardar mensaje en Firestore
async function saveMessageToFirestore(userId, message, conversationId) {
    try {
        const now = new Date();
        const messageData = {
            content: message,
            role: 'user',
            timestamp: now
        };

        const userChatRef = chatManager.chatsCollection.doc(userId);
        const conversationRef = userChatRef.collection('conversations').doc(conversationId);
        
        const conversationDoc = await conversationRef.get();
        let messages = [];
        
        if (conversationDoc.exists) {
            messages = conversationDoc.data().messages || [];
        } else {
            // Si es una nueva conversación, crear el documento con título inicial
            await conversationRef.set({
                title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
                createdAt: now,
                lastUpdated: now,
                messages: []
            });
        }
        
        messages.push(messageData);
        
        await conversationRef.set({
            lastUpdated: now,
            messages: messages
        }, { merge: true });

        return true;
    } catch (error) {
        console.error('Error al guardar mensaje en Firestore:', error);
        throw error;
    }
}

async function saveAssistantMessageToFirestore(userId, message, conversationId) {
    try {
        const now = new Date();
        const messageData = {
            content: message,
            role: 'assistant',
            timestamp: now
        };

        const userChatRef = chatManager.chatsCollection.doc(userId);
        const conversationRef = userChatRef.collection('conversations').doc(conversationId);
        
        const conversationDoc = await conversationRef.get();
        let messages = [];
        
        if (conversationDoc.exists) {
            messages = conversationDoc.data().messages || [];
        }
        
        messages.push(messageData);
        
        await conversationRef.set({
            lastUpdated: now,
            messages: messages
        }, { merge: true });

        return true;
    } catch (error) {
        console.error('Error al guardar mensaje del asistente en Firestore:', error);
        throw error;
    }
}

async function processQuery({ message, userId, conversationId }) {
    try {
        console.log('Mensaje:', { role: 'user', content: message });
        
        // Obtener el historial de la conversación
        const conversationHistory = await getConversationHistory(userId, conversationId);
        
        // Construir el contexto con el historial
        const contextMessages = conversationHistory.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
        
        // Obtener información relevante del mapaERP para la consulta
        const mapaERPInfo = obtenerContenidoMapaERP(message);
        
        const messages = [
            {
                role: "system",
                content: promptBase + "\n\n" + mapaERPInfo + "\n\nIMPORTANTE: \n1. NUNCA uses SELECT * en tus consultas SQL.\n2. SIEMPRE especifica las columnas exactas que necesitas de la tabla.\n3. Usa SOLO los nombres de columnas definidos en mapaERPEmployee.js.\n4. Las tablas y columnas disponibles son las que se muestran arriba.\n5. Si no estás seguro de qué columnas usar, usa las columnas principales de la tabla."
            },
            ...contextMessages,
            {
                role: "user",
                content: message
            }
        ];

        console.log('🤖 Modelo 2: Procesando consulta y generando SQL con gpt-4-turbo-preview');
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: messages,
            temperature: 0.7,
            max_tokens: 800
        });

        const response = completion.choices[0].message.content;
        console.log('Respuesta del asistente:', response);

        // --- MEJORA: Permitir múltiples consultas SQL, sin eliminar nada de la lógica original ---
        // Buscar todos los bloques SQL en la respuesta del modelo
        const sqlBlocks = [...response.matchAll(/```sql[\s\S]*?(SELECT[\s\S]*?;)[\s\S]*?```/gim)].map(m => m[1]);
        let queries = sqlBlocks.length > 0 ? sqlBlocks : [];
        if (queries.length === 0) {
            const singleSql = validarRespuestaSQL(response);
            if (singleSql) queries.push(singleSql);
        }
        if (queries.length > 1) {
            console.log('🚀 Ambos modelos utilizados: Múltiples consultas SQL detectadas');
            let allResults = [];
            for (const sql of queries) {
                try {
                    validarTablaEnMapaERP(sql);
                    const tabla = sql.match(/FROM\s+`?(\w+)`?/i)?.[1];
                    if (tabla) {
                        validarColumnasEnMapaERP(sql, tabla);
                    }
                    const results = await executeQuery(sql);
                    if (results && results.length > 0) {
                        allResults = allResults.concat(results);
                    }
                } catch (err) {
                    console.warn('Error ejecutando consulta:', sql, err);
                }
            }
            if (allResults.length === 0) {
                return {
                    success: true,
                    data: {
                        message: "No encontré información que coincida con tu consulta. ¿Quieres que busque algo similar, o puedes darme más detalles para afinar la búsqueda?"
                    }
                };
            }
            // Formatear la respuesta final con los resultados combinados
            const finalResponse = await formatFinalResponse(allResults, message);
            return {
                success: true,
                data: {
                    message: finalResponse
                }
            };
        } else if (queries.length === 1) {
            // Mantener el flujo original para una sola consulta
            const sql = queries[0];
            validarTablaEnMapaERP(sql);
            const tabla = sql.match(/FROM\s+`?(\w+)`?/i)?.[1];
            if (tabla) {
                validarColumnasEnMapaERP(sql, tabla);
            }
            const results = await executeQuery(sql);
            if (!results || results.length === 0) {
                return {
                    success: true,
                    data: {
                        message: "No encontré información que coincida con tu consulta. ¿Quieres que busque algo similar, o puedes darme más detalles para afinar la búsqueda?"
                    }
                };
            }
            const finalResponse = await formatFinalResponse(results, message);
            return {
                success: true,
                data: {
                    message: finalResponse
                }
            };
        }

        return {
            success: true,
            data: {
                message: response
            }
        };
    } catch (error) {
        console.error('Error en processQuery:', error);
        return {
            success: false,
            data: {
                message: `Lo siento, ha ocurrido un error al procesar tu consulta: ${error.message}. Por favor, intenta reformular tu pregunta o contacta con soporte si el problema persiste.`
            }
        };
    }
}

module.exports = {
    processQuery
}; 