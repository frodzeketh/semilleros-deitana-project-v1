const { OpenAI } = require('openai');
const pool = require('../db');
const chatManager = require('../utils/chatManager');
const admin = require('../firebase-admin');
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
    const esConsultaClientes = /clientes?|cliente|madrid|provincia|zona/i.test(query.toLowerCase());
    
    let tablaDetectada = null;
    if (results.length > 0) {
        const columnasResultado = Object.keys(results[0]);
        tablaDetectada = determinarTabla(columnasResultado);
    }

    const resultadosLimitados = limitarResultados(results, pideCompleto ? 10 : 5, pideAleatorio);
    let datosReales = '';
    
    if (esConsultaClientes) {
        datosReales = '\nInformación de Clientes:\n';
        resultadosLimitados.forEach((cliente, index) => {
            datosReales += `\nCliente ${index + 1}:\n`;
            if (cliente.CL_DENO) datosReales += `Nombre: ${cliente.CL_DENO}\n`;
            if (cliente.CL_DOM) datosReales += `Dirección: ${cliente.CL_DOM}\n`;
            if (cliente.CL_POB) datosReales += `Población: ${cliente.CL_POB}\n`;
            if (cliente.CL_PROV) datosReales += `Provincia: ${cliente.CL_PROV}\n`;
            if (cliente.CL_CDP) datosReales += `Código Postal: ${cliente.CL_CDP}\n`;
            if (cliente.CL_TEL) datosReales += `Teléfono: ${cliente.CL_TEL}\n`;
            if (cliente.CL_ZONA) datosReales += `Zona: ${cliente.CL_ZONA}\n`;
            datosReales += '-------------------\n';
        });
    } else {
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
    }

    const messages = [
        {
            role: "system",
            content: esConsultaClientes ? 
                `Eres un asistente especializado en consultas de clientes de Semilleros Deitana. 
                - Proporciona información clara y concisa sobre los clientes
                - Si se pide información específica (ej: clientes de Madrid), busca en la tabla 'clientes' usando CL_PROV
                - Incluye información relevante como nombre, dirección, teléfono y zona
                - Si no hay resultados, sugiere alternativas o pide más detalles
                - Mantén un tono profesional y servicial` :
                `Eres un asistente ultra inteligente y empático de Semilleros Deitana. Analiza los datos y responde SIEMPRE de forma clara, útil y natural.
                - Si no hay datos, explica la situación y sugiere alternativas.
                - Si la consulta es ambigua, pide más detalles.
                - Si se pide un ejemplo, selecciona uno aleatorio.
                - Explica el significado de los datos y su relevancia.
                - Nunca repitas datos crudos, interpreta y resume.
                - Sé proactivo y guía al usuario para obtener la mejor respuesta posible.
                - Mantén un tono profesional, conversacional y humano.`
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

// Función para guardar mensaje en Firestore
async function saveMessageToFirestore(userId, message) {
    try {
        console.log('Iniciando saveMessageToFirestore...');
        const now = new Date();
        const messageData = {
            content: message,
            role: 'user',
            timestamp: now
        };

        const userChatRef = chatManager.chatsCollection.doc(userId);
        const conversationRef = userChatRef.collection('conversations').doc('employee_conversation');
        
        console.log('Obteniendo documento actual...');
        const conversationDoc = await conversationRef.get();
        let messages = [];
        
        if (conversationDoc.exists) {
            console.log('Documento existente encontrado');
            messages = conversationDoc.data().messages || [];
        } else {
            console.log('Creando nuevo documento de conversación');
        }
        
        console.log('Agregando nuevo mensaje...');
        messages.push(messageData);
        
        console.log('Actualizando documento...');
        await conversationRef.set({
            lastUpdated: now,
            messages: messages
        }, { merge: true });

        console.log('Mensaje guardado exitosamente');
        return true;
    } catch (error) {
        console.error('Error al guardar mensaje en Firestore:', error);
        throw error;
    }
}

async function processQuery({ message, userId }) {
    try {
        console.log('Procesando consulta de empleado:', message);
        
        // Mensajes del sistema para diferentes tipos de consultas
        const systemMessages = {
            clientes: `Eres un asistente especializado en consultas de clientes de Semilleros Deitana. 
            - Proporciona información clara y concisa sobre los clientes
            - Si se pide información específica (ej: clientes de Madrid), genera una consulta SQL usando la tabla 'clientes' y el campo CL_PROV
            - La consulta SQL debe estar entre etiquetas <sql> y </sql>
            - Incluye información relevante como nombre, dirección, teléfono y zona
            - Si no hay resultados, sugiere alternativas o pide más detalles
            - Mantén un tono profesional y servicial
            - IMPORTANTE: SIEMPRE genera una consulta SQL para consultas de clientes`,
            
            default: `Eres un asistente ultra inteligente y empático de Semilleros Deitana. Analiza los datos y responde SIEMPRE de forma clara, útil y natural.
            - Si no hay datos, explica la situación y sugiere alternativas.
            - Si la consulta es ambigua, pide más detalles.
            - Si se pide un ejemplo, selecciona uno aleatorio.
            - Explica el significado de los datos y su relevancia.
            - Nunca repitas datos crudos, interpreta y resume.
            - Sé proactivo y guía al usuario para obtener la mejor respuesta posible.
            - Mantén un tono profesional, conversacional y humano.
            - IMPORTANTE: Para consultas de clientes, SIEMPRE genera una consulta SQL entre etiquetas <sql> y </sql>`
        };

        // Determinar el tipo de consulta
        const esConsultaClientes = /clientes?|cliente|madrid|provincia|zona/i.test(message.toLowerCase());
        const systemMessage = esConsultaClientes ? systemMessages.clientes : systemMessages.default;

        const messages = [
            {
                role: "system",
                content: systemMessage
            },
            {
                role: "user",
                content: message
            }
        ];

        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: messages,
            temperature: 0.7,
            max_tokens: 800
        });

        const response = completion.choices[0].message.content;
        console.log('Respuesta del asistente:', response);

        // Validar y ejecutar consulta SQL si existe
        const sql = validarRespuestaSQL(response);
        if (sql) {
            console.log('Ejecutando consulta SQL:', sql);
            const results = await executeQuery(sql);
            console.log('Resultados de la consulta:', results);
            
            // Formatear la respuesta final con los resultados
            const finalResponse = await formatFinalResponse(results, message);
            return {
                success: true,
                data: {
                    message: finalResponse
                }
            };
        }

        // Si es una consulta de clientes pero no se generó SQL, forzar una consulta por defecto
        if (esConsultaClientes) {
            const defaultSql = `<sql>SELECT CL_DENO, CL_DOM, CL_POB, CL_PROV, CL_CDP, CL_TEL, CL_ZONA 
                               FROM \`clientes\` 
                               WHERE CL_PROV LIKE '%MADRID%' 
                               LIMIT 2</sql>`;
            const sql = validarRespuestaSQL(defaultSql);
            if (sql) {
                console.log('Ejecutando consulta SQL por defecto:', sql);
                const results = await executeQuery(sql);
                console.log('Resultados de la consulta por defecto:', results);
                
                const finalResponse = await formatFinalResponse(results, message);
                return {
                    success: true,
                    data: {
                        message: finalResponse
                    }
                };
            }
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
                message: `Lo siento, ha ocurrido un error al procesar tu consulta. Por favor, intenta reformular tu pregunta o contacta con soporte si el problema persiste.`
            }
        };
    }
}

async function saveAssistantMessageToFirestore(userId, message) {
    try {
        console.log('Iniciando saveAssistantMessageToFirestore...');
        const now = new Date();
        const messageData = {
            content: message,
            role: 'assistant',
            timestamp: now
        };

        const userChatRef = chatManager.chatsCollection.doc(userId);
        const conversationRef = userChatRef.collection('conversations').doc('employee_conversation');
        
        console.log('Obteniendo documento actual...');
        const conversationDoc = await conversationRef.get();
        let messages = [];
        
        if (conversationDoc.exists) {
            console.log('Documento existente encontrado');
            messages = conversationDoc.data().messages || [];
        } else {
            console.log('Creando nuevo documento de conversación');
        }
        
        console.log('Agregando nuevo mensaje...');
        messages.push(messageData);
        
        console.log('Actualizando documento...');
        await conversationRef.set({
            lastUpdated: now,
            messages: messages
        }, { merge: true });

        console.log('Mensaje del asistente guardado exitosamente');
        return true;
    } catch (error) {
        console.error('Error al guardar mensaje del asistente en Firestore:', error);
        throw error;
    }
}

module.exports = {
    processQuery
}; 