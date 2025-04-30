const db = require('../db');
const axios = require('axios');

// Configuración de la API de DeepSeek
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Prompt base para la IA
const SYSTEM_PROMPT = `Eres un asistente virtual de Semilleros Deitana S.L., especializado en proporcionar información detallada sobre las casas comerciales con las que la empresa mantiene relaciones comerciales.

Tu Objetivo Principal: Analizar la consulta del usuario, identificar qué información específica necesita sobre las casas comerciales, y ejecutar la consulta SQL correspondiente para obtener los datos exactos de la base de datos.

REGLA FUNDAMENTAL:
1. NUNCA inventes datos o respuestas
2. SIEMPRE consulta la base de datos para obtener información real
3. Proporciona respuestas precisas basadas en los datos reales

Estructura de la Base de Datos:
- casas_com: Registro principal de casas comerciales
  * id: Identificador único de la casa comercial
  * CC_DENO: Denominación social o nombre principal registrado legalmente
  * CC_NOM: Nombre comercial
  * CC_DOM: Dirección completa
  * CC_POB: Población o ciudad
  * CC_PROV: Provincia
  * CC_CDP: Código Postal
  * CC_TEL: Número de teléfono
  * CC_FAX: Número de fax
  * CC_CIF: Código de Identificación Fiscal
  * CC_EMA: Correo electrónico
  * CC_WEB: Sitio web
  * CC_PAIS: País
  * CC_DFEC: Fecha inicio validez tarifa
  * CC_HFEC: Fecha fin validez tarifa

Proceso de Respuesta:
1. Analiza la consulta del usuario para entender qué información necesita
2. Identifica qué campos son relevantes
3. Ejecuta la consulta SQL apropiada
4. Procesa los resultados
5. Proporciona una respuesta clara y precisa

Ejemplos de Consultas y Respuestas:
- "¿Cuántas casas comerciales tenemos registradas?"
  * Consulta: SELECT COUNT(*) FROM casas_com
  * Respuesta: "Tenemos X casas comerciales registradas en el sistema"

- "¿Qué casas comerciales existen en la provincia de Almería?"
  * Consulta: SELECT * FROM casas_com WHERE CC_PROV = 'ALMERIA' ORDER BY CC_DENO
  * Respuesta: "Las siguientes casas comerciales están en Almería: [lista de casas comerciales]"

- "¿Qué casas comerciales tienen correo electrónico registrado?"
  * Consulta: SELECT * FROM casas_com WHERE CC_EMA IS NOT NULL AND CC_EMA != '' ORDER BY CC_DENO
  * Respuesta: "Las siguientes casas comerciales tienen correo electrónico registrado: [lista]"

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
async function queryTotalCasasComerciales() {
  const query = `SELECT COUNT(*) as total FROM casas_com`;
  try {
    const [results] = await db.query(query);
    return results[0].total;
  } catch (error) {
    console.error('Error al contar casas comerciales:', error);
    return null;
  }
}

async function queryCasaComercialPorId(id) {
  const query = `SELECT * FROM casas_com WHERE id = ?`;
  try {
    const [results] = await db.query(query, [id]);
    return results[0] || null;
  } catch (error) {
    console.error('Error al consultar casa comercial por ID:', error);
    return null;
  }
}

async function queryCasasComercialesPorProvincia(provincia) {
  const query = `SELECT * FROM casas_com WHERE UPPER(CC_PROV) = UPPER(?) ORDER BY CC_DENO`;
  try {
    const [results] = await db.query(query, [provincia]);
    return results;
  } catch (error) {
    console.error('Error al consultar casas comerciales por provincia:', error);
    return null;
  }
}

async function queryCasasComercialesPorPoblacion(poblacion) {
  const query = `SELECT * FROM casas_com WHERE UPPER(CC_POB) = UPPER(?) ORDER BY CC_DENO`;
  try {
    const [results] = await db.query(query, [poblacion]);
    return results;
  } catch (error) {
    console.error('Error al consultar casas comerciales por población:', error);
    return null;
  }
}

async function queryCasasComercialesConTelefono() {
  const query = `SELECT * FROM casas_com WHERE CC_TEL IS NOT NULL AND CC_TEL != '' ORDER BY CC_DENO`;
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error al consultar casas comerciales con teléfono:', error);
    return null;
  }
}

async function queryCasasComercialesConEmail() {
  const query = `SELECT * FROM casas_com WHERE CC_EMA IS NOT NULL AND CC_EMA != '' ORDER BY CC_DENO`;
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error al consultar casas comerciales con email:', error);
    return null;
  }
}

async function queryCasasComercialesConWeb() {
  const query = `SELECT * FROM casas_com WHERE CC_WEB IS NOT NULL AND CC_WEB != '' ORDER BY CC_DENO`;
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error al consultar casas comerciales con web:', error);
    return null;
  }
}

async function queryCasasComercialesPorNombre(nombre) {
  const query = `SELECT * FROM casas_com WHERE CC_DENO LIKE ? OR CC_NOM LIKE ? ORDER BY CC_DENO`;
  try {
    const [results] = await db.query(query, [`%${nombre}%`, `%${nombre}%`]);
    return results;
  } catch (error) {
    console.error('Error al consultar casas comerciales por nombre:', error);
    return null;
  }
}

async function queryCasasComercialesPorCodigoPostal(codigoPostal) {
  const query = `SELECT * FROM casas_com WHERE CC_CDP = ? ORDER BY CC_DENO`;
  try {
    const [results] = await db.query(query, [codigoPostal]);
    return results;
  } catch (error) {
    console.error('Error al consultar casas comerciales por código postal:', error);
    return null;
  }
}

async function queryCasasComercialesEjemplo(limite = 5) {
  const query = `SELECT * FROM casas_com ORDER BY CC_DENO LIMIT ?`;
  try {
    const [results] = await db.query(query, [limite]);
    return results;
  } catch (error) {
    console.error('Error al consultar casas comerciales de ejemplo:', error);
    return null;
  }
}

async function formatCasaComercialResponse(dbData, contextType, userMessage) {
  if (!dbData) {
    const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron casas comerciales en la base de datos. 
    Por favor, proporciona una respuesta amable y conversacional explicando que no hay datos disponibles y sugiere algunas 
    alternativas de consulta que podrían ser útiles.`;
    
    const aiResponse = await getDeepSeekResponse(prompt, null);
    return aiResponse || "No se encontraron casas comerciales que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
  }

  if (contextType === 'total_casas_comerciales') {
    const prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData} casas comerciales en total.
    Por favor, proporciona una respuesta natural y conversacional que:
    1. Indique el número total de casas comerciales encontradas de manera amigable
    2. Ofrezca sugerencias para obtener más información sobre las casas comerciales
    3. Mantenga un tono profesional pero cercano
    4. Incluya una pregunta abierta para continuar la conversación`;
    
    const aiResponse = await getDeepSeekResponse(prompt, { total: dbData });
    return aiResponse || `¡Hemos encontrado ${dbData} casas comerciales en total! ¿Te gustaría ver más detalles sobre alguna de ellas o prefieres buscar por algún otro criterio?`;
  }

  if (Array.isArray(dbData)) {
    if (dbData.length === 0) {
      const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron casas comerciales que coincidan con su búsqueda.
      Por favor, proporciona una respuesta amable y conversacional sugiriendo alternativas de búsqueda.`;
      
      const aiResponse = await getDeepSeekResponse(prompt, null);
      return aiResponse || "No se encontraron casas comerciales que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
    }

    let context = {
      tipo_consulta: contextType,
      total_resultados: dbData.length,
      datos: dbData.slice(0, 5) // Limitar a los primeros 5 resultados para el contexto
    };

    let prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData.length} casas comerciales. 
    Aquí están los datos relevantes: ${JSON.stringify(context)}.
    Por favor, proporciona una respuesta natural y conversacional que:
    1. Comience con una confirmación amigable de los resultados
    2. Presente las casas comerciales encontradas de manera clara y organizada
    3. Incluya los datos más relevantes de cada casa comercial
    4. Termine con una pregunta o sugerencia para continuar la conversación
    5. Mantenga un tono profesional pero cercano
    
    Ejemplo de tono deseado:
    "¡Por supuesto! Aquí tienes la información que solicitaste...
    ¿Te gustaría saber más sobre alguna de estas casas comerciales o prefieres buscar por otro criterio?"`;

    const aiResponse = await getDeepSeekResponse(prompt, context);
    return aiResponse || formatBasicResponse(dbData, contextType);
  }

  const prompt = `El usuario preguntó: "${userMessage}" y se encontró la siguiente casa comercial: ${JSON.stringify(dbData)}.
  Por favor, proporciona una respuesta natural y conversacional que:
  1. Comience con una confirmación amigable
  2. Describa la casa comercial de manera clara y detallada
  3. Incluya todos los datos relevantes de manera organizada
  4. Termine con una pregunta o sugerencia para continuar la conversación
  5. Mantenga un tono profesional pero cercano
  
  Ejemplo de tono deseado:
  "¡Perfecto! Aquí tienes la información completa de la casa comercial...
  ¿Te gustaría saber algo más sobre esta casa comercial o prefieres buscar otra?"`;

  const aiResponse = await getDeepSeekResponse(prompt, dbData);
  return aiResponse || formatBasicResponse(dbData, contextType);
}

