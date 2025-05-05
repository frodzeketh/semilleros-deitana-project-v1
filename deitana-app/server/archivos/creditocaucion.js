const db = require('../db');
const axios = require('axios');

// Configuración de la API de DeepSeek
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Prompt base para la IA
const SYSTEM_PROMPT = `Eres un asistente virtual de Semilleros Deitana S.L., especializado en proporcionar información detallada sobre los créditos caución gestionados por la empresa.

Tu Objetivo Principal: Analizar la consulta del usuario, identificar qué información específica necesita sobre los créditos caución, y ejecutar la consulta SQL correspondiente para obtener los datos exactos de la base de datos.

REGLA FUNDAMENTAL:
1. NUNCA inventes datos o respuestas
2. SIEMPRE consulta la base de datos para obtener información real
3. Proporciona respuestas precisas basadas en los datos reales

Estructura de la Base de Datos:
- creditocau: Registro principal de créditos caución
  * id: Identificador único del crédito caución
  * CAU_CCL: Código del cliente asociado
  * CAU_DIAS: Días máximos de crédito permitidos
  * CAU_TIPO: Tipo de crédito caución (A: Asegurado, N: No asegurado)

- clientes: Información de clientes
  * id: Identificador único del cliente
  * CL_DENO: Denominación social
  * CL_DOM: Domicilio
  * CL_POB: Población
  * CL_PROV: Provincia
  * CL_TEL: Teléfono

- creditocau_cau_obs: Observaciones de créditos caución
  * id: Identificador del crédito caución
  * id2: Identificador secundario para fragmentos de observación
  * C0: Contenido de la observación

Proceso de Respuesta:
1. Analiza la consulta del usuario para entender qué información necesita
2. Identifica qué tablas y campos son relevantes
3. Ejecuta la consulta SQL apropiada
4. Procesa los resultados
5. Proporciona una respuesta clara y precisa

Ejemplos de Consultas y Respuestas:
- "¿Cuántos créditos caución tenemos registrados?"
  * Consulta: SELECT COUNT(*) FROM creditocau
  * Respuesta: "Tenemos X créditos caución registrados en el sistema"

- "Muéstrame un ejemplo de crédito caución"
  * Consulta: SELECT c.*, cl.CL_DENO, cl.CL_DOM, cl.CL_POB, cl.CL_PROV, cl.CL_TEL 
              FROM creditocau c 
              JOIN clientes cl ON c.CAU_CCL = cl.id 
              LIMIT 1
  * Respuesta: "Aquí tienes un ejemplo de crédito caución: [detalles]"

- "¿Qué créditos caución son de tipo asegurado?"
  * Consulta: SELECT c.*, cl.CL_DENO FROM creditocau c 
              JOIN clientes cl ON c.CAU_CCL = cl.id 
              WHERE c.CAU_TIPO = 'A'
  * Respuesta: "Los siguientes créditos caución están asegurados: [lista]"

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
async function queryTotalCreditosCaucion() {
  const query = `SELECT COUNT(*) as total FROM creditocau`;
  try {
    const [results] = await db.query(query);
    return results[0].total;
  } catch (error) {
    console.error('Error al contar créditos caución:', error);
    return null;
  }
}

async function queryCreditoCaucionPorId(id) {
  const query = `
    SELECT c.*, cl.CL_DENO, cl.CL_DOM, cl.CL_POB, cl.CL_PROV, cl.CL_TEL 
    FROM creditocau c 
    JOIN clientes cl ON c.CAU_CCL = cl.id 
    WHERE c.id = ?`;
  try {
    const [results] = await db.query(query, [id]);
    return results[0] || null;
  } catch (error) {
    console.error('Error al consultar crédito caución por ID:', error);
    return null;
  }
}

async function queryCreditosCaucionPorCliente(clienteId) {
  const query = `
    SELECT c.*, cl.CL_DENO, cl.CL_DOM, cl.CL_POB, cl.CL_PROV, cl.CL_TEL 
    FROM creditocau c 
    JOIN clientes cl ON c.CAU_CCL = cl.id 
    WHERE c.CAU_CCL = ?`;
  try {
    const [results] = await db.query(query, [clienteId]);
    return results;
  } catch (error) {
    console.error('Error al consultar créditos caución por cliente:', error);
    return null;
  }
}

async function queryCreditosCaucionAsegurados() {
  const query = `
    SELECT c.*, cl.CL_DENO, cl.CL_DOM, cl.CL_POB, cl.CL_PROV, cl.CL_TEL 
    FROM creditocau c 
    JOIN clientes cl ON c.CAU_CCL = cl.id 
    WHERE c.CAU_TIPO = 'A'`;
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error al consultar créditos caución asegurados:', error);
    return null;
  }
}

async function queryCreditosCaucionPorDias(minDias) {
  const query = `
    SELECT c.*, cl.CL_DENO, cl.CL_DOM, cl.CL_POB, cl.CL_PROV, cl.CL_TEL 
    FROM creditocau c 
    JOIN clientes cl ON c.CAU_CCL = cl.id 
    WHERE c.CAU_DIAS >= ?`;
  try {
    const [results] = await db.query(query, [minDias]);
    return results;
  } catch (error) {
    console.error('Error al consultar créditos caución por días:', error);
    return null;
  }
}

async function queryObservacionesCreditoCaucion(creditoId) {
  const query = `
    SELECT C0 
    FROM creditocau_cau_obs 
    WHERE id = ? 
    ORDER BY id2`;
  try {
    const [results] = await db.query(query, [creditoId]);
    return results;
  } catch (error) {
    console.error('Error al consultar observaciones de crédito caución:', error);
    return null;
  }
}

async function queryCreditosCaucionEjemplo(limite = 5) {
  const query = `
    SELECT c.*, cl.CL_DENO, cl.CL_DOM, cl.CL_POB, cl.CL_PROV, cl.CL_TEL 
    FROM creditocau c 
    JOIN clientes cl ON c.CAU_CCL = cl.id 
    ORDER BY c.id 
    LIMIT ?`;
  try {
    const [results] = await db.query(query, [limite]);
    return results;
  } catch (error) {
    console.error('Error al consultar créditos caución de ejemplo:', error);
    return null;
  }
}

async function queryCreditosCaucionConObservaciones(limite = 5) {
  const query = `
    SELECT DISTINCT c.*, cl.CL_DENO, cl.CL_DOM, cl.CL_POB, cl.CL_PROV, cl.CL_TEL 
    FROM creditocau c 
    JOIN clientes cl ON c.CAU_CCL = cl.id 
    JOIN creditocau_cau_obs obs ON c.id = obs.id 
    ORDER BY c.id 
    LIMIT ?`;
  try {
    const [results] = await db.query(query, [limite]);
    // Para cada crédito caución, obtener sus observaciones
    for (let credito of results) {
      const observaciones = await queryObservacionesCreditoCaucion(credito.id);
      if (observaciones && observaciones.length > 0) {
        credito.observaciones = observaciones.map(obs => obs.C0).join(' ');
      }
    }
    return results;
  } catch (error) {
    console.error('Error al consultar créditos caución con observaciones:', error);
    return null;
  }
}

async function formatCreditoCaucionResponse(dbData, contextType, userMessage) {
  if (!dbData) {
    const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron créditos caución en la base de datos. 
    Por favor, proporciona una respuesta amable y conversacional explicando que no hay datos disponibles y sugiere algunas 
    alternativas de consulta que podrían ser útiles.`;
    
    const aiResponse = await getDeepSeekResponse(prompt, null);
    return aiResponse || "No se encontraron créditos caución que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
  }

  if (contextType === 'total_creditos_caucion') {
    const prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData} créditos caución en total.
    Por favor, proporciona una respuesta natural y conversacional que:
    1. Indique el número total de créditos caución encontrados de manera amigable
    2. Ofrezca sugerencias para obtener más información sobre los créditos caución
    3. Mantenga un tono profesional pero cercano
    4. Incluya una pregunta abierta para continuar la conversación`;
    
    const aiResponse = await getDeepSeekResponse(prompt, { total: dbData });
    return aiResponse || `¡Hemos encontrado ${dbData} créditos caución en total! ¿Te gustaría ver más detalles sobre alguno de ellos o prefieres buscar por algún otro criterio?`;
  }

  if (Array.isArray(dbData)) {
    if (dbData.length === 0) {
      const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron créditos caución que coincidan con su búsqueda.
      Por favor, proporciona una respuesta amable y conversacional sugiriendo alternativas de búsqueda.`;
      
      const aiResponse = await getDeepSeekResponse(prompt, null);
      return aiResponse || "No se encontraron créditos caución que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
    }

    let context = {
      tipo_consulta: contextType,
      total_resultados: dbData.length,
      datos: dbData.slice(0, 5) // Limitar a los primeros 5 resultados para el contexto
    };

    let prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData.length} créditos caución. 
    Aquí están los datos relevantes: ${JSON.stringify(context)}.
    Por favor, proporciona una respuesta natural y conversacional que:
    1. Comience con una confirmación amigable de los resultados
    2. Presente los créditos caución encontrados de manera clara y organizada
    3. Incluya los datos más relevantes de cada crédito caución
    4. Termine con una pregunta o sugerencia para continuar la conversación
    5. Mantenga un tono profesional pero cercano
    
    Ejemplo de tono deseado:
    "¡Por supuesto! Aquí tienes la información que solicitaste...
    ¿Te gustaría saber más sobre alguno de estos créditos caución o prefieres buscar por otro criterio?"`;

    const aiResponse = await getDeepSeekResponse(prompt, context);
    return aiResponse || formatBasicResponse(dbData, contextType);
  }

  const prompt = `El usuario preguntó: "${userMessage}" y se encontró el siguiente crédito caución: ${JSON.stringify(dbData)}.
  Por favor, proporciona una respuesta natural y conversacional que:
  1. Comience con una confirmación amigable
  2. Describa el crédito caución de manera clara y detallada
  3. Incluya todos los datos relevantes de manera organizada
  4. Termine con una pregunta o sugerencia para continuar la conversación
  5. Mantenga un tono profesional pero cercano
  
  Ejemplo de tono deseado:
  "¡Perfecto! Aquí tienes la información completa del crédito caución...
  ¿Te gustaría saber algo más sobre este crédito caución o prefieres buscar otro?"`;

  const aiResponse = await getDeepSeekResponse(prompt, dbData);
  return aiResponse || formatBasicResponse(dbData, contextType);
}

