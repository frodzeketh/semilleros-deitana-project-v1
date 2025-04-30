const db = require('../db');
const axios = require('axios');

// Configuración de la API de DeepSeek
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Prompt base para la IA
const SYSTEM_PROMPT = `Eres un asistente virtual de Semilleros Deitana S.L., especializado en proporcionar información detallada sobre los proveedores de la empresa.

Tu Objetivo Principal: Analizar la consulta del usuario, identificar qué información específica necesita sobre los proveedores, y ejecutar la consulta SQL correspondiente para obtener los datos exactos de la base de datos.

REGLA FUNDAMENTAL:
1. NUNCA inventes datos o respuestas
2. SIEMPRE consulta la base de datos para obtener información real
3. Proporciona respuestas precisas basadas en los datos reales

Estructura de la Base de Datos:
- proveedores: Registro principal de proveedores
  * id: Código único del proveedor
  * PR_DENO: Denominación social o nombre completo
  * PR_DOM: Domicilio del proveedor
  * PR_POB: Población del proveedor
  * PR_PROV: Provincia del proveedor
  * PR_CDP: Código postal
  * PR_TEL: Número(s) de teléfono
  * PR_FAX: Número de FAX
  * PR_CIF: Código de Identificación Fiscal (CIF)
  * PR_EMA: Dirección de correo electrónico
  * PR_WEB: Dirección web
  * PR_DOMEN: Domicilio para envío de facturas

Proceso de Respuesta:
1. Analiza la consulta del usuario para entender qué información necesita
2. Identifica qué campos son relevantes
3. Ejecuta la consulta SQL apropiada
4. Procesa los resultados
5. Proporciona una respuesta clara y precisa

Ejemplos de Consultas y Respuestas:
- "¿Cuántos proveedores hay en Almería?"
  * Consulta: SELECT COUNT(*) FROM proveedores WHERE PR_PROV = 'ALMERIA'
  * Respuesta: "Existen X proveedores en la provincia de Almería"

- "¿Quién es el proveedor con CIF A46031258?"
  * Consulta: SELECT * FROM proveedores WHERE PR_CIF = 'A46031258'
  * Respuesta: "El proveedor con CIF A46031258 es [nombre del proveedor]"

- "Muestra proveedores de La Mojonera"
  * Consulta: SELECT * FROM proveedores WHERE PR_POB = 'LA MOJONERA' LIMIT 5
  * Respuesta: "En La Mojonera tenemos los siguientes proveedores: [lista de proveedores]"

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
async function queryTotalProveedores() {
  const query = `SELECT COUNT(*) as total FROM proveedores`;
  try {
    const [results] = await db.query(query);
    return results[0].total;
  } catch (error) {
    console.error('Error al contar proveedores:', error);
    return null;
  }
}

async function queryProveedorPorId(id) {
  const query = `SELECT * FROM proveedores WHERE id = ?`;
  try {
    const [results] = await db.query(query, [id]);
    return results[0] || null;
  } catch (error) {
    console.error('Error al consultar proveedor por ID:', error);
    return null;
  }
}

async function queryProveedoresPorProvincia(provincia) {
  const query = `SELECT * FROM proveedores WHERE UPPER(PR_PROV) = UPPER(?) ORDER BY PR_DENO`;
  try {
    const [results] = await db.query(query, [provincia]);
    return results;
  } catch (error) {
    console.error('Error al consultar proveedores por provincia:', error);
    return null;
  }
}

async function queryProveedoresPorPoblacion(poblacion) {
  const query = `SELECT * FROM proveedores WHERE UPPER(PR_POB) = UPPER(?) ORDER BY PR_DENO`;
  try {
    const [results] = await db.query(query, [poblacion]);
    return results;
  } catch (error) {
    console.error('Error al consultar proveedores por población:', error);
    return null;
  }
}

async function queryProveedorPorCIF(cif) {
  const query = `SELECT * FROM proveedores WHERE PR_CIF = ?`;
  try {
    const [results] = await db.query(query, [cif]);
    return results[0] || null;
  } catch (error) {
    console.error('Error al consultar proveedor por CIF:', error);
    return null;
  }
}

async function queryProveedoresPorNombre(nombre) {
  const query = `SELECT * FROM proveedores WHERE PR_DENO LIKE ? ORDER BY PR_DENO`;
  try {
    const [results] = await db.query(query, [`%${nombre}%`]);
    return results;
  } catch (error) {
    console.error('Error al consultar proveedores por nombre:', error);
    return null;
  }
}

async function queryProveedoresPorInicial(letra) {
  const query = `SELECT * FROM proveedores WHERE PR_DENO LIKE ? ORDER BY PR_DENO`;
  try {
    const [results] = await db.query(query, [`${letra.toUpperCase()}%`]);
    return results;
  } catch (error) {
    console.error('Error al consultar proveedores por inicial:', error);
    return null;
  }
}

async function queryProveedoresConEmail() {
  const query = `SELECT * FROM proveedores WHERE PR_EMA IS NOT NULL AND PR_EMA != '' ORDER BY PR_DENO`;
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error al consultar proveedores con email:', error);
    return null;
  }
}

async function queryProveedoresEjemplo(limite = 5) {
  const query = `SELECT * FROM proveedores ORDER BY PR_DENO LIMIT ?`;
  try {
    const [results] = await db.query(query, [limite]);
    return results;
  } catch (error) {
    console.error('Error al consultar proveedores de ejemplo:', error);
    return null;
  }
}

async function formatProveedorResponse(dbData, contextType, userMessage) {
  if (!dbData) {
    const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron proveedores en la base de datos. 
    Por favor, proporciona una respuesta amable y conversacional explicando que no hay datos disponibles y sugiere algunas 
    alternativas de consulta que podrían ser útiles.`;
    
    const aiResponse = await getDeepSeekResponse(prompt, null);
    return aiResponse || "No se encontraron proveedores que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
  }

  if (contextType === 'total_proveedores_provincia') {
    const prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData} proveedores en la provincia especificada.
    Por favor, proporciona una respuesta natural y conversacional que:
    1. Indique el número total de proveedores encontrados de manera amigable
    2. Ofrezca sugerencias para obtener más información sobre estos proveedores
    3. Mantenga un tono profesional pero cercano
    4. Incluya una pregunta abierta para continuar la conversación`;
    
    const aiResponse = await getDeepSeekResponse(prompt, { total: dbData });
    return aiResponse || `¡Hemos encontrado ${dbData} proveedores en la provincia especificada! ¿Te gustaría ver más detalles sobre alguno de ellos o prefieres buscar por algún otro criterio?`;
  }

  if (Array.isArray(dbData)) {
    if (dbData.length === 0) {
      const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron proveedores que coincidan con su búsqueda.
      Por favor, proporciona una respuesta amable y conversacional sugiriendo alternativas de búsqueda.`;
      
      const aiResponse = await getDeepSeekResponse(prompt, null);
      return aiResponse || "No se encontraron proveedores que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
    }

    let context = {
      tipo_consulta: contextType,
      total_resultados: dbData.length,
      datos: dbData.slice(0, 5) // Limitar a los primeros 5 resultados para el contexto
    };

    let prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData.length} proveedores. 
    Aquí están los datos relevantes: ${JSON.stringify(context)}.
    Por favor, proporciona una respuesta natural y conversacional que:
    1. Comience con una confirmación amigable de los resultados
    2. Presente los proveedores encontrados de manera clara y organizada
    3. Incluya los datos más relevantes de cada proveedor
    4. Termine con una pregunta o sugerencia para continuar la conversación
    5. Mantenga un tono profesional pero cercano
    
    Ejemplo de tono deseado:
    "¡Por supuesto! Aquí tienes la información que solicitaste...
    ¿Te gustaría saber más sobre alguno de estos proveedores o prefieres buscar por otro criterio?"`;

    const aiResponse = await getDeepSeekResponse(prompt, context);
    return aiResponse || formatBasicResponse(dbData, contextType);
  }

  const prompt = `El usuario preguntó: "${userMessage}" y se encontró el siguiente proveedor: ${JSON.stringify(dbData)}.
  Por favor, proporciona una respuesta natural y conversacional que:
  1. Comience con una confirmación amigable
  2. Describa al proveedor de manera clara y detallada
  3. Incluya todos los datos relevantes de manera organizada
  4. Termine con una pregunta o sugerencia para continuar la conversación
  5. Mantenga un tono profesional pero cercano
  
  Ejemplo de tono deseado:
  "¡Perfecto! Aquí tienes la información completa del proveedor...
  ¿Te gustaría saber algo más sobre este proveedor o prefieres buscar otro?"`;

  const aiResponse = await getDeepSeekResponse(prompt, dbData);
  return aiResponse || formatBasicResponse(dbData, contextType);
}