function formatBasicResponse(dbData, contextType) {
  if (Array.isArray(dbData)) {
    let response = `Se encontraron ${dbData.length} casas comerciales:\n\n`;
    dbData.slice(0, 5).forEach(casa => {
      response += `- ${casa.CC_DENO}\n`;
      if (casa.CC_NOM) response += `  Nombre comercial: ${casa.CC_NOM}\n`;
      if (casa.CC_POB) response += `  Población: ${casa.CC_POB}\n`;
      if (casa.CC_PROV) response += `  Provincia: ${casa.CC_PROV}\n`;
      if (casa.CC_TEL) response += `  Teléfono: ${casa.CC_TEL}\n`;
      response += '\n';
    });
    if (dbData.length > 5) {
      response += `\nY ${dbData.length - 5} casas comerciales más...`;
    }
    return response;
  } else {
    return `Casa Comercial:
Nombre: ${dbData.CC_DENO}
${dbData.CC_NOM ? `Nombre comercial: ${dbData.CC_NOM}\n` : ''}
${dbData.CC_DOM ? `Dirección: ${dbData.CC_DOM}\n` : ''}
${dbData.CC_POB ? `Población: ${dbData.CC_POB}\n` : ''}
${dbData.CC_PROV ? `Provincia: ${dbData.CC_PROV}\n` : ''}
${dbData.CC_CDP ? `Código Postal: ${dbData.CC_CDP}\n` : ''}
${dbData.CC_TEL ? `Teléfono: ${dbData.CC_TEL}\n` : ''}
${dbData.CC_FAX ? `Fax: ${dbData.CC_FAX}\n` : ''}
${dbData.CC_CIF ? `CIF: ${dbData.CC_CIF}\n` : ''}
${dbData.CC_EMA ? `Email: ${dbData.CC_EMA}\n` : ''}
${dbData.CC_WEB ? `Web: ${dbData.CC_WEB}\n` : ''}
${dbData.CC_PAIS ? `País: ${dbData.CC_PAIS}\n` : ''}`;
  }
}