function formatBasicResponse(dbData, contextType) {
  if (Array.isArray(dbData)) {
    let response = `Se encontraron ${dbData.length} créditos caución:\n\n`;
    dbData.slice(0, 5).forEach(credito => {
      response += `- Cliente: ${credito.CL_DENO}\n`;
      response += `  ID: ${credito.id}\n`;
      response += `  Días: ${credito.CAU_DIAS}\n`;
      response += `  Tipo: ${credito.CAU_TIPO === 'A' ? 'Asegurado' : 'No asegurado'}\n`;
      if (credito.CL_POB) response += `  Población: ${credito.CL_POB}\n`;
      if (credito.CL_PROV) response += `  Provincia: ${credito.CL_PROV}\n`;
      response += '\n';
    });
    if (dbData.length > 5) {
      response += `\nY ${dbData.length - 5} créditos caución más...`;
    }
    return response;
  } else {
    return `Crédito Caución:
ID: ${dbData.id}
Cliente: ${dbData.CL_DENO}
Días: ${dbData.CAU_DIAS}
Tipo: ${dbData.CAU_TIPO === 'A' ? 'Asegurado' : 'No asegurado'}
${dbData.CL_DOM ? `Dirección: ${dbData.CL_DOM}\n` : ''}
${dbData.CL_POB ? `Población: ${dbData.CL_POB}\n` : ''}
${dbData.CL_PROV ? `Provincia: ${dbData.CL_PROV}\n` : ''}
${dbData.CL_TEL ? `Teléfono: ${dbData.CL_TEL}\n` : ''}`;
  }
}

