const axios = require('axios');
const db = require('../db');
const { processAccionesComercialesMessage } = require('./accionescomercialesclientes');
const { processProveedoresMessage } = require('./proveedores');
const { processBandejasMessage } = require('./bandejas');
const { processCasasComercialesMessage } = require('./casascomerciales');
const { processClientesMessage } = require('./clientes');
const { processVendedoresMessage } = require('./vendedores');
const { processArticulosMessage } = require('./articulos');

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
  lastIndex: 0,
  lastCreditoCaucion: null,
  lastAccionComercial: null,
  lastAccionesComerciales: [],
  lastArticulo: null,
  lastArticulos: [],
  isFirstMessage: true
};

async function getDeepSeekResponse(prompt, context) {
  try {
    if (!DEEPSEEK_API_KEY) {
      throw new Error('API key no configurada');
    }

    const messages = [
      {
        role: "system",
        content: "Eres un asistente virtual de Semilleros Deitana S.L., una empresa española con más de 30 años de experiencia en la propagación de plantas. Tu función es enrutar las consultas a los módulos específicos y proporcionar respuestas amables cuando no se entienda la consulta."
      }
    ];

    // Agregar historial de conversación si existe
    if (context.conversationHistory.length > 0) {
      messages.push(...context.conversationHistory);
    }

    messages.push({
      role: "user",
      content: prompt
    });

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

// Función para detectar referencias a consultas anteriores
function detectarReferenciaAnterior(message) {
  const messageLower = message.toLowerCase();
  const referencias = {
    'anterior': 1,
    'anteúltimo': 1,
    'anteultimo': 1,
    'penúltimo': 1,
    'penultimo': 1,
    'último': 0,
    'ultimo': 0,
    'siguiente': -1,
    'próximo': -1,
    'proximo': -1,
    'otro': 0,
    'otra': 0,
    'más': 0,
    'mas': 0,
    'nuevo': 0,
    'nueva': 0
  };

  for (const [key, value] of Object.entries(referencias)) {
    if (messageLower.includes(key)) {
      return value;
    }
  }
  return null;
}

// Función principal para procesar mensajes
async function processMessage(userMessage) {
  try {
    console.log('Procesando mensaje en deepseek.js:', userMessage);
    const messageLower = userMessage.toLowerCase();

    // Detectar si es un saludo o mensaje inicial
    if (messageLower.match(/^(hola|buenos días|buenas tardes|buenas noches|hey|hi|hello)/i) && assistantContext.isFirstMessage) {
      const prompt = `El usuario ha iniciado la conversación con: "${userMessage}". 
      Por favor, proporciona una respuesta cálida y profesional, presentándote como un asistente virtual de Semilleros Deitana S.L. 
      y sugiriendo amablemente las áreas sobre las que puedes ayudar.`;
      
      const aiResponse = await getDeepSeekResponse(prompt, assistantContext);
      if (!aiResponse) {
        throw new Error('No se pudo obtener respuesta de la IA');
      }
      
      assistantContext.isFirstMessage = false;
      assistantContext.conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: aiResponse }
      );
      
      return {
        message: aiResponse,
        context: assistantContext
      };
    }

    // Detectar referencias a consultas anteriores
    const referencia = detectarReferenciaAnterior(messageLower);
    if (referencia !== null) {
      // Si la última consulta fue sobre artículos
      if (assistantContext.currentTopic === 'articulos') {
        if (messageLower.includes('ejemplo') || 
            messageLower.includes('muestra') ||
            messageLower.includes('muéstrame') ||
            messageLower.includes('otro') ||
            messageLower.includes('otra') ||
            messageLower.includes('más') ||
            messageLower.includes('mas') ||
            messageLower.includes('nuevo') ||
            messageLower.includes('nueva')) {
          const result = await processArticulosMessage('muéstrame otro artículo');
          
          // Actualizar el contexto
          if (result.data) {
            if (Array.isArray(result.data)) {
              assistantContext.lastArticulos = result.data.map(art => art.id);
            } else {
              assistantContext.lastArticulo = result.data.id;
              assistantContext.lastArticulos.push(result.data.id);
            }
          }
          
          assistantContext.conversationHistory.push(
            { role: "user", content: userMessage },
            { role: "assistant", content: result.message }
          );
          
          return {
            message: result.message,
            context: assistantContext
          };
        }
      }
      
      // Si la última consulta fue sobre acciones comerciales
      if (assistantContext.lastAccionesComerciales.length > 0) {
        const index = assistantContext.lastAccionesComerciales.length - 1 + referencia;
        if (index >= 0 && index < assistantContext.lastAccionesComerciales.length) {
          const result = await processAccionesComercialesMessage(
            `Mostrar la acción comercial con ID ${assistantContext.lastAccionesComerciales[index]}`
          );
          return {
            message: result.message,
            context: assistantContext
          };
        }
      }
    }

    // Detección del tipo de consulta y enrutamiento
    if (messageLower.includes('artículo') || 
        messageLower.includes('articulo') ||
        messageLower.includes('artículos') ||
        messageLower.includes('articulos') ||
        messageLower.includes('producto') ||
        messageLower.includes('productos') ||
        messageLower.includes('inventario') ||
        messageLower.includes('stock') ||
        messageLower.includes('catalogo') ||
        messageLower.includes('catálogo') ||
        messageLower.includes('variedad') ||
        messageLower.includes('variedades') ||
        messageLower.includes('semilla') ||
        messageLower.includes('semillas') ||
        messageLower.includes('esqueje') ||
        messageLower.includes('esquejes') ||
        messageLower.includes('planta') ||
        messageLower.includes('plantas')) {
      
      const result = await processArticulosMessage(userMessage);
      
      // Actualizar el contexto con el último artículo consultado
      if (result.data) {
        if (Array.isArray(result.data)) {
          assistantContext.lastArticulos = result.data.map(art => art.id);
        } else {
          assistantContext.lastArticulo = result.data.id;
          assistantContext.lastArticulos.push(result.data.id);
        }
      }
      
      // Actualizar el tema actual
      assistantContext.currentTopic = 'articulos';
      
      assistantContext.conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: result.message }
      );
      
      return {
        message: result.message,
        context: assistantContext
      };
    } else if (messageLower.includes('acciones comerciales') || 
               messageLower.includes('acciones realizadas') ||
               messageLower.includes('interacciones con clientes') ||
               messageLower.includes('gestiones comerciales') ||
               messageLower.includes('ejemplo de accion') ||
               messageLower.includes('ejemplo de acción') ||
               messageLower.includes('incidencia') ||
               messageLower.includes('observación') ||
               messageLower.includes('grave') ||
               messageLower.includes('accion comercial') ||
               messageLower.includes('acción comercial') ||
               messageLower.includes('última') ||
               messageLower.includes('ultima') ||
               messageLower.includes('anteúltima') ||
               messageLower.includes('anteultima') ||
               messageLower.includes('penúltima') ||
               messageLower.includes('penultima') ||
               messageLower.includes('anterior')) {
      
      const result = await processAccionesComercialesMessage(userMessage);
      
      // Actualizar el contexto con la última acción comercial
      if (result.contextType === 'ultima_accion' && result.data) {
        assistantContext.lastAccionComercial = result.data.id;
        assistantContext.lastAccionesComerciales.push(result.data.id);
      }
      
      // Actualizar el tema actual
      assistantContext.currentTopic = 'acciones_comerciales';
      
      assistantContext.conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: result.message }
      );
      
      return {
        message: result.message,
        context: assistantContext
      };
    } else if (messageLower.includes('proveedor') || messageLower.includes('proveedores')) {
      const result = await processProveedoresMessage(userMessage);
      assistantContext.conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: result.message }
      );
      return {
        message: result.message,
        context: assistantContext
      };
    } else if (messageLower.includes('bandeja') || messageLower.includes('bandejas')) {
      const result = await processBandejasMessage(userMessage);
      assistantContext.conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: result.message }
      );
      return {
        message: result.message,
        context: assistantContext
      };
    } else if (messageLower.includes('casa') && messageLower.includes('comercial')) {
      const result = await processCasasComercialesMessage(userMessage);
      assistantContext.conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: result.message }
      );
      return {
        message: result.message,
        context: assistantContext
      };
    } else if (messageLower.includes('cliente') || messageLower.includes('clientes')) {
      const result = await processClientesMessage(userMessage);
      assistantContext.conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: result.message }
      );
      return {
        message: result.message,
        context: assistantContext
      };
    } else if (messageLower.includes('vendedor') || messageLower.includes('vendedores')) {
      const result = await processVendedoresMessage(userMessage);
      assistantContext.conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: result.message }
      );
      return {
        message: result.message,
        context: assistantContext
      };
    } else {
      // Manejo de conversación general con IA
      const prompt = `El usuario ha enviado el mensaje: "${userMessage}", pero no se ha detectado una consulta específica 
      sobre las áreas que manejo. Por favor, proporciona una respuesta amable y profesional que:
      1. Indique que no se ha entendido completamente la consulta
      2. Sugiera las áreas sobre las que puedes ayudar
      3. Ofrezca ejemplos de consultas que podrías responder
      4. Mantenga un tono amigable y de ayuda`;
      
      const aiResponse = await getDeepSeekResponse(prompt, assistantContext);
      if (!aiResponse) {
        throw new Error('No se pudo obtener respuesta de la IA');
      }
      
    assistantContext.conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: aiResponse }
    );

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