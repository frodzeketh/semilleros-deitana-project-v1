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

function esConsultaDeDatos(mensaje) {
  const mensajeLower = mensaje.toLowerCase();
  
  // Palabras clave que indican una consulta de datos
  const palabrasClaveDatos = [
    'cuántos', 'cuantos', 'cuántas', 'cuantas',
    'mostrar', 'muestra', 'dame', 'buscar',
    'encontrar', 'listar', 'lista', 'datos',
    'información', 'informacion', 'cliente',
    'clientes', 'artículo', 'articulo', 'artículos',
    'articulos', 'proveedor', 'proveedores'
  ];

  // Verificar si el mensaje contiene palabras clave de datos
  return palabrasClaveDatos.some(palabra => mensajeLower.includes(palabra));
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

async function generarConsultaSQL(tabla, mensaje) {
  const prompt = determinarTipoPrompt(mensaje);
  
  const contexto = {
    tabla: tabla,
    estructura: mapaERP[tabla],
    mensaje: mensaje,
    historial: assistantContext.conversationHistory.slice(-3)
  };

  const respuesta = await getDeepSeekResponse(prompt, JSON.stringify(contexto));
  
  if (!respuesta) {
    return null;
  }

  try {
    const { query } = JSON.parse(respuesta);
    
    // Si es una consulta de acciones comerciales, asegurarnos de incluir las relaciones
    if (tabla === 'acciones_com') {
      // Construir la consulta con todas las relaciones
      return `
        SELECT 
          a.id,
          a.ACCO_DENO,
          a.ACCO_FEC,
          a.ACCO_HOR,
          c.CL_DENO,
          c.CL_POB,
          c.CL_PROV,
          c.CL_TEL,
          c.CL_EMA,
          v.VD_DENO,
          GROUP_CONCAT(n.C0 ORDER BY n.id2 SEPARATOR ' ') as observaciones
        FROM acciones_com a
        LEFT JOIN clientes c ON a.ACCO_CDCL = c.id
        LEFT JOIN vendedores v ON a.ACCO_CDVD = v.id
        LEFT JOIN acciones_com_acco_not n ON a.id = n.id
        GROUP BY a.id, a.ACCO_DENO, a.ACCO_FEC, a.ACCO_HOR, c.CL_DENO, c.CL_POB, c.CL_PROV, c.CL_TEL, c.CL_EMA, v.VD_DENO
        ORDER BY a.ACCO_FEC DESC, a.ACCO_HOR DESC
        LIMIT 10
      `;
    }
    
    return query;
  } catch (error) {
    console.error('Error al parsear la respuesta de la IA:', error);
    return null;
  }
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

async function formatearRespuesta(tabla, resultados, userMessage) {
  if (!resultados || resultados.length === 0) {
    return "No encontré registros que coincidan con tu búsqueda.";
  }

  const messageLower = userMessage.toLowerCase();
  
  // Si es una consulta de tipos de acciones comerciales
  if (messageLower.includes('tipos') && messageLower.includes('acciones')) {
    let respuesta = "";
    resultados.forEach(accion => {
      respuesta += `${accion.ACCO_DENO}\n`;
    });
    return respuesta;
  }

  // Si es una consulta de conteo total
  if (messageLower.includes('total') || messageLower.includes('cuántos') || messageLower.includes('cuantos')) {
    return `En total hay ${resultados[0].total} registros que coinciden con tu búsqueda.`;
  }

  // Para otros tipos de consultas
  let respuesta = "Aquí tienes los resultados de tu búsqueda:\n\n";
  
  resultados.forEach((registro, index) => {
    if (tabla === 'clientes') {
      respuesta += `Cliente ${index + 1}:\n`;
      respuesta += `----------------------------\n`;
      if (registro.CL_DENO) respuesta += `Nombre del cliente: ${registro.CL_DENO}\n`;
      if (registro.CL_POB) respuesta += `Población: ${registro.CL_POB}\n`;
      if (registro.CL_PROV) respuesta += `Provincia: ${registro.CL_PROV}\n`;
      if (registro.CL_TEL) respuesta += `Teléfono: ${registro.CL_TEL}\n`;
      if (registro.CL_EMA) respuesta += `Email: ${registro.CL_EMA}\n`;
      if (registro.CL_CIF) respuesta += `CIF: ${registro.CL_CIF}\n`;
      respuesta += `----------------------------\n\n`;
    } else if (tabla === 'acciones_com') {
      respuesta += `Acción Comercial ${index + 1}:\n`;
      respuesta += `----------------------------\n`;
      if (registro.ACCO_DENO) respuesta += `Tipo de acción: ${registro.ACCO_DENO}\n`;
      if (registro.ACCO_FEC) respuesta += `Fecha: ${registro.ACCO_FEC}\n`;
      if (registro.ACCO_HOR) respuesta += `Hora: ${registro.ACCO_HOR}\n`;
      
      // Información del cliente
      if (registro.CL_DENO) {
        respuesta += `\nCliente:\n`;
        respuesta += `Nombre: ${registro.CL_DENO}\n`;
        if (registro.CL_POB) respuesta += `Población: ${registro.CL_POB}\n`;
        if (registro.CL_PROV) respuesta += `Provincia: ${registro.CL_PROV}\n`;
        if (registro.CL_TEL) respuesta += `Teléfono: ${registro.CL_TEL}\n`;
        if (registro.CL_EMA) respuesta += `Email: ${registro.CL_EMA}\n`;
      }
      
      // Información del vendedor
      if (registro.VD_DENO) {
        respuesta += `\nVendedor:\n`;
        respuesta += `Nombre: ${registro.VD_DENO}\n`;
      }
      
      // Observaciones
      if (registro.observaciones) {
        respuesta += `\nObservaciones:\n`;
        respuesta += `${registro.observaciones}\n`;
      }
      respuesta += `----------------------------\n\n`;
    }
  });

  return respuesta;
}

// Función principal para procesar mensajes
async function processMessage(userMessage) {
  try {
    console.log('Procesando mensaje en deepseek.js:', userMessage);
    const messageLower = userMessage.toLowerCase();

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

    // Si no es una consulta de datos, responder de manera conversacional
    if (!esConsultaDeDatos(userMessage)) {
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

    // Determinar la tabla según el contexto de la consulta
    let tabla = 'clientes'; // Por defecto
    
    // Detectar si es una consulta específica de acciones comerciales
    if ((messageLower.includes('acciones') || messageLower.includes('comerciales')) && 
        !messageLower.includes('cliente') && !messageLower.includes('clientes')) {
      tabla = 'acciones_com';
    }

    const consultaSQL = await generarConsultaSQL(tabla, userMessage);
    
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
    
    const respuestaFormateada = await formatearRespuesta(tabla, resultados, userMessage);

    // Actualizar el contexto
    assistantContext.currentTopic = tabla;
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