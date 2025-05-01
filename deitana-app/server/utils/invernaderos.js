const db = require('../db');
const axios = require('axios');

// Configuración de la API de DeepSeek
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Prompt base para la IA
const SYSTEM_PROMPT = `Eres un asistente virtual de Semilleros Deitana S.L., especializado en proporcionar información detallada sobre los invernaderos y sus almacenes asociados.

Tu Objetivo Principal: Analizar la consulta del usuario, identificar qué información específica necesita sobre los invernaderos, y ejecutar la consulta SQL correspondiente para obtener los datos exactos de la base de datos.

REGLA FUNDAMENTAL:
1. NUNCA inventes datos o respuestas
2. SIEMPRE consulta la base de datos para obtener información real
3. Proporciona respuestas precisas basadas en los datos reales
4. SIEMPRE incluye la información del almacén asociado cuando muestres datos de un invernadero

Estructura de la Base de Datos:
- invernaderos: Registro principal de invernaderos
  * id: Identificador único del invernadero (ejemplo: "A4")
  * INV_DENO: Denominación completa (ejemplo: "A4 Pg.28-Parcela.1000")
  * INV_ALM: Código del almacén asociado (ejemplo: "00")
  * INV_NSECI: Número de secciones inicial
  * INV_NSEC: Número de secciones
  * INV_NFIL: Número total de filas

- almacenes: Información de almacenes
  * id: Código del almacén (ejemplo: "01")
  * AM_DENO: Nombre del almacén (ejemplo: "GARDEN")

Proceso de Respuesta:
1. Analiza la consulta del usuario para entender qué información necesita
2. Identifica qué tablas y campos son relevantes
3. Ejecuta la consulta SQL apropiada, incluyendo JOINS con almacenes cuando sea necesario
4. Procesa los resultados
5. Proporciona una respuesta clara y precisa

Ejemplos de Consultas y Respuestas:
- "¿Cuántos invernaderos hay registrados?"
  * Consulta: SELECT COUNT(*) FROM invernaderos
  * Respuesta: "Tenemos X invernaderos registrados en el sistema"

- "¿Qué invernaderos están en el almacén GARDEN?"
  * Consulta: SELECT i.*, a.AM_DENO FROM invernaderos i JOIN almacenes a ON i.INV_ALM = a.id WHERE a.AM_DENO = 'GARDEN'
  * Respuesta: "Los siguientes invernaderos están asociados al almacén GARDEN: [lista]"

- "¿Cuál es el almacén del invernadero A4?"
  * Consulta: SELECT i.*, a.AM_DENO FROM invernaderos i JOIN almacenes a ON i.INV_ALM = a.id WHERE i.id = 'A4'
  * Respuesta: "El invernadero A4 está asociado al almacén [nombre]"

Recuerda:
- SIEMPRE consulta la base de datos para obtener información real
- SIEMPRE incluye la información del almacén asociado
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
async function queryTotalInvernaderos() {
  const query = `SELECT COUNT(*) as total FROM invernaderos`;
  try {
    const [results] = await db.query(query);
    return results[0].total;
  } catch (error) {
    console.error('Error al contar invernaderos:', error);
    return null;
  }
}

async function queryInvernaderoConAlmacen(id) {
  const query = `
    SELECT i.*, a.AM_DENO as almacen_nombre
    FROM invernaderos i
    LEFT JOIN almacenes a ON i.INV_ALM = a.id
    WHERE i.id = ?`;
  try {
    const [results] = await db.query(query, [id]);
    return results[0] || null;
  } catch (error) {
    console.error('Error al consultar invernadero por ID:', error);
    return null;
  }
}

async function queryInvernaderosPorAlmacen(almacenId) {
  const query = `
    SELECT i.*, a.AM_DENO as almacen_nombre
    FROM invernaderos i
    LEFT JOIN almacenes a ON i.INV_ALM = a.id
    WHERE i.INV_ALM = ?
    ORDER BY i.id`;
  try {
    const [results] = await db.query(query, [almacenId]);
    return results;
  } catch (error) {
    console.error('Error al consultar invernaderos por almacén:', error);
    return null;
  }
}

async function queryInvernaderosPorAlmacenNombre(nombreAlmacen) {
  const query = `
    SELECT i.*, a.AM_DENO as almacen_nombre
    FROM invernaderos i
    LEFT JOIN almacenes a ON i.INV_ALM = a.id
    WHERE UPPER(a.AM_DENO) LIKE UPPER(?)
    ORDER BY i.id`;
  try {
    const [results] = await db.query(query, [`%${nombreAlmacen}%`]);
    return results;
  } catch (error) {
    console.error('Error al consultar invernaderos por nombre de almacén:', error);
    return null;
  }
}

async function queryInvernaderosPorDenominacion(denominacion) {
  const query = `
    SELECT i.*, a.AM_DENO as almacen_nombre
    FROM invernaderos i
    LEFT JOIN almacenes a ON i.INV_ALM = a.id
    WHERE UPPER(i.INV_DENO) LIKE UPPER(?)
    ORDER BY i.id`;
  try {
    const [results] = await db.query(query, [`%${denominacion}%`]);
    return results;
  } catch (error) {
    console.error('Error al consultar invernaderos por denominación:', error);
    return null;
  }
}

async function queryInvernaderosConAlmacen() {
  const query = `
    SELECT i.*, a.AM_DENO as almacen_nombre
    FROM invernaderos i
    INNER JOIN almacenes a ON i.INV_ALM = a.id
    ORDER BY i.id`;
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error al consultar invernaderos con almacén:', error);
    return null;
  }
}

async function queryInvernaderosSinAlmacen() {
  const query = `
    SELECT i.*
    FROM invernaderos i
    LEFT JOIN almacenes a ON i.INV_ALM = a.id
    WHERE a.id IS NULL
    ORDER BY i.id`;
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error al consultar invernaderos sin almacén:', error);
    return null;
  }
}

async function queryInvernaderosEjemplo(limite = 3) {
  const query = `
    SELECT i.*, a.AM_DENO as almacen_nombre
    FROM invernaderos i
    LEFT JOIN almacenes a ON i.INV_ALM = a.id
    ORDER BY i.id
    LIMIT ?`;
  try {
    const [results] = await db.query(query, [limite]);
    return results;
  } catch (error) {
    console.error('Error al consultar invernaderos de ejemplo:', error);
    return null;
  }
}

async function formatInvernaderoResponse(dbData, contextType, userMessage) {
  if (!dbData) {
    const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron invernaderos en la base de datos. 
    Por favor, proporciona una respuesta amable y conversacional explicando que no hay datos disponibles y sugiere algunas 
    alternativas de consulta que podrían ser útiles.`;
    
    const aiResponse = await getDeepSeekResponse(prompt, null);
    return aiResponse || "No se encontraron invernaderos que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
  }

  if (contextType === 'total_invernaderos') {
    const prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData} invernaderos.
    Por favor, proporciona una respuesta natural y conversacional que:
    1. Indique el número total encontrado de manera amigable
    2. Ofrezca sugerencias para obtener más información sobre los invernaderos o sus almacenes
    3. Mantenga un tono profesional pero cercano
    4. Incluya una pregunta abierta para continuar la conversación`;
    
    const aiResponse = await getDeepSeekResponse(prompt, { total: dbData });
    return aiResponse || `¡Tenemos ${dbData} invernaderos registrados! ¿Te gustaría conocer más detalles sobre alguno en particular o sobre sus almacenes asociados?`;
  }

  if (Array.isArray(dbData)) {
    if (dbData.length === 0) {
      const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron invernaderos que coincidan con su búsqueda.
      Por favor, proporciona una respuesta amable y conversacional sugiriendo alternativas de búsqueda.`;
      
      const aiResponse = await getDeepSeekResponse(prompt, null);
      return aiResponse || "No se encontraron invernaderos que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
    }

    let context = {
      tipo_consulta: contextType,
      total_resultados: dbData.length,
      datos: dbData
    };

    let prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData.length} invernaderos. 
    Aquí están los datos relevantes: ${JSON.stringify(context)}.
    Por favor, proporciona una respuesta natural y conversacional que:
    1. Comience con una confirmación amigable de los resultados
    2. Presente los invernaderos encontrados de manera clara y organizada
    3. Incluya los datos más relevantes de cada invernadero, SIEMPRE incluyendo su almacén asociado
    4. Termine con una pregunta o sugerencia para continuar la conversación
    5. Mantenga un tono profesional pero cercano`;

    const aiResponse = await getDeepSeekResponse(prompt, context);
    return aiResponse || formatBasicResponse(dbData, contextType);
  }

  const prompt = `El usuario preguntó: "${userMessage}" y se encontró el siguiente invernadero: ${JSON.stringify(dbData)}.
  Por favor, proporciona una respuesta natural y conversacional que:
  1. Comience con una confirmación amigable
  2. Describa el invernadero de manera clara y detallada
  3. Incluya todos los datos relevantes de manera organizada, SIEMPRE incluyendo su almacén asociado
  4. Termine con una pregunta o sugerencia para continuar la conversación
  5. Mantenga un tono profesional pero cercano`;

  const aiResponse = await getDeepSeekResponse(prompt, dbData);
  return aiResponse || formatBasicResponse(dbData, contextType);
}

function formatBasicResponse(dbData, contextType) {
  if (Array.isArray(dbData)) {
    let response = `Se encontraron ${dbData.length} invernaderos:\n\n`;
    dbData.forEach(invernadero => {
      response += `- ${invernadero.INV_DENO}\n`;
      response += `  ID: ${invernadero.id}\n`;
      response += `  Almacén: ${invernadero.almacen_nombre || 'No asignado'} (${invernadero.INV_ALM || 'N/A'})\n`;
      if (invernadero.INV_NSEC) response += `  Número de secciones: ${invernadero.INV_NSEC}\n`;
      if (invernadero.INV_NFIL) response += `  Número de filas: ${invernadero.INV_NFIL}\n`;
      response += '\n';
    });
    return response;
  } else {
    return `Invernadero:
Denominación: ${dbData.INV_DENO}
ID: ${dbData.id}
Almacén: ${dbData.almacen_nombre || 'No asignado'} (${dbData.INV_ALM || 'N/A'})
${dbData.INV_NSEC ? `Número de secciones: ${dbData.INV_NSEC}\n` : ''}
${dbData.INV_NFIL ? `Número de filas: ${dbData.INV_NFIL}\n` : ''}`;
  }
}

async function processInvernaderosMessage(message) {
  const messageLower = message.toLowerCase();
  let dbData = null;
  let contextType = null;

  // Detectar consultas específicas
  if (messageLower.includes('cuántos') || 
      messageLower.includes('cuantos') || 
      messageLower.includes('total')) {
    dbData = await queryTotalInvernaderos();
    contextType = 'total_invernaderos';
  } else if (messageLower.includes('almacén') || 
             messageLower.includes('almacen')) {
    if (messageLower.includes('sin')) {
      dbData = await queryInvernaderosSinAlmacen();
      contextType = 'invernaderos_sin_almacen';
    } else if (messageLower.includes('garden') ||
               messageLower.match(/almac[ée]n\s+([a-z0-9]+)/i)) {
      const almacen = messageLower.match(/almac[ée]n\s+([a-z0-9]+)/i)?.[1] || 'GARDEN';
      dbData = await queryInvernaderosPorAlmacenNombre(almacen);
      contextType = 'invernaderos_por_almacen';
    } else {
      dbData = await queryInvernaderosConAlmacen();
      contextType = 'invernaderos_con_almacen';
    }
  } else if (messageLower.includes('ejemplo') || 
             messageLower.includes('muestra') ||
             messageLower.includes('ejemplos')) {
    const limite = messageLower.match(/(\d+)\s+ejemplos?/i)?.[1] || 3;
    dbData = await queryInvernaderosEjemplo(parseInt(limite));
    contextType = 'invernaderos_ejemplo';
  } else {
    // Búsqueda por ID o denominación
    const id = messageLower.match(/(?:invernadero|id)\s+([a-z0-9]+)/i)?.[1];
    if (id) {
      dbData = await queryInvernaderoConAlmacen(id);
      contextType = 'invernadero_por_id';
    } else {
      // Búsqueda por denominación
      const palabrasClave = messageLower.split(' ').filter(p => p.length > 2);
      if (palabrasClave.length > 0) {
        dbData = await queryInvernaderosPorDenominacion(palabrasClave.join(' '));
        contextType = 'invernaderos_por_denominacion';
      }
    }
  }

  return {
    message: await formatInvernaderoResponse(dbData, contextType, message),
    contextType,
    data: dbData
  };
}

module.exports = {
  processInvernaderosMessage
};