function formatBasicResponse(dbData, contextType) {
  if (Array.isArray(dbData)) {
    let response = `Se encontraron ${dbData.length} proveedores:\n\n`;
    dbData.slice(0, 5).forEach(proveedor => {
      response += `- ${proveedor.PR_DENO}\n`;
      response += `  Dirección: ${proveedor.PR_DOM}\n`;
      response += `  ${proveedor.PR_POB}, ${proveedor.PR_PROV}\n`;
      if (proveedor.PR_TEL) response += `  Teléfono: ${proveedor.PR_TEL}\n`;
      if (proveedor.PR_EMA) response += `  Email: ${proveedor.PR_EMA}\n`;
      response += '\n';
    });
    if (dbData.length > 5) {
      response += `\nY ${dbData.length - 5} proveedores más...`;
    }
    return response;
  } else {
    return `Proveedor:
Nombre: ${dbData.PR_DENO}
Dirección: ${dbData.PR_DOM}
${dbData.PR_POB}, ${dbData.PR_PROV}
${dbData.PR_CDP ? `Código Postal: ${dbData.PR_CDP}\n` : ''}
${dbData.PR_TEL ? `Teléfono: ${dbData.PR_TEL}\n` : ''}
${dbData.PR_FAX ? `Fax: ${dbData.PR_FAX}\n` : ''}
${dbData.PR_CIF ? `CIF: ${dbData.PR_CIF}\n` : ''}
${dbData.PR_EMA ? `Email: ${dbData.PR_EMA}\n` : ''}
${dbData.PR_WEB ? `Web: ${dbData.PR_WEB}\n` : ''}
${dbData.PR_DOMEN ? `Domicilio facturación: ${dbData.PR_DOMEN}\n` : ''}`;
  }
}

