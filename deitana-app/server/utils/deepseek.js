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

async function getDeepSeekResponse(prompt, context) {
  try {
    if (!DEEPSEEK_API_KEY) {
      throw new Error('API key no configurada');
    }

    const messages = [
      { role: "system", content: prompt },
      { role: "user", content: context }
    ];

    const response = await axios.post(DEEPSEEK_API_URL, {
      model: "deepseek-chat",
      messages: messages,
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





async function processMessage(userMessage) {
  try {
    // ... saludos y preguntas generales ...

    // Usar promptBase para generar el prompt
    const { system, user } = promptBase(userMessage);

    // Generar la respuesta usando la IA con el prompt base
    const respuesta = await getDeepSeekResponse(system, user);

    if (!respuesta) throw new Error('No se pudo obtener una respuesta de la IA');

    // 1. Buscar si la respuesta contiene una consulta SQL
    const sqlMatch = respuesta.match(/SELECT[\s\S]+?;/i);
    if (sqlMatch) {
      const sql = sqlMatch[0];

      try {
        // 2. Ejecutar la consulta en la base de datos
        const [rows] = await db.query(sql);

        // 3. Formatear los resultados usando mapaERP
        const tableMatch = sql.match(/FROM\s+(\w+)/i);
        let tabla = tableMatch ? tableMatch[1] : null;
        let columnas = tabla && mapaERP[tabla] ? mapaERP[tabla].columnas : {};

        let respuestaFormateada = rows.map((registro, idx) => {
          let texto = `**Registro ${idx + 1}:**\n`;
          for (let campo in registro) {
            let nombreCampo = columnas && columnas[campo] ? columnas[campo] : campo;
            texto += `**${nombreCampo}:** ${registro[campo]}\n`;
          }
          texto += '\n'; // Espacio entre registros
          return texto;
        }).join('\n');

        return {
          message: respuestaFormateada,
          context: assistantContext
        };
      } catch (sqlError) {
        console.error('Error ejecutando SQL:', sqlError);
        return {
          message: 'La consulta generada no pudo ejecutarse en la base de datos. Por favor, intenta con otra pregunta.',
          context: assistantContext
        };
      }
    }

    // Si no hay SQL, devolver la respuesta de la IA
    return {
      message: respuesta,
      context: assistantContext
    };

  } catch (error) {
    console.error('Error en processMessage:', error);
    return {
      message: 'Lo siento, ha ocurrido un error al procesar tu consulta.',
      context: assistantContext
    };
  }
}

module.exports = {
  processMessage
};