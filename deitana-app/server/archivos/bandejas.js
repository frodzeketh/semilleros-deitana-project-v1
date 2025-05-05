const db = require('../db');
const axios = require('axios');

// Configuración de la API de DeepSeek
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Prompt base para la IA
const SYSTEM_PROMPT = `Eres un asistente virtual de Semilleros Deitana S.L., especializado en proporcionar información detallada sobre las bandejas y contenedores utilizados en los procesos de siembra y cultivo.

Tu Objetivo Principal: Analizar la consulta del usuario, identificar qué información específica necesita sobre las bandejas, y ejecutar la consulta SQL correspondiente para obtener los datos exactos de la base de datos.

REGLA FUNDAMENTAL:
1. NUNCA inventes datos o respuestas
2. SIEMPRE consulta la base de datos para obtener información real
3. Proporciona respuestas precisas basadas en los datos reales

Estructura de la Base de Datos:
- bandejas: Registro principal de bandejas y contenedores
  * id: Identificador único de la bandeja
  * BN_DENO: Denominación o nombre descriptivo
  * BN_ALV: Número total de alvéolos
  * BN_RET: Indica si es retornable/reutilizable ('S')
  * BN_PVP: Precio de venta
  * BN_COS: Coste de adquisición
  * BN_IVA1: Tasa de IVA 1
  * BN_IVA2: Tasa de IVA 2
  * BN_ART: Identificador del artículo asociado
  * BN_ALVC: Número de alvéolos por columna
  * BN_EM2: Metros cuadrados que ocupa
  * BN_ALVG: Número de alvéolos grandes
  * BN_SUS: (Campo sin descripción detallada)

Proceso de Respuesta:
1. Analiza la consulta del usuario para entender qué información necesita
2. Identifica qué campos son relevantes
3. Ejecuta la consulta SQL apropiada
4. Procesa los resultados
5. Proporciona una respuesta clara y precisa

Ejemplos de Consultas y Respuestas:
- "¿Cuántas bandejas tenemos registradas?"
  * Consulta: SELECT COUNT(*) FROM bandejas
  * Respuesta: "Tenemos X bandejas registradas en el sistema"

- "¿Qué bandejas tienen más de 100 alvéolos?"
  * Consulta: SELECT * FROM bandejas WHERE BN_ALV > 100 ORDER BY BN_ALV DESC
  * Respuesta: "Las siguientes bandejas tienen más de 100 alvéolos: [lista de bandejas]"

- "¿Qué bandeja tiene el mayor número de alvéolos?"
  * Consulta: SELECT * FROM bandejas ORDER BY BN_ALV DESC LIMIT 1
  * Respuesta: "La bandeja con más alvéolos es [nombre] con [número] alvéolos"

Recuerda:
- SIEMPRE consulta la base de datos para obtener información real
- Proporciona respuestas precisas y basadas en datos
- Si no hay datos, indícalo claramente
- Mantén un tono profesional pero amigable`;

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

// Funciones de consulta a la base de datos
async function queryTotalBandejas() {
  const query = `SELECT COUNT(*) as total FROM bandejas`;
  try {
    const [results] = await db.query(query);
    return results[0].total;
  } catch (error) {
    console.error('Error al contar bandejas:', error);
    return null;
  }
}

async function queryBandejaPorId(id) {
  const query = `SELECT * FROM bandejas WHERE id = ?`;
  try {
    const [results] = await db.query(query, [id]);
    return results[0] || null;
  } catch (error) {
    console.error('Error al consultar bandeja por ID:', error);
    return null;
  }
}

async function queryBandejasPorAlveolos(minAlveolos) {
  const query = `SELECT * FROM bandejas WHERE BN_ALV >= ? ORDER BY BN_ALV DESC`;
  try {
    const [results] = await db.query(query, [minAlveolos]);
    return results;
  } catch (error) {
    console.error('Error al consultar bandejas por alvéolos:', error);
    return null;
  }
}

async function queryBandejaMasAlveolos() {
  const query = `SELECT * FROM bandejas ORDER BY BN_ALV DESC LIMIT 1`;
  try {
    const [results] = await db.query(query);
    return results[0] || null;
  } catch (error) {
    console.error('Error al consultar bandeja con más alvéolos:', error);
    return null;
  }
}

