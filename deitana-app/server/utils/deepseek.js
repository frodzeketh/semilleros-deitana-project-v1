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

    // Dividir el prompt si es muy grande
    const systemContent = messages[0]?.content || '';
    if (systemContent.length > 12000) {
      // Primera llamada: Generar la consulta SQL
      const firstHalf = systemContent.substring(0, 12000);
      const response1 = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: firstHalf },
          { role: "user", content: messages[messages.length - 1].content }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      // Si la primera respuesta contiene SQL, usarla
      const firstResponse = response1.choices[0].message.content;
      if (firstResponse.includes("SELECT")) {
        return firstResponse;
      }

      // Segunda llamada: Con el resto del contexto
      const secondHalf = systemContent.substring(12000);
      const response2 = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: secondHalf },
          { role: "user", content: messages[messages.length - 1].content }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      return response2.choices[0].message.content;
    }

    // Si el prompt no es muy grande, hacer una sola llamada
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 0.9,
      frequency_penalty: 0.5,
      presence_penalty: 0.5
    });

    if (!response.choices || !response.choices[0]) {
      throw new Error('Respuesta inválida de la API');
    }

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error en getOpenAIResponse:', error);
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

  return await getOpenAIResponse([{ role: "system", content: prompt }]);
}










async function processMessage(userMessage) {
  try {
    // Primero verificar si es un saludo o pregunta general
    if (esSaludo(userMessage) || esPreguntaGeneral(userMessage)) {
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

  
    // Paso 1: IA genera la consulta SQL
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

    // Extrae la consulta SQL de la respuesta de la IA
    const sqlMatch = respuestaIA.match(/```sql\s*([\s\S]+?)\s*```|SELECT[\s\S]+?;/i);
    if (sqlMatch) {
      const sql = sqlMatch[1] || sqlMatch[0];
      try {
        const [rows] = await db.query(sql);

        const datosReales = rows.length === 0
          ? "No se encontraron resultados en la base de datos."
          : JSON.stringify(rows, null, 2);

        const promptAnalisis = `
El usuario preguntó: ${userMessage}
El resultado real de la base de datos es:
${datosReales}
Por favor, analiza estos datos y responde en lenguaje natural, explicando el resultado y sugiriendo acciones si corresponde.
        `;
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