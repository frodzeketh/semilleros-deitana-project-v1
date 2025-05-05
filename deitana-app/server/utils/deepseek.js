const axios = require('axios');
const db = require('../db');
const { mapaERP } = require('../mapaERP');
const { promptBase } = require('../promptBase');
const mysql = require('mysql2/promise'); // Asegúrate de tener mysql2 instalado

// Configuración de la API de DeepSeek
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!DEEPSEEK_API_KEY) {
  console.error('Error: DEEPSEEK_API_KEY no está configurada en las variables de entorno');
}

// Sistema de contexto para el asistente
const assistantContext = {
  currentTopic: null,
  lastQuery: null,
  lastResponse: null,
  conversationHistory: [],
  isFirstMessage: true
};

async function getDeepSeekResponse(messages) {
  try {
    if (!DEEPSEEK_API_KEY) {
      throw new Error('API key no configurada');
    }

    const response = await axios.post(DEEPSEEK_API_URL, {
      model: "deepseek-chat",
      messages: messages, // <-- aquí usas el array recibido
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 0.9,
      frequency_penalty: 0.5,
      presence_penalty: 0.5
    }, {
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      throw new Error('Respuesta inválida de la API');
    }

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error al llamar a la API de DeepSeek:', error.message);
    return null;
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
  const prompt = `Eres un asistente virtual de Semilleros Deitana S.L., especializado en ayudar con consultas sobre la base de datos de la empresa.

  Contexto de la conversación:
  ${JSON.stringify(assistantContext.conversationHistory.slice(-3))}

  El usuario ha dicho: "${mensaje}"

  Proporciona una respuesta natural y conversacional, manteniendo un tono profesional pero amigable.
  Si el usuario necesita información específica de la base de datos, sugiérele que formule su pregunta de manera más específica.
  Si es un saludo o una pregunta general, responde de manera natural sin mencionar la base de datos a menos que sea relevante.`;

  return await getDeepSeekResponse(prompt, mensaje);
}





















    // Usar promptBase para generar el prompt
// ... imports y funciones previas ...

// ... imports y funciones previas ...

async function processMessage(userMessage) {
  try {
    // Paso 1: IA genera la consulta SQL
    const { system } = promptBase(userMessage);
    const messages = [
      { role: "system", content: system },
      ...assistantContext.conversationHistory.slice(-3),
      { role: "user", content: userMessage }
    ];
    const respuestaIA = await getDeepSeekResponse(messages);

    // Extrae la consulta SQL de la respuesta de la IA
    const sqlMatch = respuestaIA.match(/SELECT[\s\S]+?;/i);
    if (sqlMatch) {
      const sql = sqlMatch[0];
      try {
        const [rows] = await db.query(sql);

        // Paso 2: IA analiza los datos reales
        const datosReales = rows.length === 0
          ? "No se encontraron resultados en la base de datos."
          : JSON.stringify(rows, null, 2);

        const promptAnalisis = `
El usuario preguntó: ${userMessage}
El resultado real de la base de datos es:
${datosReales}
Por favor, analiza estos datos y responde en lenguaje natural, explicando el resultado y sugiriendo acciones si corresponde.
        `;
        const analisis = await getDeepSeekResponse([
          { role: "system", content: promptAnalisis }
        ]);

        // Guarda el historial de conversación
        assistantContext.conversationHistory.push(
          { role: "user", content: userMessage },
          { role: "assistant", content: analisis }
        );

        return {
          message: analisis,
          context: assistantContext
        };
      } catch (sqlError) {
        console.error('Error ejecutando SQL:', sqlError);
        return {
          message: 'La consulta generada no pudo ejecutarse en la base de datos. Por favor, intenta con otra pregunta.',
          context: assistantContext
        };
      }
    } else {
      return {
        message: "No he encontrado información real en la base de datos para tu consulta. ¿Quieres intentar con otra pregunta?",
        context: assistantContext
      };
    }
  } catch (error) {
    console.error('Error en processMessage:', error);
    return {
      message: 'Hubo un problema al obtener respuesta.',
      context: assistantContext
    };
  }
}
module.exports = {
  processMessage
};