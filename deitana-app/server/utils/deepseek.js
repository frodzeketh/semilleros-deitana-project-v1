const axios = require('axios');
const db = require('../db');
const { mapaERP } = require('../mapaERP');
const { promptBase } = require('../promptBase');
const mysql = require('mysql2/promise');
const { OpenAI } = require('openai');
require('dotenv').config();

// Configuración de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY no está configurada en las variables de entorno');
}

// Sistema de contexto para el asistente
const assistantContext = {
    currentTopic: null,
    lastQuery: null,
    lastResponse: null,
    conversationHistory: [],
    isFirstMessage: true,
    lastTableContext: null,
    lastQueryType: null, // Agregado para rastrear el tipo de consulta anterior
    lastQueryParams: null // Agregado para rastrear los parámetros de la consulta
};

// Nueva función para mantener el contexto y generar consultas
async function mantenerContextoYGenerarConsulta(userMessage) {
    // Verificar si es una continuación
    if (userMessage.toLowerCase().includes('mas')) {
        if (assistantContext.lastQueryType === 'articulos') {
            // Incrementar el offset para la siguiente consulta
            const offset = (assistantContext.lastQueryParams?.offset || 0) + 2;
            assistantContext.lastQueryParams = { offset };
            
            // Generar consulta SQL completa con todas las columnas relevantes
            const consulta = {
                sql: `SELECT 
                    id, 
                    AR_DENO as denominacion,
                    AR_IVA as tipo_iva,
                    AR_GER as porcentaje_germinacion,
                    AR_PREC as precio_venta,
                    AR_UNI as unidades,
                    AR_STOCK as stock_actual
                FROM articulos 
                ORDER BY id 
                LIMIT ${offset}, 2`,
                tipo: 'articulos'
            };
            
            return {
                tipo: 'continuacion',
                consulta: consulta,
                mensaje: userMessage
            };
        }
        return null;
    }

    // Analizar el tipo de consulta
    const palabrasClave = userMessage.toLowerCase().split(' ');
    
    // Identificar el tipo de consulta basado en palabras clave
    if (palabrasClave.includes('articulos') || palabrasClave.includes('articulo')) {
        assistantContext.lastQueryType = 'articulos';
        assistantContext.lastQueryParams = { offset: 0 };
        
        // Generar consulta inicial con todas las columnas relevantes
        const consulta = {
            sql: `SELECT 
                id, 
                AR_DENO as denominacion,
                AR_IVA as tipo_iva,
                AR_GER as porcentaje_germinacion,
                AR_PREC as precio_venta,
                AR_UNI as unidades,
                AR_STOCK as stock_actual
            FROM articulos 
            ORDER BY id 
            LIMIT 2`,
            tipo: 'articulos'
        };
        
        return {
            tipo: 'nueva_consulta',
            consulta: consulta,
            mensaje: userMessage
        };
    }
    
    return null;
}

async function getOpenAIResponse(messages) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('API key no configurada');
        }

        if (!Array.isArray(messages) || messages.length === 0) {
            throw new Error('Messages debe ser un array no vacío');
        }

        const systemMessage = messages[0];
        if (!systemMessage || !systemMessage.content) {
            throw new Error('El mensaje del sistema no puede ser null o vacío');
        }

        const systemContent = systemMessage.content;
        
        if (systemContent.length > 8000) {
            const mitad = Math.floor(systemContent.length / 2);
            const primeraParte = systemContent.substring(0, mitad);
            const segundaParte = systemContent.substring(mitad);

            const response1 = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: primeraParte },
                    { role: "user", content: messages[messages.length - 1].content }
                ],
                temperature: 0.7,
                max_tokens: 500
            });

            const firstResponse = response1.choices[0].message.content;
            if (firstResponse.includes("SELECT")) {
                return firstResponse;
            }

            const response2 = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: segundaParte },
                    { role: "user", content: messages[messages.length - 1].content }
                ],
                temperature: 0.7,
                max_tokens: 500
            });

            return response2.choices[0].message.content;
        }

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('Error en getOpenAIResponse:', error);
        throw error;
    }
}

function esSaludo(mensaje) {
    const mensajeLower = mensaje.toLowerCase();
    return mensajeLower.match(/^(hola|buenos días|buenas tardes|buenas noches|hey|hi|hello|que tal|qué tal|como estas|cómo estás)/i);
}

function esPreguntaGeneral(mensaje) {
    const mensajeLower = mensaje.toLowerCase();
    return mensajeLower.match(/^(quién eres|quien eres|qué eres|que eres|qué puedes hacer|que puedes hacer|ayuda|help)/i);
}