async function processCreditosCaucionMessage(message) {
  const messageLower = message.toLowerCase();
  let dbData = null;
  let contextType = null;

  // Detectar consultas específicas
  if (messageLower.includes('observacion') || 
      messageLower.includes('observaciones') ||
      messageLower.includes('comentarios') ||
      messageLower.includes('notas')) {
    const limite = messageLower.match(/(?:mostrar|ver|muestra|dame)\s+(\d+)/i)?.[1] || 5;
    dbData = await queryCreditosCaucionConObservaciones(parseInt(limite));
    contextType = 'creditos_caucion_con_observaciones';
  } else if (messageLower.includes('cuántos') || 
      messageLower.includes('cuantos') || 
      messageLower.includes('total')) {
    dbData = await queryTotalCreditosCaucion();
    contextType = 'total_creditos_caucion';
  } else if (messageLower.includes('cliente') || 
             messageLower.includes('clientes')) {
    const clienteId = messageLower.match(/(?:cliente|clientes)\s+([a-z0-9]+)/i)?.[1];
    if (clienteId) {
      dbData = await queryCreditosCaucionPorCliente(clienteId);
      contextType = 'creditos_caucion_por_cliente';
    }
  } else if (messageLower.includes('asegurado') || 
             messageLower.includes('asegurados')) {
    dbData = await queryCreditosCaucionAsegurados();
    contextType = 'creditos_caucion_asegurados';
  } else if (messageLower.includes('días') || 
             messageLower.includes('dias') ||
             messageLower.includes('más de') ||
             messageLower.includes('mas de')) {
    const minDias = messageLower.match(/(?:más de|mas de)\s+(\d+)/i)?.[1] || 90;
    dbData = await queryCreditosCaucionPorDias(parseInt(minDias));
    contextType = 'creditos_caucion_por_dias';
  } else if (messageLower.includes('ejemplo') || 
             messageLower.includes('muestra') ||
             messageLower.includes('muéstrame')) {
    const limite = messageLower.match(/(?:ejemplo|muestra|muéstrame)\s+(\d+)/i)?.[1] || 5;
    dbData = await queryCreditosCaucionEjemplo(parseInt(limite));
    contextType = 'creditos_caucion_ejemplo';
  } else {
    // Búsqueda por ID
    const id = messageLower.match(/(?:crédito caución|credito caucion)\s+([a-z0-9]+)/i)?.[1];
    if (id) {
      dbData = await queryCreditoCaucionPorId(id);
      if (dbData) {
        const observaciones = await queryObservacionesCreditoCaucion(id);
        if (observaciones && observaciones.length > 0) {
          dbData.observaciones = observaciones.map(obs => obs.C0).join(' ');
        }
      }
      contextType = 'credito_caucion_por_id';
    }
  }

  return {
    message: await formatCreditoCaucionResponse(dbData, contextType, message),
    contextType,
    data: dbData
  };
}

module.exports = {
  processCreditosCaucionMessage
};
