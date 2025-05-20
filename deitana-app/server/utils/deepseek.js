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
    isFirstMessage: true
};

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

        // 1. Verificación de saludos y preguntas generales
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

        // 2. NUEVO: Verificación de preguntas ambiguas
        const esPreguntaAmbigua = userMessage.toLowerCase().match(/^(tiene|cuál es|dónde está|dónde se|hay|existe|muestra|busca|encuentra|dime|mostrar|buscar|encontrar)/i);
        
        if (esPreguntaAmbigua) {
            const prompt = `Eres un asistente virtual especializado en la base de datos de Semilleros Deitana.
            
            El usuario ha preguntado: "${userMessage}"
            
            Esta pregunta es ambigua porque no especifica el contexto.
            Analiza la pregunta y sugiere cómo reformularla para obtener la información deseada.
            Mantén un tono profesional pero amigable.`;

            const respuesta = await getOpenAIResponse([{ role: "system", content: prompt }]);
            
            assistantContext.conversationHistory.push(
                { role: "user", content: userMessage },
                { role: "assistant", content: respuesta }
            );

            return {
                message: respuesta,
                context: assistantContext
            };
        }

        // 3. Flujo normal para preguntas con contexto
        console.log('Generando prompt base...');
        const { system } = promptBase(userMessage);
        
        // Generar la consulta SQL
        console.log('Generando consulta SQL...');
        const messages = [
            { role: "system", content: system },
            ...assistantContext.conversationHistory.slice(-3),
            { role: "user", content: userMessage }
        ];
        
        const respuestaIA = await getOpenAIResponse(messages);
        console.log('Respuesta de IA recibida:', respuestaIA);

        if (!respuestaIA) {
            throw new Error('No se recibió respuesta de OpenAI');
        }

        // Extrae la consulta SQL de la respuesta de la IA
        const sqlMatch = respuestaIA.match(/```sql\s*([\s\S]+?)\s*```|SELECT[\s\S]+?;/i);
        if (sqlMatch) {
            const sql = sqlMatch[1] || sqlMatch[0];
            console.log('Consulta SQL generada:', sql);

            try {
                console.log('Ejecutando consulta SQL...');
                const [rows] = await db.query(sql);
                console.log('Resultados de la consulta:', rows);

                const datosReales = rows.length === 0
                    ? "No se encontraron resultados en la base de datos."
                    : JSON.stringify(rows, null, 2);

                const promptAnalisis = `
                Usuario preguntó: ${userMessage}
                Datos reales de la base de datos:
                ${datosReales}
                
                IMPORTANTE: Eres un asistente especializado de Semilleros Deitana S.L., una empresa líder en producción de plantel hortícola.

                REGLAS PARA MOSTRAR RESULTADOS:
                1. NUNCA uses los nombres crudos de las columnas (ej: ACCO_DENO, ACCO_FEC)
                2. Usa nombres técnicos y profesionales:
                   - ACCO_DENO → Tipo de Acción
                   - ACCO_FEC → Fecha
                   - ACCO_HOR → Hora
                   - CL_DENO → Cliente
                   - USU_NOMB → Vendedor
                   - ACCO_OBS → Observación

                3. Para productos y variedades:
                   
                  

                4. Para bandejas y materiales:
                   - Enfócate en especificaciones técnicas
                   - Menciona capacidad y dimensiones
                   - Destaca características de durabilidad
                   - Incluye recomendaciones de uso

                5. Formato de presentación:
                   - Usa un tono profesional y técnico
                   - No inventes información, solo usa la que está en la base de datos

                6. Al final de la respuesta:
                   - Incluye una recomendación técnica relevante
                   - Sugiere aspectos a considerar para el cultivo
                `;

                console.log('Generando análisis de respuesta...');
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
            } catch (sqlError) {
                console.error('Error en SQL:', sqlError);
                return {
                    message: `Error en la consulta: ${sqlError.message}. Por favor, intenta reformular tu pregunta.`,
                    context: assistantContext
                };
            }
        } else {
            console.log('No se encontró consulta SQL en la respuesta:', respuestaIA);
            return {
                message: "No pude generar una consulta válida para tu pregunta. Por favor, intenta reformularla.",
                context: assistantContext
            };
        }
    } catch (error) {
        console.error('Error en processMessage:', error);
        return {
            message: 'Hubo un problema al procesar tu consulta. Por favor, intenta de nuevo.',
            context: assistantContext
        };
    }
}

module.exports = {
    processMessage
};