async function analizarIntencionConsulta(userMessage) {
    const prompt = `Eres un asistente especializado de Semilleros Deitana S.L. 
    Analiza la siguiente consulta y determina qué información necesita el usuario:

    Consulta: "${userMessage}"

    Identifica:
    1. ¿Es una consulta simple o compleja?
    2. ¿Qué elementos menciona? (productos, cantidades, bandejas, etc.)
    3. ¿Qué relaciones necesita establecer?
    4. ¿Qué tipo de respuesta necesita?

    Responde en formato JSON con esta estructura:
    {
        "tipo": "simple|compleja",
        "elementos": ["lista", "de", "elementos"],
        "relaciones": ["lista", "de", "relaciones"],
        "tipo_respuesta": "informacion|recomendacion|analisis"
    }`;

    const respuesta = await getOpenAIResponse([{ role: "system", content: prompt }]);
    return JSON.parse(respuesta);
}

async function generarConsultasNecesarias(analisis) {
    const prompt = `Eres un experto en bases de datos de Semilleros Deitana S.L.
    Genera las consultas SQL necesarias para obtener la información requerida.

    Análisis de la consulta:
    ${JSON.stringify(analisis, null, 2)}

    Genera las consultas SQL necesarias para obtener:
    1. Información principal
    2. Información relacionada
    3. Datos de soporte

    Responde en formato JSON con esta estructura:
    {
        "consultas": [
            {
                "tipo": "principal|relacionada|soporte",
                "sql": "consulta SQL",
                "descripcion": "qué información obtiene"
            }
        ]
    }`;

    const respuesta = await getOpenAIResponse([{ role: "system", content: prompt }]);
    return JSON.parse(respuesta);
}

async function analizarResultados(consultas, resultados, userMessage) {
    const prompt = `Eres un asistente especializado de Semilleros Deitana S.L.
    Analiza los siguientes resultados y genera una respuesta completa.

    Consulta original: "${userMessage}"

    Resultados obtenidos:
    ${JSON.stringify(resultados, null, 2)}

    Genera una respuesta que incluya:
    1. Análisis de los datos
    2. Recomendaciones basadas en los datos reales
    3. Consideraciones técnicas
    4. Sugerencias adicionales

    IMPORTANTE:
    - Usa un tono profesional y técnico
    - Solo usa información real de la base de datos
    - No inventes datos
    - Menciona limitaciones si los datos son insuficientes
    - Proporciona alternativas cuando sea posible`;

    return await getOpenAIResponse([{ role: "system", content: prompt }]);
}

async function generarRespuestaConversacional(mensaje) {
    const prompt = `Eres un asistente virtual especializado de Semilleros Deitana S.L., una empresa española ubicada en Almería especializada en la producción y comercialización de plantas hortícolas para trasplante.

    Contexto de la empresa:
    - Somos especialistas en producción de plantel hortícola
    - Nuestras variedades incluyen tomate, pimiento, pepino, sandía, melón y calabacín
    - Ofrecemos tanto variedades convencionales como injertadas
    - Proporcionamos servicio técnico personalizado a agricultores
    - Garantizamos trazabilidad, sanidad vegetal y uniformidad de las plantas

    Contexto de la conversación:
    ${JSON.stringify(assistantContext.conversationHistory.slice(-3))}

    El usuario ha dicho: "${mensaje}"

    Instrucciones para responder:
    1. SIEMPRE mantén el contexto de que eres un asistente de Semilleros Deitana
    2. Usa un tono profesional pero cercano, como un experto en horticultura
    3. Cuando hables de productos, enfócate en su uso agrícola y características técnicas
    4. NO uses frases genéricas como "disfruta de estas frutas" o "prueba estos sabores"
    5. En su lugar, menciona aspectos relevantes como:
       - Características técnicas de las variedades
       - Recomendaciones de cultivo
       - Épocas de siembra
       - Adaptabilidad a diferentes condiciones
    6. Si el usuario necesita información específica, sugiérele que formule su pregunta de manera más técnica o específica
    7. Si es un saludo o pregunta general, responde manteniendo el contexto de empresa agrícola`;

    return await getOpenAIResponse([{ role: "system", content: prompt }]);
}

