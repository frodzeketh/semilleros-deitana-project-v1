const axios = require('axios');
const db = require('../db');
const { mapaERP } = require('../mapaERP');
const { promptBase } = require('../promptBase');
const mysql = require('mysql2/promise');
const { OpenAI } = require('openai');
const { procesarConsulta } = require('./semanticProcessor');
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

    // Verificar que messages sea un array y tenga al menos un elemento
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages debe ser un array no vacío');
    }

    // Verificar que el primer mensaje tenga contenido
    const systemMessage = messages[0];
    if (!systemMessage || !systemMessage.content) {
      throw new Error('El mensaje del sistema no puede ser null o vacío');
    }

    const systemContent = systemMessage.content;
    
    // Si el contenido es muy grande, dividirlo en partes
    if (systemContent.length > 8000) {
      // Dividir el contenido en dos partes aproximadamente iguales
      const mitad = Math.floor(systemContent.length / 2);
      const primeraParte = systemContent.substring(0, mitad);
      const segundaParte = systemContent.substring(mitad);

      // Primera llamada con la primera parte
      const response1 = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: primeraParte },
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

      // Segunda llamada con la segunda parte
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

    // Si el contenido no es muy grande, hacer una sola llamada
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
    console.log('Procesando mensaje:', userMessage);

    // Primero verificar si es un saludo o pregunta general
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

    // Procesar la consulta para encontrar la tabla relevante
    console.log('Analizando consulta para encontrar tabla relevante...');
    const tablaRelevante = procesarConsulta(userMessage);
    
    if (tablaRelevante) {
      console.log('Tabla relevante encontrada:', tablaRelevante.tabla);
      console.log('Descripción:', tablaRelevante.descripcion);
    } else {
      console.log('No se encontró una tabla relevante para la consulta');
    }

    // Paso 1: IA genera la respuesta
    console.log('Generando respuesta...');
    const { system } = promptBase(userMessage, tablaRelevante);
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

    // Verificar si la respuesta contiene una consulta SQL
    const sqlMatch = respuestaIA.match(/```sql\s*([\s\S]+?)\s*```|SELECT[\s\S]+?;/i);
    
    if (sqlMatch) {
      // Si hay SQL, ejecutar la consulta
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
        
        Para todas las listas de datos:
        
        - Antes de la lista, incluye un mensaje breve y amigable adaptado al tipo de dato
        - Usa negrita SOLO para el nombre o etiqueta principal del elemento
        - La información relacionada va en la misma línea o máximo en dos líneas
        - No agregues líneas vacías entre elementos
        - No repitas información ni uses formatos diferentes para el mismo tipo
        - Al final de la respuesta, incluye UNA recomendación o sugerencia breve relacionada con la consulta, si aplica
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
      } catch (error) {
        console.error('Error al ejecutar la consulta SQL:', error);
        return {
          message: "Lo siento, hubo un error al consultar la base de datos. Por favor, intenta reformular tu pregunta.",
          context: assistantContext
        };
      }
    } else {
      // Si no hay SQL, usar la respuesta directa de la IA
      assistantContext.conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: respuestaIA }
      );

      return {
        message: respuestaIA,
        context: assistantContext
      };
    }
  } catch (error) {
    console.error('Error en processMessage:', error);
    return {
      message: "Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.",
      context: assistantContext
    };
  }
}

module.exports = {
  processMessage
};