async function queryBandejasReutilizables() {
  const query = `SELECT * FROM bandejas WHERE BN_RET = 'S' ORDER BY BN_DENO`;
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error al consultar bandejas reutilizables:', error);
    return null;
  }
}

async function queryBandejasPorNombre(nombre) {
  const query = `SELECT * FROM bandejas WHERE BN_DENO LIKE ? ORDER BY BN_DENO`;
  try {
    const [results] = await db.query(query, [`%${nombre}%`]);
    return results;
  } catch (error) {
    console.error('Error al consultar bandejas por nombre:', error);
    return null;
  }
}

async function queryBandejasEjemplo(limite = 5) {
  const query = `SELECT * FROM bandejas ORDER BY BN_DENO LIMIT ?`;
  try {
    const [results] = await db.query(query, [limite]);
    return results;
  } catch (error) {
    console.error('Error al consultar bandejas de ejemplo:', error);
    return null;
  }
}

async function formatBandejaResponse(dbData, contextType, userMessage) {
  if (!dbData) {
    const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron bandejas en la base de datos. 
    Por favor, proporciona una respuesta amable y conversacional explicando que no hay datos disponibles y sugiere algunas 
    alternativas de consulta que podrían ser útiles.`;
    
    const aiResponse = await getDeepSeekResponse(prompt, null);
    return aiResponse || "No se encontraron bandejas que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
  }

  if (contextType === 'total_bandejas') {
    const prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData} bandejas en total.
    Por favor, proporciona una respuesta natural y conversacional que:
    1. Indique el número total de bandejas encontradas de manera amigable
    2. Ofrezca sugerencias para obtener más información sobre las bandejas
    3. Mantenga un tono profesional pero cercano
    4. Incluya una pregunta abierta para continuar la conversación`;
    
    const aiResponse = await getDeepSeekResponse(prompt, { total: dbData });
    return aiResponse || `¡Hemos encontrado ${dbData} bandejas en total! ¿Te gustaría ver más detalles sobre alguna de ellas o prefieres buscar por algún otro criterio?`;
  }

  if (Array.isArray(dbData)) {
    if (dbData.length === 0) {
      const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron bandejas que coincidan con su búsqueda.
      Por favor, proporciona una respuesta amable y conversacional sugiriendo alternativas de búsqueda.`;
      
      const aiResponse = await getDeepSeekResponse(prompt, null);
      return aiResponse || "No se encontraron bandejas que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
    }

    let context = {
      tipo_consulta: contextType,
      total_resultados: dbData.length,
      datos: dbData.slice(0, 5) // Limitar a los primeros 5 resultados para el contexto
    };

    let prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData.length} bandejas. 
    Aquí están los datos relevantes: ${JSON.stringify(context)}.
    Por favor, proporciona una respuesta natural y conversacional que:
    1. Comience con una confirmación amigable de los resultados
    2. Presente las bandejas encontradas de manera clara y organizada
    3. Incluya los datos más relevantes de cada bandeja
    4. Termine con una pregunta o sugerencia para continuar la conversación
    5. Mantenga un tono profesional pero cercano
    
    Ejemplo de tono deseado:
    "¡Por supuesto! Aquí tienes la información que solicitaste...
    ¿Te gustaría saber más sobre alguna de estas bandejas o prefieres buscar por otro criterio?"`;

    const aiResponse = await getDeepSeekResponse(prompt, context);
    return aiResponse || formatBasicResponse(dbData, contextType);
  }

  const prompt = `El usuario preguntó: "${userMessage}" y se encontró la siguiente bandeja: ${JSON.stringify(dbData)}.
  Por favor, proporciona una respuesta natural y conversacional que:
  1. Comience con una confirmación amigable
  2. Describa la bandeja de manera clara y detallada
  3. Incluya todos los datos relevantes de manera organizada
  4. Termine con una pregunta o sugerencia para continuar la conversación
  5. Mantenga un tono profesional pero cercano
  
  Ejemplo de tono deseado:
  "¡Perfecto! Aquí tienes la información completa de la bandeja...
  ¿Te gustaría saber algo más sobre esta bandeja o prefieres buscar otra?"`;

  const aiResponse = await getDeepSeekResponse(prompt, dbData);
  return aiResponse || formatBasicResponse(dbData, contextType);
}

function formatBasicResponse(dbData, contextType) {
  if (Array.isArray(dbData)) {
    let response = `Se encontraron ${dbData.length} bandejas:\n\n`;
    dbData.slice(0, 5).forEach(bandeja => {
      response += `- ${bandeja.BN_DENO}\n`;
      response += `  Alvéolos: ${bandeja.BN_ALV}\n`;
      response += `  ${bandeja.BN_RET === 'S' ? 'Reutilizable' : 'No reutilizable'}\n`;
      if (bandeja.BN_PVP) response += `  Precio: ${bandeja.BN_PVP}€\n`;
      response += '\n';
    });
    if (dbData.length > 5) {
      response += `\nY ${dbData.length - 5} bandejas más...`;
    }
    return response;
  } else {
    return `Bandeja:
Nombre: ${dbData.BN_DENO}
Alvéolos: ${dbData.BN_ALV}
${dbData.BN_RET === 'S' ? 'Reutilizable' : 'No reutilizable'}
${dbData.BN_PVP ? `Precio: ${dbData.BN_PVP}€\n` : ''}
${dbData.BN_COS ? `Coste: ${dbData.BN_COS}€\n` : ''}
${dbData.BN_ALVC ? `Alvéolos por columna: ${dbData.BN_ALVC}\n` : ''}
${dbData.BN_EM2 ? `Metros cuadrados: ${dbData.BN_EM2}\n` : ''}
${dbData.BN_ALVG ? `Alvéolos grandes: ${dbData.BN_ALVG}\n` : ''}`;
  }
}

async function processBandejasMessage(message) {
  const messageLower = message.toLowerCase();
  let dbData = null;
  let contextType = null;

  // Detectar consultas específicas
  if (messageLower.includes('cuántos') || 
      messageLower.includes('cuantos') || 
      messageLower.includes('total')) {
    dbData = await queryTotalBandejas();
    contextType = 'total_bandejas';
  } else if (messageLower.includes('alvéolos') || 
             messageLower.includes('alveolos') ||
             messageLower.includes('más de') ||
             messageLower.includes('mas de')) {
    const minAlveolos = messageLower.match(/(?:más de|mas de)\s+(\d+)/i)?.[1] || 100;
    dbData = await queryBandejasPorAlveolos(parseInt(minAlveolos));
    contextType = 'bandejas_por_alveolos';
  } else if (messageLower.includes('más alvéolos') || 
             messageLower.includes('mas alveolos') ||
             messageLower.includes('mayor número de alvéolos') ||
             messageLower.includes('mayor numero de alveolos')) {
    dbData = await queryBandejaMasAlveolos();
    contextType = 'bandeja_mas_alveolos';
  } else if (messageLower.includes('reutilizable') || 
             messageLower.includes('retornable')) {
    dbData = await queryBandejasReutilizables();
    contextType = 'bandejas_reutilizables';
  } else if (messageLower.includes('forestal') || 
             messageLower.includes('forestales')) {
    dbData = await queryBandejasPorNombre('forestal');
    contextType = 'bandejas_forestales';
  } else if (messageLower.includes('ejemplo') || 
             messageLower.includes('muestra') ||
             messageLower.includes('muéstrame')) {
    const limite = messageLower.match(/(?:ejemplo|muestra|muéstrame)\s+(\d+)/i)?.[1] || 5;
    dbData = await queryBandejasEjemplo(parseInt(limite));
    contextType = 'bandejas_ejemplo';
  } else {
    // Búsqueda por nombre
    const palabrasClave = messageLower.split(' ').filter(p => p.length > 3);
    if (palabrasClave.length > 0) {
      dbData = await queryBandejasPorNombre(palabrasClave.join(' '));
      contextType = 'bandejas_por_nombre';
    }
  }

  return {
    message: await formatBandejaResponse(dbData, contextType, message),
    contextType,
    data: dbData
  };
}

module.exports = {
  processBandejasMessage
};
