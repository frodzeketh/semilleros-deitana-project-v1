const db = require('../db');
const axios = require('axios');

// Configuración de la API de DeepSeek
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Prompt base para la IA
const SYSTEM_PROMPT = `Eres un asistente virtual de Semilleros Deitana S.L., especializado en proporcionar información detallada sobre los dispositivos móviles utilizados en la empresa.

Tu Objetivo Principal: Analizar la consulta del usuario, identificar qué información específica necesita sobre los dispositivos móviles, y ejecutar la consulta SQL correspondiente para obtener los datos exactos de la base de datos.

REGLA FUNDAMENTAL:
1. NUNCA inventes datos o respuestas
2. SIEMPRE consulta la base de datos para obtener información real
3. Proporciona respuestas precisas basadas en los datos reales

Estructura de la Base de Datos:
- dispositivos: Registro principal de dispositivos móviles
  * id: Identificador único del dispositivo (ejemplo: '0018')
  * DIS_DENO: Denominación o nombre del dispositivo (ejemplo: 'PDA18')
  * DIS_MARCA: Marca del dispositivo (ejemplo: 'MOTOROLA')
  * DIS_MOD: Modelo del dispositivo (ejemplo: 'MC75')
  * DIS_FCOM: Fecha de compra (formato: AAAA-MM-DD)
  * DIS_MAC: Dirección MAC del dispositivo
  * DIS_IP: Dirección IP asignada
  * DIS_KEY: Clave de seguridad
  * DIS_BAJA: Estado (0: activo, 1: baja)

- dispositivos_dis_obs: Observaciones de dispositivos
  * id: Identificador del dispositivo
  * id2: Identificador secundario para fragmentos
  * C0: Contenido de la observación

Proceso de Respuesta:
1. Analiza la consulta del usuario para entender qué información necesita
2. Identifica qué campos son relevantes
3. Ejecuta la consulta SQL apropiada
4. Procesa los resultados
5. Proporciona una respuesta clara y precisa

Ejemplos de Consultas y Respuestas:
- "¿Cuántos dispositivos móviles tenemos?"
  * Consulta: SELECT COUNT(*) FROM dispositivos
  * Respuesta: "Tenemos X dispositivos móviles registrados en el sistema"

- "¿Cuántos dispositivos están activos?"
  * Consulta: SELECT COUNT(*) FROM dispositivos WHERE DIS_BAJA = 0
  * Respuesta: "Actualmente hay X dispositivos activos en uso"

- "¿Qué marcas de dispositivos tenemos?"
  * Consulta: SELECT DISTINCT DIS_MARCA FROM dispositivos
  * Respuesta: "Contamos con dispositivos de las siguientes marcas: [lista]"

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
async function queryTotalDispositivos() {
  const query = `SELECT COUNT(*) as total FROM dispositivos`;
  try {
    const [results] = await db.query(query);
    return results[0].total;
  } catch (error) {
    console.error('Error al contar dispositivos:', error);
    return null;
  }
}

async function queryDispositivosActivos() {
  const query = `SELECT COUNT(*) as total FROM dispositivos WHERE DIS_BAJA = 0`;
  try {
    const [results] = await db.query(query);
    return results[0].total;
  } catch (error) {
    console.error('Error al contar dispositivos activos:', error);
    return null;
  }
}

async function queryDispositivosPorMarca(marca) {
  const query = `
    SELECT * FROM dispositivos 
    WHERE UPPER(DIS_MARCA) = UPPER(?) 
    ORDER BY DIS_DENO`;
  try {
    const [results] = await db.query(query, [marca]);
    return results;
  } catch (error) {
    console.error('Error al consultar dispositivos por marca:', error);
    return null;
  }
}

async function queryMarcasDispositivos() {
  const query = `SELECT DISTINCT DIS_MARCA FROM dispositivos WHERE DIS_MARCA IS NOT NULL ORDER BY DIS_MARCA`;
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error al consultar marcas de dispositivos:', error);
    return null;
  }
}

async function queryDispositivoPorId(id) {
  const query = `SELECT * FROM dispositivos WHERE id = ?`;
  try {
    const [results] = await db.query(query, [id]);
    return results[0] || null;
  } catch (error) {
    console.error('Error al consultar dispositivo por ID:', error);
    return null;
  }
}

async function queryDispositivoPorDenominacion(denominacion) {
  const query = `SELECT * FROM dispositivos WHERE DIS_DENO LIKE ?`;
  try {
    const [results] = await db.query(query, [`%${denominacion}%`]);
    return results;
  } catch (error) {
    console.error('Error al consultar dispositivo por denominación:', error);
    return null;
  }
}

async function queryDispositivosConObservaciones() {
  const query = `
    SELECT DISTINCT d.*, GROUP_CONCAT(o.C0 ORDER BY o.id2 SEPARATOR ' ') as observaciones
    FROM dispositivos d
    JOIN dispositivos_dis_obs o ON d.id = o.id
    GROUP BY d.id
    ORDER BY d.DIS_DENO`;
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error al consultar dispositivos con observaciones:', error);
    return null;
  }
}

async function queryDispositivosSinObservaciones() {
  const query = `
    SELECT d.*
    FROM dispositivos d
    LEFT JOIN dispositivos_dis_obs o ON d.id = o.id
    WHERE o.id IS NULL
    ORDER BY d.DIS_DENO`;
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error al consultar dispositivos sin observaciones:', error);
    return null;
  }
}

async function queryObservacionesDispositivo(id) {
  const query = `
    SELECT GROUP_CONCAT(C0 ORDER BY id2 SEPARATOR ' ') as observaciones
    FROM dispositivos_dis_obs
    WHERE id = ?
    GROUP BY id`;
  try {
    const [results] = await db.query(query, [id]);
    return results[0]?.observaciones || null;
  } catch (error) {
    console.error('Error al consultar observaciones del dispositivo:', error);
    return null;
  }
}

async function formatDispositivoResponse(dbData, contextType, userMessage) {
  if (!dbData) {
    const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron dispositivos móviles en la base de datos. 
    Por favor, proporciona una respuesta amable y conversacional explicando que no hay datos disponibles y sugiere algunas 
    alternativas de consulta que podrían ser útiles.`;
    
    const aiResponse = await getDeepSeekResponse(prompt, null);
    return aiResponse || "No se encontraron dispositivos que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
  }

  if (contextType === 'total_dispositivos' || contextType === 'dispositivos_activos') {
    const prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData} dispositivos.
    Por favor, proporciona una respuesta natural y conversacional que:
    1. Indique el número total encontrado de manera amigable
    2. Ofrezca sugerencias para obtener más información
    3. Mantenga un tono profesional pero cercano
    4. Incluya una pregunta abierta para continuar la conversación`;
    
    const aiResponse = await getDeepSeekResponse(prompt, { total: dbData, tipo: contextType });
    return aiResponse || `¡Hemos encontrado ${dbData} dispositivos! ¿Te gustaría saber más detalles sobre alguno de ellos?`;
  }

  if (Array.isArray(dbData)) {
    if (dbData.length === 0) {
      const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron dispositivos que coincidan con su búsqueda.
      Por favor, proporciona una respuesta amable y conversacional sugiriendo alternativas de búsqueda.`;
      
      const aiResponse = await getDeepSeekResponse(prompt, null);
      return aiResponse || "No se encontraron dispositivos que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
    }

    let context = {
      tipo_consulta: contextType,
      total_resultados: dbData.length,
      datos: dbData.slice(0, 5) // Limitar a los primeros 5 resultados para el contexto
    };

    let prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData.length} dispositivos. 
    Aquí están los datos relevantes: ${JSON.stringify(context)}.
    Por favor, proporciona una respuesta natural y conversacional que:
    1. Comience con una confirmación amigable de los resultados
    2. Presente los dispositivos encontrados de manera clara y organizada
    3. Incluya los datos más relevantes de cada dispositivo
    4. Termine con una pregunta o sugerencia para continuar la conversación
    5. Mantenga un tono profesional pero cercano`;

    const aiResponse = await getDeepSeekResponse(prompt, context);
    return aiResponse || formatBasicResponse(dbData, contextType);
  }

  const prompt = `El usuario preguntó: "${userMessage}" y se encontró el siguiente dispositivo: ${JSON.stringify(dbData)}.
  Por favor, proporciona una respuesta natural y conversacional que:
  1. Comience con una confirmación amigable
  2. Describa el dispositivo de manera clara y detallada
  3. Incluya todos los datos relevantes de manera organizada
  4. Termine con una pregunta o sugerencia para continuar la conversación
  5. Mantenga un tono profesional pero cercano`;

  const aiResponse = await getDeepSeekResponse(prompt, dbData);
  return aiResponse || formatBasicResponse(dbData, contextType);
}

function formatBasicResponse(dbData, contextType) {
  if (Array.isArray(dbData)) {
    let response = `Se encontraron ${dbData.length} dispositivos:\n\n`;
    dbData.slice(0, 5).forEach(dispositivo => {
      response += `- ${dispositivo.DIS_DENO}\n`;
      response += `  ID: ${dispositivo.id}\n`;
      response += `  Marca: ${dispositivo.DIS_MARCA || 'No especificada'}\n`;
      response += `  Modelo: ${dispositivo.DIS_MOD || 'No especificado'}\n`;
      response += `  Estado: ${dispositivo.DIS_BAJA === 0 ? 'Activo' : 'Baja'}\n`;
      if (dispositivo.observaciones) {
        response += `  Observaciones: ${dispositivo.observaciones}\n`;
      }
      response += '\n';
    });
    if (dbData.length > 5) {
      response += `\nY ${dbData.length - 5} dispositivos más...`;
    }
    return response;
  } else {
    return `Dispositivo:
