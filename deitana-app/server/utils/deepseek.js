const axios = require('axios');
const db = require('../db');
const { processAccionesComercialesMessage } = require('./accionescomercialesclientes');
const { processProveedoresMessage } = require('./proveedores');
const { processBandejasMessage } = require('./bandejas');
const { processCasasComercialesMessage } = require('./casascomerciales');
const { processClientesMessage } = require('./clientes');
const { processVendedoresMessage } = require('./vendedores');
const { processArticulosMessage } = require('./articulos');
const { processCreditosCaucionMessage } = require('./creditocaucion');

// Configuración de la API de DeepSeek
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!DEEPSEEK_API_KEY) {
  console.error('Error: DEEPSEEK_API_KEY no está configurada en las variables de entorno');
}

// Prompt base para la IA
const SYSTEM_PROMPT = `Eres un asistente virtual de Semilleros Deitana S.L., especializado en analizar consultas y derivarlas al módulo correspondiente.

Tu Objetivo Principal: Analizar la consulta del usuario y determinar a qué módulo debe ser derivada, basándote en:
1. El contexto de la conversación
2. El tema actual
3. La intención de la consulta

Módulos Disponibles:
1. Artículos: Consultas sobre productos, inventario, catálogo, semillas, plantas, etc.
2. Acciones Comerciales: Consultas sobre interacciones con clientes, incidencias, observaciones, etc.
3. Proveedores: Consultas sobre suministradores, compras, etc.
4. Clientes: Consultas sobre clientes, pedidos, etc.
5. Vendedores: Consultas sobre el equipo comercial, etc.
6. Bandejas: Consultas sobre contenedores, etc.
7. Casas Comerciales: Consultas sobre distribuidores, etc.
8. Créditos Caución: Consultas sobre seguros de crédito, pólizas y garantías.

Proceso de Análisis:
1. Lee la consulta del usuario
2. Analiza el contexto de la conversación
3. Identifica el tema principal
4. Determina el módulo más apropiado
5. Deriva la consulta al módulo correspondiente

Ejemplos de Derivación:
- "¿Cuántos artículos tenemos?" → Módulo de Artículos
- "¿Cuál es el problema más común?" → Módulo de Acciones Comerciales
- "¿Quién es nuestro proveedor principal?" → Módulo de Proveedores
- "¿Cuántos créditos caución hay?" → Módulo de Créditos Caución

Reglas Fundamentales:
1. NUNCA inventes respuestas
2. SIEMPRE deriva la consulta al módulo correcto
3. Mantén el contexto de la conversación
4. Si no estás seguro, pregunta al usuario para clarificar

Recuerda:
- Analiza el contexto completo de la conversación
- Identifica cambios de tema
- Deriva la consulta al módulo más apropiado
- Mantén un tono profesional pero amigable`;

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
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt }
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

async function analyzeAndRouteMessage(message, context) {
  const prompt = `Analiza la siguiente consulta y determina a qué módulo debe ser derivada:
  
  Consulta: "${message}"
  
  Contexto actual: ${JSON.stringify(context)}
  
  Por favor, responde con el nombre del módulo al que debe ser derivada la consulta (artículos, acciones_comerciales, proveedores, clientes, vendedores, bandejas, casas_comerciales, creditos_caucion) y una breve explicación de por qué.`;

  const analysis = await getDeepSeekResponse(prompt, context);
  
  if (!analysis) {
    return null;
  }

  // Extraer el módulo de la respuesta
  const moduleMatch = analysis.match(/(artículos|acciones_comerciales|proveedores|clientes|vendedores|bandejas|casas_comerciales|creditos_caucion)/i);
  return moduleMatch ? moduleMatch[0].toLowerCase() : null;
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

    // Analizar y enrutar el mensaje
    const targetModule = await analyzeAndRouteMessage(userMessage, assistantContext);
    
    if (targetModule) {
      let result;
      
      switch (targetModule) {
        case 'artículos':
          result = await processArticulosMessage(userMessage);
          if (result.data) {
            if (Array.isArray(result.data)) {
              assistantContext.lastArticulos = result.data.map(art => art.id);
            } else {
              assistantContext.lastArticulo = result.data.id;
              assistantContext.lastArticulos.push(result.data.id);
            }
          }
          break;
          
        case 'acciones_comerciales':
          result = await processAccionesComercialesMessage(userMessage);
          if (result.contextType === 'ultima_accion' && result.data) {
            assistantContext.lastAccionComercial = result.data.id;
            assistantContext.lastAccionesComerciales.push(result.data.id);
          }
          break;
          
        case 'proveedores':
          result = await processProveedoresMessage(userMessage);
          break;
          
        case 'clientes':
          result = await processClientesMessage(userMessage);
          break;
          
        case 'vendedores':
          result = await processVendedoresMessage(userMessage);
          break;
          
        case 'bandejas':
          result = await processBandejasMessage(userMessage);
          break;
          
        case 'casas_comerciales':
          result = await processCasasComercialesMessage(userMessage);
          break;
          
        case 'creditos_caucion':
          result = await processCreditosCaucionMessage(userMessage);
          if (result.data) {
            assistantContext.lastCreditoCaucion = result.data.id;
          }
          break;
          
        default:
          result = { message: "Lo siento, no he podido determinar a qué módulo derivar tu consulta. ¿Podrías reformularla?" };
      }
      
      // Actualizar el contexto
      assistantContext.currentTopic = targetModule;
      assistantContext.lastQuery = userMessage;
      assistantContext.lastResponse = result.message;
      
      assistantContext.conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: result.message }
      );
      
      return {
        message: result.message,
        context: assistantContext
      };
    }

    // Si no se pudo determinar el módulo, pedir clarificación
    const prompt = `El usuario ha enviado el mensaje: "${userMessage}", pero no he podido determinar a qué módulo derivarlo.
    Por favor, proporciona una respuesta amable y profesional que:
    1. Indique que no se ha entendido completamente la consulta
    2. Sugiera los diferentes módulos disponibles
    3. Ofrezca ejemplos de consultas para cada módulo
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