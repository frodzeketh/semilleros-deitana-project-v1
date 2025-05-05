const db = require('../db');
const axios = require('axios');

// Configuración de la API de DeepSeek
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Prompt base para la IA
const SYSTEM_PROMPT = `Eres un asistente virtual de Semilleros Deitana S.L., especializado en proporcionar información detallada sobre los envases de venta utilizados para la comercialización de productos.

Tu Objetivo Principal: Analizar la consulta del usuario, identificar qué información específica necesita sobre los envases de venta, y ejecutar la consulta SQL correspondiente para obtener los datos exactos de la base de datos.

REGLA FUNDAMENTAL:
1. NUNCA inventes datos o respuestas
2. SIEMPRE consulta la base de datos para obtener información real
3. Proporciona respuestas precisas basadas en los datos reales

Estructura de la Base de Datos:
- envases_vta: Registro principal de envases de venta
  * id: Identificador único del envase
  * EV_DENO: Denominación o nombre del envase (ejemplo: "Sobre pequeño", "Bolsa 1 Kg")
  * EV_NEM: Unidad de medida (UD: Unidad, SB: Sobre, L: Litro, KG: Kilogramos)
  * EV_CANT: Cantidad total contenida en el envase
  * EV_UDSS: Número de unidades por presentación o sobre

Proceso de Respuesta:
1. Analiza la consulta del usuario para entender qué información necesita
2. Identifica qué campos son relevantes
3. Ejecuta la consulta SQL apropiada
4. Procesa los resultados
5. Proporciona una respuesta clara y precisa

Ejemplos de Consultas y Respuestas:
- "¿Qué tipos de envases tenemos?"
  * Consulta: SELECT DISTINCT EV_DENO, EV_NEM FROM envases_vta
  * Respuesta: "Contamos con los siguientes tipos de envases: [lista]"

- "¿Qué envases se miden en kilogramos?"
  * Consulta: SELECT * FROM envases_vta WHERE EV_NEM = 'KG'
  * Respuesta: "Los siguientes envases se miden en kilogramos: [lista]"

- "¿Cuántas unidades tiene un sobre?"
  * Consulta: SELECT EV_DENO, EV_UDSS FROM envases_vta WHERE EV_NEM = 'SB'
  * Respuesta: "Los sobres disponibles contienen las siguientes cantidades: [lista]"

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
async function queryTotalEnvases() {
  const query = `SELECT COUNT(*) as total FROM envases_vta`;
  try {
    const [results] = await db.query(query);
    return results[0].total;
  } catch (error) {
    console.error('Error al contar envases:', error);
    return null;
  }
}

async function queryTiposEnvases() {
  const query = `
    SELECT DISTINCT EV_DENO, EV_NEM 
    FROM envases_vta 
    ORDER BY EV_DENO`;
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error al consultar tipos de envases:', error);
    return null;
  }
}

async function queryEnvasesPorUnidadMedida(unidadMedida) {
  const query = `
    SELECT * FROM envases_vta 
    WHERE UPPER(EV_NEM) = UPPER(?) 
    ORDER BY EV_DENO`;
  try {
    const [results] = await db.query(query, [unidadMedida]);
    return results;
  } catch (error) {
    console.error('Error al consultar envases por unidad de medida:', error);
    return null;
  }
}

async function queryEnvasePorId(id) {
  const query = `SELECT * FROM envases_vta WHERE id = ?`;
  try {
    const [results] = await db.query(query, [id]);
    return results[0] || null;
  } catch (error) {
    console.error('Error al consultar envase por ID:', error);
    return null;
  }
}

async function queryEnvasesPorDenominacion(denominacion) {
  const query = `
    SELECT * FROM envases_vta 
    WHERE UPPER(EV_DENO) LIKE UPPER(?) 
    ORDER BY EV_DENO`;
  try {
    const [results] = await db.query(query, [`%${denominacion}%`]);
    return results;
  } catch (error) {
    console.error('Error al consultar envases por denominación:', error);
    return null;
  }
}

async function queryEnvasesPorCantidad(cantidad) {
  const query = `
    SELECT * FROM envases_vta 
    WHERE EV_CANT = ? 
    ORDER BY EV_DENO`;
  try {
    const [results] = await db.query(query, [cantidad]);
    return results;
  } catch (error) {
    console.error('Error al consultar envases por cantidad:', error);
    return null;
  }
}

async function queryEnvasesPorUnidadesSobre(unidades) {
  const query = `
    SELECT * FROM envases_vta 
    WHERE EV_UDSS = ? 
    ORDER BY EV_DENO`;
  try {
    const [results] = await db.query(query, [unidades]);
    return results;
  } catch (error) {
    console.error('Error al consultar envases por unidades por sobre:', error);
    return null;
  }
}

async function queryEnvasesEjemplo(limite = 3) {
  const query = `
    SELECT * FROM envases_vta 
    ORDER BY EV_DENO 
    LIMIT ?`;
  try {
    const [results] = await db.query(query, [limite]);
    return results;
  } catch (error) {
    console.error('Error al consultar envases de ejemplo:', error);
    return null;
  }
}

async function formatEnvaseResponse(dbData, contextType, userMessage) {
  if (!dbData) {
    const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron envases en la base de datos. 
    Por favor, proporciona una respuesta amable y conversacional explicando que no hay datos disponibles y sugiere algunas 
    alternativas de consulta que podrían ser útiles.`;
    
    const aiResponse = await getDeepSeekResponse(prompt, null);
    return aiResponse || "No se encontraron envases que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
  }

  if (contextType === 'total_envases') {
    const prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData} envases.
    Por favor, proporciona una respuesta natural y conversacional que:
    1. Indique el número total encontrado de manera amigable
    2. Ofrezca sugerencias para obtener más información
    3. Mantenga un tono profesional pero cercano
    4. Incluya una pregunta abierta para continuar la conversación`;
    
    const aiResponse = await getDeepSeekResponse(prompt, { total: dbData });
    return aiResponse || `¡Tenemos ${dbData} tipos de envases registrados! ¿Te gustaría conocer más detalles sobre algún tipo específico?`;
  }

  if (Array.isArray(dbData)) {
    if (dbData.length === 0) {
      const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron envases que coincidan con su búsqueda.
      Por favor, proporciona una respuesta amable y conversacional sugiriendo alternativas de búsqueda.`;
      
      const aiResponse = await getDeepSeekResponse(prompt, null);
      return aiResponse || "No se encontraron envases que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
    }

    let context = {
      tipo_consulta: contextType,
      total_resultados: dbData.length,
      datos: dbData
    };

    let prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData.length} envases. 
    Aquí están los datos relevantes: ${JSON.stringify(context)}.
    Por favor, proporciona una respuesta natural y conversacional que:
    1. Comience con una confirmación amigable de los resultados
    2. Presente los envases encontrados de manera clara y organizada
    3. Incluya los datos más relevantes de cada envase
    4. Termine con una pregunta o sugerencia para continuar la conversación
    5. Mantenga un tono profesional pero cercano`;

    const aiResponse = await getDeepSeekResponse(prompt, context);
    return aiResponse || formatBasicResponse(dbData, contextType);
  }

  const prompt = `El usuario preguntó: "${userMessage}" y se encontró el siguiente envase: ${JSON.stringify(dbData)}.
  Por favor, proporciona una respuesta natural y conversacional que:
  1. Comience con una confirmación amigable
  2. Describa el envase de manera clara y detallada
  3. Incluya todos los datos relevantes de manera organizada
  4. Termine con una pregunta o sugerencia para continuar la conversación
  5. Mantenga un tono profesional pero cercano`;

  const aiResponse = await getDeepSeekResponse(prompt, dbData);
  return aiResponse || formatBasicResponse(dbData, contextType);
}

function formatBasicResponse(dbData, contextType) {
  if (Array.isArray(dbData)) {
    let response = `Se encontraron ${dbData.length} envases:\n\n`;
    dbData.forEach(envase => {
      response += `- ${envase.EV_DENO}\n`;
      response += `  ID: ${envase.id}\n`;
      response += `  Unidad de medida: ${envase.EV_NEM}\n`;
      if (envase.EV_CANT) response += `  Cantidad: ${envase.EV_CANT}\n`;
      if (envase.EV_UDSS) response += `  Unidades por sobre: ${envase.EV_UDSS}\n`;
      response += '\n';
    });
    return response;
  } else {
    return `Envase:
Denominación: ${dbData.EV_DENO}
ID: ${dbData.id}
Unidad de medida: ${dbData.EV_NEM}
${dbData.EV_CANT ? `Cantidad: ${dbData.EV_CANT}\n` : ''}
${dbData.EV_UDSS ? `Unidades por sobre: ${dbData.EV_UDSS}\n` : ''}`;
  }
}

async function processEnvasesVentaMessage(message) {
  const messageLower = message.toLowerCase();
  let dbData = null;
  let contextType = null;

  // Detectar consultas específicas
  if (messageLower.includes('cuántos') || 
      messageLower.includes('cuantos') || 
      messageLower.includes('total')) {
    dbData = await queryTotalEnvases();
    contextType = 'total_envases';
  } else if (messageLower.includes('tipos') || 
             messageLower.includes('tipo') ||
             messageLower.includes('diferentes') ||
             messageLower.includes('disponibles')) {
    dbData = await queryTiposEnvases();
    contextType = 'tipos_envases';
  } else if (messageLower.includes('kilogramos') || 
             messageLower.includes('kilos') ||
             messageLower.includes('kg') ||
             messageLower.includes('litros') ||
             messageLower.includes('litro') ||
             messageLower.includes('unidades') ||
             messageLower.includes('unidad') ||
             messageLower.includes('sobres') ||
             messageLower.includes('sobre')) {
    let unidadMedida = 'KG';
    if (messageLower.includes('litro')) unidadMedida = 'L';
    else if (messageLower.includes('unidad')) unidadMedida = 'UD';
    else if (messageLower.includes('sobre')) unidadMedida = 'SB';
    
    dbData = await queryEnvasesPorUnidadMedida(unidadMedida);
    contextType = 'envases_por_unidad_medida';
  } else if (messageLower.includes('ejemplo') || 
             messageLower.includes('muestra') ||
             messageLower.includes('ejemplos')) {
    const limite = messageLower.match(/(\d+)\s+ejemplos?/i)?.[1] || 3;
    dbData = await queryEnvasesEjemplo(parseInt(limite));
    contextType = 'envases_ejemplo';
  } else if (messageLower.includes('bolsa') ||
             messageLower.includes('sobre') ||
             messageLower.includes('maceta')) {
    const palabrasClave = messageLower.split(' ').filter(p => 
      ['bolsa', 'sobre', 'maceta'].includes(p)
    );
    if (palabrasClave.length > 0) {
      dbData = await queryEnvasesPorDenominacion(palabrasClave[0]);
      contextType = 'envases_por_denominacion';
    }
  } else {
    // Búsqueda por ID
    const id = messageLower.match(/(?:envase|id)\s+([0-9]+)/i)?.[1];
    if (id) {
      dbData = await queryEnvasePorId(id);
      contextType = 'envase_por_id';
    }
  }

  return {
    message: await formatEnvaseResponse(dbData, contextType, message),
    contextType,
    data: dbData
  };
}

module.exports = {
  processEnvasesVentaMessage
};