async function processCasasComercialesMessage(message) {
  const messageLower = message.toLowerCase();
  let dbData = null;
  let contextType = null;

  // Detectar consultas específicas
  if (messageLower.includes('cuántos') || 
      messageLower.includes('cuantos') || 
      messageLower.includes('total')) {
    dbData = await queryTotalCasasComerciales();
    contextType = 'total_casas_comerciales';
  } else if (messageLower.includes('provincia') || 
             messageLower.includes('provincias')) {
    const provincia = messageLower.match(/(?:provincia|provincias)\s+(?:de\s+)?([a-záéíóúüñ]+)/i)?.[1];
    if (provincia) {
      dbData = await queryCasasComercialesPorProvincia(provincia);
      contextType = 'casas_comerciales_por_provincia';
    }
  } else if (messageLower.includes('población') || 
             messageLower.includes('poblacion') ||
             messageLower.includes('ciudad')) {
    const poblacion = messageLower.match(/(?:población|poblacion|ciudad)\s+([a-záéíóúüñ]+)/i)?.[1];
    if (poblacion) {
      dbData = await queryCasasComercialesPorPoblacion(poblacion);
      contextType = 'casas_comerciales_por_poblacion';
    }
  } else if (messageLower.includes('teléfono') || 
             messageLower.includes('telefono')) {
    dbData = await queryCasasComercialesConTelefono();
    contextType = 'casas_comerciales_con_telefono';
  } else if (messageLower.includes('email') || 
             messageLower.includes('correo')) {
    dbData = await queryCasasComercialesConEmail();
    contextType = 'casas_comerciales_con_email';
  } else if (messageLower.includes('web') || 
             messageLower.includes('sitio')) {
    dbData = await queryCasasComercialesConWeb();
    contextType = 'casas_comerciales_con_web';
  } else if (messageLower.includes('código postal') || 
             messageLower.includes('codigo postal')) {
    const codigoPostal = messageLower.match(/(?:código postal|codigo postal)\s+(\d+)/i)?.[1];
    if (codigoPostal) {
      dbData = await queryCasasComercialesPorCodigoPostal(codigoPostal);
      contextType = 'casas_comerciales_por_codigo_postal';
    }
  } else if (messageLower.includes('ejemplo') || 
             messageLower.includes('muestra') ||
             messageLower.includes('muéstrame')) {
    const limite = messageLower.match(/(?:ejemplo|muestra|muéstrame)\s+(\d+)/i)?.[1] || 5;
    dbData = await queryCasasComercialesEjemplo(parseInt(limite));
    contextType = 'casas_comerciales_ejemplo';
  } else {
    // Búsqueda por nombre
    const palabrasClave = messageLower.split(' ').filter(p => p.length > 3);
    if (palabrasClave.length > 0) {
      dbData = await queryCasasComercialesPorNombre(palabrasClave.join(' '));
      contextType = 'casas_comerciales_por_nombre';
    }
  }

  return {
    message: await formatCasaComercialResponse(dbData, contextType, message),
    contextType,
    data: dbData
  };
}

module.exports = {
  processCasasComercialesMessage
};