async function processProveedoresMessage(message) {
  const messageLower = message.toLowerCase();
  let dbData = null;
  let contextType = null;

  // Detectar consultas específicas
  if (messageLower.includes('cuántos') || 
      messageLower.includes('cuantos') || 
      messageLower.includes('total')) {
    if (messageLower.includes('provincia') || 
        messageLower.includes('almeria') ||
        messageLower.includes('murcia') ||
        messageLower.includes('alicante') ||
        messageLower.includes('granada')) {
      let provincia = messageLower.match(/(?:provincia|provincias)\s+(?:de\s+)?([a-záéíóúüñ]+)/i)?.[1] ||
                     messageLower.match(/(?:en|de)\s+([a-záéíóúüñ]+)/i)?.[1] ||
                     messageLower.match(/(almeria|murcia|alicante|granada)/i)?.[1];
      
      if (provincia) {
        const provinciasMap = {
          'almeria': 'ALMERIA',
          'murcia': 'MURCIA',
          'alicante': 'ALICANTE',
          'granada': 'GRANADA'
        };
        
        provincia = provinciasMap[provincia.toLowerCase()] || provincia.toUpperCase();
        dbData = await queryProveedoresPorProvincia(provincia);
        contextType = 'total_proveedores_provincia';
      }
    } else {
      dbData = await queryTotalProveedores();
      contextType = 'total_proveedores';
    }
  } else if (messageLower.includes('provincia') || 
             messageLower.includes('provincias') ||
             messageLower.includes('almeria') ||
             messageLower.includes('murcia') ||
             messageLower.includes('alicante') ||
             messageLower.includes('granada')) {
    let provincia = messageLower.match(/(?:provincia|provincias)\s+(?:de\s+)?([a-záéíóúüñ]+)/i)?.[1] ||
                   messageLower.match(/(?:en|de)\s+([a-záéíóúüñ]+)/i)?.[1] ||
                   messageLower.match(/(almeria|murcia|alicante|granada)/i)?.[1];
    
    if (provincia) {
      const provinciasMap = {
        'almeria': 'ALMERIA',
        'murcia': 'MURCIA',
        'alicante': 'ALICANTE',
        'granada': 'GRANADA'
      };
      
      provincia = provinciasMap[provincia.toLowerCase()] || provincia.toUpperCase();
      dbData = await queryProveedoresPorProvincia(provincia);
      contextType = 'proveedores_por_provincia';
    }
  } else if (messageLower.includes('población') || 
             messageLower.includes('poblacion') ||
             messageLower.includes('ciudad')) {
    const poblacion = messageLower.match(/(?:población|poblacion|ciudad)\s+([a-záéíóúüñ]+)/i)?.[1];
    if (poblacion) {
      dbData = await queryProveedoresPorPoblacion(poblacion);
      contextType = 'proveedores_por_poblacion';
    }
  } else if (messageLower.includes('cif')) {
    const cif = messageLower.match(/cif\s+([a-z0-9]+)/i)?.[1];
    if (cif) {
      dbData = await queryProveedorPorCIF(cif);
      contextType = 'proveedor_por_cif';
    }
  } else if (messageLower.includes('empiezan') || 
             messageLower.includes('inicial') ||
             messageLower.includes('letra')) {
    const letra = messageLower.match(/(?:empiezan|inicial|letra)\s+([a-z])/i)?.[1];
    if (letra) {
      dbData = await queryProveedoresPorInicial(letra);
      contextType = 'proveedores_por_inicial';
    }
  } else if (messageLower.includes('email') || 
             messageLower.includes('correo') ||
             messageLower.includes('mail')) {
    dbData = await queryProveedoresConEmail();
    contextType = 'proveedores_con_email';
  } else if (messageLower.includes('ejemplo') || 
             messageLower.includes('muestra') ||
             messageLower.includes('muéstrame')) {
    const limite = messageLower.match(/(?:ejemplo|muestra|muéstrame)\s+(\d+)/i)?.[1] || 5;
    dbData = await queryProveedoresEjemplo(parseInt(limite));
    contextType = 'proveedores_ejemplo';
  } else {
    // Búsqueda por nombre
    const palabrasClave = messageLower.split(' ').filter(p => p.length > 3);
    if (palabrasClave.length > 0) {
      dbData = await queryProveedoresPorNombre(palabrasClave.join(' '));
      contextType = 'proveedores_por_nombre';
    }
  }

  return {
    message: await formatProveedorResponse(dbData, contextType, message),
    contextType,
    data: dbData
  };
}

module.exports = {
  processProveedoresMessage
};
