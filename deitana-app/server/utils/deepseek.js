const axios = require('axios');
const db = require('../db');
const { mapaERP } = require('../mapaERP');
const { determinarTipoPrompt } = require('../promptBase');

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

async function ejecutarConsultaSQL(consulta) {
  try {
    const [rows] = await db.query(consulta);
    return rows;
  } catch (error) {
    console.error('Error al ejecutar la consulta SQL:', error);
    throw error;
  }
}

async function formatearRespuesta(resultados, userMessage) {
  if (!resultados || resultados.length === 0) {
    return "No encontré registros que coincidan con tu búsqueda.";
  }

  // Si es una consulta de conteo total
  if (userMessage.toLowerCase().includes('total') || 
      userMessage.toLowerCase().includes('cuántos') || 
      userMessage.toLowerCase().includes('cuantos')) {
    return `En total hay ${resultados.length} registros que coinciden con tu búsqueda.`;
  }

  // Para otros tipos de consultas
  let respuesta = "Aquí tienes los resultados de tu búsqueda:\n\n";
  
  resultados.forEach((registro, index) => {
    respuesta += `Registro ${index + 1}:\n`;
    respuesta += `----------------------------\n`;
    
    // Mostrar todos los campos del registro
    Object.entries(registro).forEach(([campo, valor]) => {
      if (valor !== null && valor !== undefined) {
        respuesta += `${campo}: ${valor}\n`;
      }
    });
    
    respuesta += `----------------------------\n\n`;
  });

  return respuesta;
}

// Función principal para procesar mensajes
async function processMessage(userMessage) {
  try {
    console.log('Procesando mensaje en deepseek.js:', userMessage);

    // Determinar el tipo de mensaje
    if (esSaludo(userMessage) && assistantContext.isFirstMessage) {
      const respuesta = await generarRespuestaConversacional(userMessage);
      assistantContext.isFirstMessage = false;
      assistantContext.conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: respuesta }
      );
      return {
        message: respuesta,
        context: assistantContext
      };
    }

    if (esPreguntaGeneral(userMessage)) {
      const respuesta = await generarRespuestaConversacional(userMessage);
      assistantContext.conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: respuesta }
      );
      return {
        message: respuesta,
        context: assistantContext
      };
    }

    // Generar la consulta SQL usando la IA
    const prompt = `Eres un experto en SQL y análisis de datos. Tu tarea es generar una consulta SQL válida basada en la siguiente pregunta del usuario y el esquema de la base de datos.

    Pregunta del usuario: "${userMessage}"

    Esquema de la base de datos:
    ${JSON.stringify(mapaERP, null, 2)}

    Reglas:
    1. Genera SOLO la consulta SQL, sin explicaciones adicionales
    2. Usa solo las tablas y campos definidos en el esquema
    3. Incluye todas las condiciones necesarias para responder la pregunta
    4. Usa LIMIT cuando se solicite un número específico de registros
    5. Para búsquedas de texto, usa LIKE con comodines (%)
    6. Para consultas que involucran múltiples tablas, usa JOINs apropiados
    7. Para observaciones en acciones_com_acco_not, recuerda que pueden estar divididas en múltiples registros

    La respuesta debe ser SOLO la consulta SQL, sin ningún texto adicional.`;

    const consultaSQL = await getDeepSeekResponse(prompt, userMessage);
    
    if (!consultaSQL) {
      const respuesta = await generarRespuestaConversacional(userMessage);
      assistantContext.conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: respuesta }
      );
      return {
        message: respuesta,
        context: assistantContext
      };
    }

    console.log('Consulta SQL generada:', consultaSQL);
    const resultados = await ejecutarConsultaSQL(consultaSQL);
    console.log('Resultados de la consulta:', resultados);
    
    const respuestaFormateada = await formatearRespuesta(resultados, userMessage);

    // Actualizar el contexto
    assistantContext.lastQuery = userMessage;
    assistantContext.lastResponse = respuestaFormateada;
    assistantContext.conversationHistory.push(
      { role: "user", content: userMessage },
      { role: "assistant", content: respuestaFormateada }
    );

    return {
      message: respuestaFormateada,
      context: assistantContext
    };

  } catch (error) {
    console.error('Error en processMessage:', error);
    return {
      message: "Lo siento, he tenido un problema al procesar tu consulta. Por favor, intenta de nuevo más tarde.",
      context: assistantContext
    };
  }
}

module.exports = {
  processMessage
};