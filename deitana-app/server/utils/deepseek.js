const axios = require('axios');
const db = require('../db');
const { processAccionesComercialesMessage } = require('./accionescomercialesclientes');
const { processProveedoresMessage } = require('./proveedores');
const { processBandejasMessage } = require('./bandejas');
const { processCasasComercialesMessage } = require('./casascomerciales');
const { processClientesMessage } = require('./clientes');
const { processVendedoresMessage } = require('./vendedores');

// Configuración de la API de DeepSeek
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!DEEPSEEK_API_KEY) {
  console.error('Error: DEEPSEEK_API_KEY no está configurada en las variables de entorno');
}

async function getDeepSeekResponse(prompt, context) {
  try {
    if (!DEEPSEEK_API_KEY) {
      throw new Error('API key no configurada');
    }

    const messages = [
      {
        role: "system",
        content: "Eres un asistente de DEITANA especializado en información comercial. Debes ser profesional, amigable y preciso en tus respuestas."
      },
      {
        role: "user",
        content: prompt
      }
    ];

    if (context) {
      messages.push({
        role: "system",
        content: `Contexto adicional: ${JSON.stringify(context)}`
      });
    }

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

// Sistema de contexto para el asistente
const assistantContext = {
  currentTopic: null,
  lastQuery: null,
  lastResponse: null,
  conversationHistory: [],
  lastIndex: 0,
  lastCreditoCaucion: null
};

// Función principal para procesar mensajes
async function processMessage(userMessage) {
  try {
    console.log('Procesando mensaje en deepseek.js:', userMessage);
    const messageLower = userMessage.toLowerCase();

    // Detectar si es un saludo o mensaje inicial
    if (messageLower.match(/^(hola|buenos días|buenas tardes|buenas noches|hey|hi|hello)/i)) {
      const prompt = `El usuario ha iniciado la conversación con: "${userMessage}". 
      Por favor, proporciona una respuesta cálida y profesional, presentándote como un asistente de DEITANA 
      especializado en información comercial y sugiriendo amablemente las áreas sobre las que puedes ayudar.
      La respuesta debe ser natural y conversacional, como si estuvieras hablando con un colega.`;
      
      const aiResponse = await getDeepSeekResponse(prompt, null);
      if (!aiResponse) {
        throw new Error('No se pudo obtener respuesta de la IA');
      }
      return {
        message: aiResponse,
        context: assistantContext
      };
    }

    // Detección del tipo de consulta y enrutamiento
    if (messageLower.includes('acciones comerciales') || 
        messageLower.includes('acciones realizadas') ||
        messageLower.includes('interacciones con clientes') ||
        messageLower.includes('gestiones comerciales') ||
        messageLower.includes('ejemplo de accion') ||
        messageLower.includes('ejemplo de acción')) {
      
      const result = await processAccionesComercialesMessage(userMessage);
      return {
        message: result.message,
        context: assistantContext
      };
    } else if (messageLower.includes('proveedor') || messageLower.includes('proveedores')) {
      const result = await processProveedoresMessage(userMessage);
      return {
        message: result.message,
        context: assistantContext
      };
    } else if (messageLower.includes('bandeja') || messageLower.includes('bandejas')) {
      const result = await processBandejasMessage(userMessage);
      return {
        message: result.message,
        context: assistantContext
      };
    } else if (messageLower.includes('casa') && messageLower.includes('comercial')) {
      const result = await processCasasComercialesMessage(userMessage);
      return {
        message: result.message,
        context: assistantContext
      };
    } else if (messageLower.includes('cliente') || messageLower.includes('clientes')) {
      const result = await processClientesMessage(userMessage);
      return {
        message: result.message,
        context: assistantContext
      };
    } else if (messageLower.includes('vendedor') || messageLower.includes('vendedores')) {
      const result = await processVendedoresMessage(userMessage);
      return {
        message: result.message,
        context: assistantContext
      };
    } else {
      // Manejo de conversación general con IA
      const prompt = `El usuario ha enviado el mensaje: "${userMessage}", pero no se ha detectado una consulta específica 
      sobre las áreas que manejo (acciones comerciales, proveedores, bandejas, casas comerciales, clientes o vendedores).
      Por favor, proporciona una respuesta amable y profesional que:
      1. Indique que no se ha entendido completamente la consulta
      2. Sugiera las áreas sobre las que puedes ayudar
      3. Ofrezca ejemplos de consultas que podrías responder
      4. Mantenga un tono amigable y de ayuda
      La respuesta debe ser natural y conversacional, como si estuvieras hablando con un colega.`;
      
      const aiResponse = await getDeepSeekResponse(prompt, null);
      if (!aiResponse) {
        throw new Error('No se pudo obtener respuesta de la IA');
      }
      return {
        message: aiResponse,
        context: assistantContext
      };
    }
  } catch (error) {
    console.error('Error en processMessage:', error);
    return {
      message: "Lo siento, estoy teniendo problemas para procesar tu consulta en este momento. Por favor, intenta de nuevo más tarde.",
      context: assistantContext
    };
  }
}

module.exports = {
  processMessage
};