async function processMessage(userMessage) {
    try {
        console.log('Procesando mensaje:', userMessage);

        // Verificar si es una continuación o una nueva consulta
        const contexto = await mantenerContextoYGenerarConsulta(userMessage);
        if (contexto) {
            console.log('Mensaje identificado como continuación o nueva consulta');
            
            // Si es una continuación, usar la consulta generada
            if (contexto.tipo === 'continuacion') {
                try {
                    const [rows] = await db.query(contexto.consulta.sql);
                    const datosReales = rows.length === 0
                        ? "No se encontraron resultados en la base de datos."
                        : JSON.stringify(rows, null, 2);

                    const promptAnalisis = `
                    Usuario preguntó: ${userMessage}
                    Datos reales de la base de datos:
                    ${datosReales}
                    
                    IMPORTANTE: Eres un asistente especializado de Semilleros Deitana S.L.
                    Contexto: Continuación de consulta de artículos
                    
                    REGLAS PARA MOSTRAR RESULTADOS:
                    1. NUNCA uses los nombres crudos de las columnas
                    2. Usa nombres técnicos y profesionales
                    3. Enfócate en aspectos técnicos y agrícolas
                    4. No inventes información
                    5. Incluye recomendaciones técnicas relevantes`;

                    const respuestaIA = await getOpenAIResponse([
                        { role: "system", content: promptAnalisis }
                    ]);

                    assistantContext.conversationHistory.push(
                        { role: "user", content: userMessage },
                        { role: "assistant", content: respuestaIA }
                    );

                    return {
                        message: respuestaIA,
                        context: assistantContext
                    };
                } catch (error) {
                    console.error('Error en consulta:', error);
                    return {
                        message: `Error al obtener más artículos: ${error.message}. Por favor, intenta reformular tu pregunta.`,
                        context: assistantContext
                    };
                }
            }
        }

        // Si no es continuación, procesar como consulta normal
        if (esSaludo(userMessage) || esPreguntaGeneral(userMessage)) {
            console.log('Mensaje identificado como saludo o pregunta general');
            const respuestaConversacional = await generarRespuestaConversacional(userMessage);
            
            assistantContext.conversationHistory.push(
                { role: "user", content: userMessage },
                { role: "assistant", content: respuestaConversacional }
            );

            return {
                message: respuestaConversacional,
                context: assistantContext
            };
        }

        // Resto del código existente...
        // 1. Análisis de la intención de la consulta
        console.log('Analizando intención de la consulta...');
        const analisis = await analizarIntencionConsulta(userMessage);
        
        // Si es una consulta simple, usar el flujo normal
        if (analisis.tipo === 'simple') {
            console.log('Mensaje identificado como consulta simple');
            const { system } = promptBase(userMessage);
            
            const messages = [
                { role: "system", content: system },
                ...assistantContext.conversationHistory.slice(-3),
                { role: "user", content: userMessage }
            ];
            
            const respuestaIA = await getOpenAIResponse(messages);
            
            if (!respuestaIA) {
                throw new Error('No se recibió respuesta de OpenAI');
            }

            const sqlMatch = respuestaIA.match(/```sql\s*([\s\S]+?)\s*```|SELECT[\s\S]+?;/i);
            if (sqlMatch) {
                const sql = sqlMatch[1] || sqlMatch[0];
                console.log('Consulta SQL generada:', sql);

                try {
                    const [rows] = await db.query(sql);
                    const datosReales = rows.length === 0
                        ? "No se encontraron resultados en la base de datos."
                        : JSON.stringify(rows, null, 2);

                    const promptAnalisis = `
                    Usuario preguntó: ${userMessage}
                    Datos reales de la base de datos:
                    ${datosReales}
                    
                    IMPORTANTE: Eres un asistente especializado de Semilleros Deitana S.L.

                    REGLAS PARA MOSTRAR RESULTADOS:
                    1. NUNCA uses los nombres crudos de las columnas
                    2. Usa nombres técnicos y profesionales
                    3. Enfócate en aspectos técnicos y agrícolas
                    4. No inventes información
                    5. Incluye recomendaciones técnicas relevantes`;

                    const analisis = await getOpenAIResponse([
                        { role: "system", content: promptAnalisis }
                    ]);

                    assistantContext.conversationHistory.push(
                        { role: "user", content: userMessage },
                        { role: "assistant", content: analisis }
                    );

                    return {
                        message: analisis,
                        context: assistantContext
                    };
                } catch (error) {
                    console.error('Error en SQL:', error);
                    return {
                        message: `Error en la consulta: ${error.message}. Por favor, intenta reformular tu pregunta.`,
                        context: assistantContext
                    };
                }
            }
        }
        
        // 3. Para consultas complejas, usar el nuevo sistema
        console.log('Mensaje identificado como consulta compleja');
        const consultas = await generarConsultasNecesarias(analisis);
        
        // 4. Ejecución de consultas
        console.log('Ejecutando consultas...');
        const resultados = {};
        for (const consulta of consultas.consultas) {
            try {
                const [rows] = await db.query(consulta.sql);
                resultados[consulta.tipo] = rows;
            } catch (error) {
                console.error(`Error en consulta ${consulta.tipo}:`, error);
                resultados[consulta.tipo] = [];
            }
        }

        // 5. Análisis de resultados
        console.log('Analizando resultados...');
        const respuesta = await analizarResultados(consultas, resultados, userMessage);

        // 6. Actualización del contexto
        assistantContext.conversationHistory.push(
            { role: "user", content: userMessage },
            { role: "assistant", content: respuesta }
        );

        return {
            message: respuesta,
            context: assistantContext
        };

    } catch (error) {
        console.error('Error en processMessage:', error);
        return {
            message: 'Hubo un problema al procesar tu consulta. Por favor, intenta reformularla.',
            context: assistantContext
        };
    }
}

module.exports = {
    processMessage
};