Denominación: ${dbData.DIS_DENO}
ID: ${dbData.id}
Marca: ${dbData.DIS_MARCA || 'No especificada'}
Modelo: ${dbData.DIS_MOD || 'No especificado'}
Estado: ${dbData.DIS_BAJA === 0 ? 'Activo' : 'Baja'}
${dbData.DIS_FCOM ? `Fecha de compra: ${dbData.DIS_FCOM}\n` : ''}
${dbData.DIS_MAC ? `MAC: ${dbData.DIS_MAC}\n` : ''}
${dbData.DIS_IP ? `IP: ${dbData.DIS_IP}\n` : ''}
${dbData.observaciones ? `Observaciones: ${dbData.observaciones}\n` : ''}`;
  }
}

async function processDispositivosMovilesMessage(message) {
  const messageLower = message.toLowerCase();
  let dbData = null;
  let contextType = null;

  // Detectar consultas específicas
  if (messageLower.includes('cuántos') || 
      messageLower.includes('cuantos') || 
      messageLower.includes('total')) {
    if (messageLower.includes('activos') || 
        messageLower.includes('activo') ||
        messageLower.includes('uso')) {
      dbData = await queryDispositivosActivos();
      contextType = 'dispositivos_activos';
    } else {
      dbData = await queryTotalDispositivos();
      contextType = 'total_dispositivos';
    }
  } else if (messageLower.includes('marca') || 
             messageLower.includes('marcas')) {
    if (messageLower.includes('motorola') ||
        messageLower.match(/marca\s+([a-záéíóúñ]+)/i)) {
      const marca = messageLower.match(/marca\s+([a-záéíóúñ]+)/i)?.[1] || 'MOTOROLA';
      dbData = await queryDispositivosPorMarca(marca);
      contextType = 'dispositivos_por_marca';
    } else {
      dbData = await queryMarcasDispositivos();
      contextType = 'marcas_disponibles';
    }
  } else if (messageLower.includes('observaciones') || 
             messageLower.includes('observación') ||
             messageLower.includes('comentarios')) {
    if (messageLower.includes('sin')) {
      dbData = await queryDispositivosSinObservaciones();
      contextType = 'dispositivos_sin_observaciones';
    } else {
      dbData = await queryDispositivosConObservaciones();
      contextType = 'dispositivos_con_observaciones';
    }
  } else if (messageLower.includes('pda')) {
    const denominacion = messageLower.match(/pda\s*(\d+)/i)?.[1];
    if (denominacion) {
      dbData = await queryDispositivoPorDenominacion(`PDA${denominacion}`);
      if (dbData && dbData.length === 1) {
        const observaciones = await queryObservacionesDispositivo(dbData[0].id);
        if (observaciones) {
          dbData[0].observaciones = observaciones;
        }
      }
      contextType = 'dispositivo_por_denominacion';
    }
  } else {
    // Búsqueda por ID
    const id = messageLower.match(/(?:dispositivo|id)\s+([0-9]+)/i)?.[1];
    if (id) {
      dbData = await queryDispositivoPorId(id);
      if (dbData) {
        const observaciones = await queryObservacionesDispositivo(id);
        if (observaciones) {
          dbData.observaciones = observaciones;
        }
      }
      contextType = 'dispositivo_por_id';
    }
  }

  return {
    message: await formatDispositivoResponse(dbData, contextType, message),
    contextType,
    data: dbData
  };
}

module.exports = {
  processDispositivosMovilesMessage
};
