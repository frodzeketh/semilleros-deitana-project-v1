const db = require('../db');
const axios = require('axios');

// Configuración de la API de DeepSeek
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Prompt base para la IA
const SYSTEM_PROMPT = `Eres un asistente virtual de Semilleros Deitana S.L., especializado en proporcionar información detallada sobre los clientes de la empresa.

Tu Objetivo Principal: Analizar la consulta del usuario, identificar qué información específica necesita sobre los clientes, y ejecutar la consulta SQL correspondiente para obtener los datos exactos de la base de datos.

REGLA FUNDAMENTAL:
1. NUNCA inventes datos o respuestas
2. SIEMPRE consulta la base de datos para obtener información real
3. Proporciona respuestas precisas basadas en los datos reales

Estructura de la Base de Datos:
- clientes: Registro principal de clientes
  * id: Código único del cliente
  * CL_DENO: Denominación o nombre completo del cliente
  * CL_DOM: Domicilio del cliente
  * CL_POB: Población del cliente
  * CL_PROV: Provincia del cliente
  * CL_CDP: Código postal del cliente
  * CL_TEL: Número(s) de teléfono del cliente
  * CL_FAX: Número de FAX del cliente
  * CL_CIF: Código de Identificación Fiscal (CIF)
  * CL_EMA: Dirección de correo electrónico
  * CL_WEB: Dirección web
  * CL_PAIS: País de residencia

Proceso de Respuesta:
1. Analiza la consulta del usuario para entender qué información necesita
2. Identifica qué campos son relevantes
3. Ejecuta la consulta SQL apropiada
4. Procesa los resultados
5. Proporciona una respuesta clara y precisa

Ejemplos de Consultas y Respuestas:
- "¿Cuántos clientes hay en Murcia?"
  * Consulta: SELECT COUNT(*) FROM clientes WHERE CL_PROV = 'MURCIA'
  * Respuesta: "Existen X clientes en la provincia de Murcia"

- "¿Quién es el cliente con CIF 23228695Y?"
  * Consulta: SELECT * FROM clientes WHERE CL_CIF = '23228695Y'
  * Respuesta: "El cliente con CIF 23228695Y es [nombre del cliente]"

- "Muestra clientes de Lorca"
  * Consulta: SELECT * FROM clientes WHERE CL_POB = 'LORCA' LIMIT 5
  * Respuesta: "En Lorca tenemos los siguientes clientes: [lista de clientes]"

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
async function queryTotalClientes() {
  const query = `SELECT COUNT(*) as total FROM clientes`;
  try {
    const [results] = await db.query(query);
    return results[0].total;
  } catch (error) {
    console.error('Error al contar clientes:', error);
    return null;
  }
}

async function queryClientePorId(id) {
  const query = `SELECT * FROM clientes WHERE id = ?`;
  try {
    const [results] = await db.query(query, [id]);
    return results[0] || null;
  } catch (error) {
    console.error('Error al consultar cliente por ID:', error);
    return null;
  }
}

async function queryClientesPorProvincia(provincia) {
  const query = `SELECT * FROM clientes WHERE UPPER(CL_PROV) = UPPER(?) ORDER BY CL_DENO`;
  try {
    const [results] = await db.query(query, [provincia]);
    return results;
  } catch (error) {
    console.error('Error al consultar clientes por provincia:', error);
    return null;
  }
}

async function queryClientesPorPoblacion(poblacion) {
  const query = `SELECT * FROM clientes WHERE CL_POB = ? ORDER BY CL_DENO`;
  try {
    const [results] = await db.query(query, [poblacion.toUpperCase()]);
    return results;
  } catch (error) {
    console.error('Error al consultar clientes por población:', error);
    return null;
  }
}

async function queryClientePorCIF(cif) {
  const query = `SELECT * FROM clientes WHERE CL_CIF = ?`;
  try {
    const [results] = await db.query(query, [cif]);
    return results[0] || null;
  } catch (error) {
    console.error('Error al consultar cliente por CIF:', error);
    return null;
  }
}

async function queryClientesPorNombre(nombre) {
  const query = `SELECT * FROM clientes WHERE CL_DENO LIKE ? ORDER BY CL_DENO`;
  try {
    const [results] = await db.query(query, [`%${nombre}%`]);
    return results;
  } catch (error) {
    console.error('Error al consultar clientes por nombre:', error);
    return null;
  }
}

async function queryClientesPorInicial(letra) {
  const query = `SELECT * FROM clientes WHERE CL_DENO LIKE ? ORDER BY CL_DENO`;
  try {
    const [results] = await db.query(query, [`${letra.toUpperCase()}%`]);
    return results;
  } catch (error) {
    console.error('Error al consultar clientes por inicial:', error);
    return null;
  }
}

async function queryClientesEjemplo(limite = 5) {
  const query = `SELECT * FROM clientes ORDER BY CL_DENO LIMIT ?`;
  try {
    const [results] = await db.query(query, [limite]);
    return results;
  } catch (error) {
    console.error('Error al consultar clientes de ejemplo:', error);
    return null;
  }
}

async function queryTotalClientesPorProvincia(provincia) {
  const query = `SELECT COUNT(*) as total FROM clientes WHERE UPPER(CL_PROV) = UPPER(?)`;
  try {
    const [results] = await db.query(query, [provincia]);
    return results[0].total;
  } catch (error) {
    console.error('Error al contar clientes por provincia:', error);
    return null;
  }
}

async function formatClienteResponse(dbData, contextType, userMessage) {
  if (!dbData) {
    const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron clientes en la base de datos. 
    Por favor, proporciona una respuesta amable y profesional explicando que no hay datos disponibles y sugiere algunas 
    alternativas de consulta que podrían ser útiles.`;
    
    const aiResponse = await getDeepSeekResponse(prompt, null);
    return aiResponse || "No se encontraron clientes que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
  }

  if (contextType === 'total_clientes_provincia') {
    const prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData} clientes en la provincia especificada.
    Por favor, proporciona una respuesta natural y profesional que:
    1. Indique el número total de clientes encontrados
    2. Ofrezca sugerencias para obtener más información sobre estos clientes
    3. Mantenga un tono profesional pero amigable`;
    
    const aiResponse = await getDeepSeekResponse(prompt, { total: dbData });
    return aiResponse || `Se encontraron ${dbData} clientes en la provincia especificada. ¿Te gustaría ver más detalles sobre alguno de ellos?`;
  }

  if (Array.isArray(dbData)) {
    if (dbData.length === 0) {
      const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron clientes que coincidan con su búsqueda.
      Por favor, proporciona una respuesta amable y profesional sugiriendo alternativas de búsqueda.`;
      
      const aiResponse = await getDeepSeekResponse(prompt, null);
      return aiResponse || "No se encontraron clientes que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
    }

    let context = {
      tipo_consulta: contextType,
      total_resultados: dbData.length,
      datos: dbData
    };

    let prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData.length} clientes. 
    Aquí están los datos relevantes: ${JSON.stringify(context)}.
    Por favor, proporciona una respuesta natural y profesional que incluya:
    1. Un resumen de los resultados encontrados
    2. Los detalles más relevantes de los clientes encontrados
    3. Información sobre su ubicación y datos de contacto
    4. Sugerencias de análisis o próximos pasos`;

    const aiResponse = await getDeepSeekResponse(prompt, context);
    return aiResponse || formatBasicResponse(dbData, contextType);
  }

  const prompt = `El usuario preguntó: "${userMessage}" y se encontró el siguiente cliente: ${JSON.stringify(dbData)}.
  Por favor, proporciona una respuesta natural y profesional que:
  1. Describa al cliente de manera clara y detallada
  2. Mencione su nombre, dirección y datos de contacto
  3. Incluya información sobre su ubicación (población, provincia)
  4. Proporcione datos fiscales si están disponibles
  5. Sugiera posibles próximos pasos o información relacionada`;

  const aiResponse = await getDeepSeekResponse(prompt, dbData);
  return aiResponse || formatBasicResponse(dbData, contextType);
}

function formatBasicResponse(dbData, contextType) {
  if (Array.isArray(dbData)) {
    let response = `Se encontraron ${dbData.length} clientes:\n\n`;
    dbData.slice(0, 5).forEach(cliente => {
      response += `- ${cliente.CL_DENO}\n`;
      response += `  Dirección: ${cliente.CL_DOM}\n`;
      response += `  ${cliente.CL_POB}, ${cliente.CL_PROV}\n`;
      if (cliente.CL_TEL) response += `  Teléfono: ${cliente.CL_TEL}\n`;
      if (cliente.CL_EMA) response += `  Email: ${cliente.CL_EMA}\n`;
      response += '\n';
    });
    if (dbData.length > 5) {
      response += `\nY ${dbData.length - 5} clientes más...`;
    }
    return response;
  } else {
    return `Cliente:
Nombre: ${dbData.CL_DENO}
Dirección: ${dbData.CL_DOM}
${dbData.CL_POB}, ${dbData.CL_PROV}
${dbData.CL_CDP ? `Código Postal: ${dbData.CL_CDP}\n` : ''}
${dbData.CL_TEL ? `Teléfono: ${dbData.CL_TEL}\n` : ''}
${dbData.CL_FAX ? `Fax: ${dbData.CL_FAX}\n` : ''}
${dbData.CL_CIF ? `CIF: ${dbData.CL_CIF}\n` : ''}
${dbData.CL_EMA ? `Email: ${dbData.CL_EMA}\n` : ''}
${dbData.CL_WEB ? `Web: ${dbData.CL_WEB}\n` : ''}
${dbData.CL_PAIS ? `País: ${dbData.CL_PAIS}\n` : ''}`;
  }
}

async function processClientesMessage(message) {
  const messageLower = message.toLowerCase();
  let dbData = null;
  let contextType = null;

  // Detectar consultas específicas
  if (messageLower.includes('cuántos') || 
      messageLower.includes('cuantos') || 
      messageLower.includes('total')) {
    if (messageLower.includes('provincia') || 
        messageLower.includes('murcia') ||
        messageLower.includes('almería') ||
        messageLower.includes('alicante') ||
        messageLower.includes('granada')) {
      let provincia = messageLower.match(/(?:provincia|provincias)\s+(?:de\s+)?([a-záéíóúüñ]+)/i)?.[1] ||
                     messageLower.match(/(?:en|de)\s+([a-záéíóúüñ]+)/i)?.[1] ||
                     messageLower.match(/(murcia|almería|alicante|granada)/i)?.[1];
      
      if (provincia) {
        const provinciasMap = {
          'murcia': 'MURCIA',
          'almeria': 'ALMERIA',
          'alicante': 'ALICANTE',
          'granada': 'GRANADA'
        };
        
        provincia = provinciasMap[provincia.toLowerCase()] || provincia.toUpperCase();
        dbData = await queryTotalClientesPorProvincia(provincia);
        contextType = 'total_clientes_provincia';
      }
    } else {
      dbData = await queryTotalClientes();
      contextType = 'total_clientes';
    }
  } else if (messageLower.includes('provincia') || 
             messageLower.includes('provincias') ||
             messageLower.includes('murcia') ||
             messageLower.includes('almería') ||
             messageLower.includes('alicante') ||
             messageLower.includes('granada')) {
    // Extraer la provincia de diferentes formas
    let provincia = messageLower.match(/(?:provincia|provincias)\s+(?:de\s+)?([a-záéíóúüñ]+)/i)?.[1] ||
                   messageLower.match(/(?:en|de)\s+([a-záéíóúüñ]+)/i)?.[1] ||
                   messageLower.match(/(murcia|almería|alicante|granada)/i)?.[1];
    
    if (provincia) {
      // Normalizar nombres de provincias
      const provinciasMap = {
        'murcia': 'MURCIA',
        'almeria': 'ALMERIA',
        'alicante': 'ALICANTE',
        'granada': 'GRANADA'
      };
      
      provincia = provinciasMap[provincia.toLowerCase()] || provincia.toUpperCase();
      dbData = await queryClientesPorProvincia(provincia);
      contextType = 'clientes_por_provincia';
    }
  } else if (messageLower.includes('población') || 
             messageLower.includes('poblacion') ||
             messageLower.includes('ciudad')) {
    const poblacion = messageLower.match(/(?:población|poblacion|ciudad)\s+([a-záéíóúüñ]+)/i)?.[1];
    if (poblacion) {
      dbData = await queryClientesPorPoblacion(poblacion);
      contextType = 'clientes_por_poblacion';
    }
  } else if (messageLower.includes('cif')) {
    const cif = messageLower.match(/cif\s+([a-z0-9]+)/i)?.[1];
    if (cif) {
      dbData = await queryClientePorCIF(cif);
      contextType = 'cliente_por_cif';
    }
  } else if (messageLower.includes('empiezan') || 
             messageLower.includes('inicial') ||
             messageLower.includes('letra')) {
    const letra = messageLower.match(/(?:empiezan|inicial|letra)\s+([a-z])/i)?.[1];
    if (letra) {
      dbData = await queryClientesPorInicial(letra);
      contextType = 'clientes_por_inicial';
    }
  } else if (messageLower.includes('ejemplo') || 
             messageLower.includes('muestra') ||
             messageLower.includes('muéstrame')) {
    const limite = messageLower.match(/(?:ejemplo|muestra|muéstrame)\s+(\d+)/i)?.[1] || 5;
    dbData = await queryClientesEjemplo(parseInt(limite));
    contextType = 'clientes_ejemplo';
  } else {
    // Búsqueda por nombre
    const palabrasClave = messageLower.split(' ').filter(p => p.length > 3);
    if (palabrasClave.length > 0) {
      dbData = await queryClientesPorNombre(palabrasClave.join(' '));
      contextType = 'clientes_por_nombre';
    }
  }

  return {
    message: await formatClienteResponse(dbData, contextType, message),
    contextType,
    data: dbData
  };
}

module.exports = {
  processClientesMessage
};
