const db = require('../db');
const axios = require('axios');

// Configuración de la API de DeepSeek
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Prompt base para la IA
const SYSTEM_PROMPT = `Eres un asistente virtual de Semilleros Deitana S.L., especializado en proporcionar información detallada sobre los artículos del inventario.

Tu Objetivo Principal: Analizar la consulta del usuario, identificar qué información específica necesita sobre los artículos, y ejecutar la consulta SQL correspondiente para obtener los datos exactos de la base de datos.

REGLA FUNDAMENTAL:
1. NUNCA inventes datos o respuestas
2. SIEMPRE consulta la base de datos para obtener información real
3. Proporciona respuestas precisas basadas en los datos reales

Estructura de la Base de Datos:
- articulos: Registro principal de artículos
  * id: Código único del artículo
  * AR_DENO: Denominación o descripción del artículo
  * AR_BAR: Código de barras
  * AR_TIVA: Tipo de IVA
  * AR_GRP: Código del grupo
  * AR_FAM: Código de la familia
  * AR_PRV: Código del proveedor
  * AR_PGE: % de germinación

- proveedores: Información de proveedores
  * id: ID del proveedor
  * PR_DENO: Nombre del proveedor

Proceso de Respuesta:
1. Analiza la consulta del usuario para entender qué información necesita
2. Identifica qué tablas y campos son relevantes
3. Ejecuta la consulta SQL apropiada
4. Procesa los resultados
5. Proporciona una respuesta clara y precisa

Ejemplos de Consultas y Respuestas:
- "¿Cuántos artículos tenemos en total?"
  * Consulta: SELECT COUNT(*) FROM articulos
  * Respuesta: "Existen X artículos en total en el inventario"

- "¿Quién provee el artículo X?"
  * Consulta: SELECT a.*, p.PR_DENO FROM articulos a LEFT JOIN proveedores p ON a.AR_PRV = p.id WHERE a.id = 'X'
  * Respuesta: "El artículo X es provisto por [nombre del proveedor]"

- "¿Qué tipos de tomates tenemos?"
  * Consulta: SELECT * FROM articulos WHERE AR_DENO LIKE '%TOMATE%'
  * Respuesta: "Tenemos los siguientes tipos de tomates: [lista de variedades]"

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
async function queryTotalArticulos() {
  const query = `SELECT COUNT(*) as total FROM articulos`;
  try {
    const [results] = await db.query(query);
    return results[0].total;
  } catch (error) {
    console.error('Error al contar artículos:', error);
    return null;
  }
}

async function queryArticuloPorId(id) {
  const query = `
    SELECT 
      a.*,
      p.PR_DENO as proveedor_nombre
    FROM articulos a
    LEFT JOIN proveedores p ON a.AR_PRV = p.id
    WHERE a.id = ?`;
  try {
    const [results] = await db.query(query, [id]);
    return results[0] || null;
  } catch (error) {
    console.error('Error al consultar artículo por ID:', error);
    return null;
  }
}

async function queryArticulosPorNombre(nombre) {
  const query = `
    SELECT 
      a.*,
      p.PR_DENO as proveedor_nombre
    FROM articulos a
    LEFT JOIN proveedores p ON a.AR_PRV = p.id
    WHERE UPPER(a.AR_DENO) LIKE UPPER(?)
    ORDER BY a.AR_DENO`;
  try {
    const [results] = await db.query(query, [`%${nombre}%`]);
    return results;
  } catch (error) {
    console.error('Error al consultar artículos por nombre:', error);
    return null;
  }
}

async function queryArticulosPorProveedor(proveedorId) {
  const query = `
    SELECT 
      a.*,
      p.PR_DENO as proveedor_nombre
    FROM articulos a
    LEFT JOIN proveedores p ON a.AR_PRV = p.id
    WHERE a.AR_PRV = ?
    ORDER BY a.AR_DENO`;
  try {
    const [results] = await db.query(query, [proveedorId]);
    return results;
  } catch (error) {
    console.error('Error al consultar artículos por proveedor:', error);
    return null;
  }
}

async function queryArticulosPorGrupo(grupo) {
  const query = `
    SELECT 
      a.*,
      p.PR_DENO as proveedor_nombre
    FROM articulos a
    LEFT JOIN proveedores p ON a.AR_PRV = p.id
    WHERE a.AR_GRP = ?
    ORDER BY a.AR_DENO`;
  try {
    const [results] = await db.query(query, [grupo]);
    return results;
  } catch (error) {
    console.error('Error al consultar artículos por grupo:', error);
    return null;
  }
}

async function queryArticuloEjemplo() {
  const query = `
    SELECT 
      a.*,
      p.PR_DENO as proveedor_nombre
    FROM articulos a
    LEFT JOIN proveedores p ON a.AR_PRV = p.id
    ORDER BY RAND()
    LIMIT 1`;
  try {
    const [results] = await db.query(query);
    return results[0] || null;
  } catch (error) {
    console.error('Error al consultar artículo de ejemplo:', error);
    return null;
  }
}

async function formatArticuloResponse(dbData, contextType, userMessage) {
  if (!dbData) {
    const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron artículos en la base de datos. 
    Por favor, proporciona una respuesta amable y profesional explicando que no hay datos disponibles y sugiere algunas 
    alternativas de consulta que podrían ser útiles.`;
    
    const aiResponse = await getDeepSeekResponse(prompt, null);
    return aiResponse || "No se encontraron artículos que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
  }

  if (Array.isArray(dbData)) {
    if (dbData.length === 0) {
      const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron artículos que coincidan con su búsqueda.
      Por favor, proporciona una respuesta amable y profesional sugiriendo alternativas de búsqueda.`;
      
      const aiResponse = await getDeepSeekResponse(prompt, null);
      return aiResponse || "No se encontraron artículos que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
    }

    let context = {
      tipo_consulta: contextType,
      total_resultados: dbData.length,
      datos: dbData
    };

    let prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData.length} artículos. 
    Aquí están los datos relevantes: ${JSON.stringify(context)}.
    Por favor, proporciona una respuesta natural y profesional que incluya:
    1. Un resumen de los resultados encontrados
    2. Los detalles más relevantes de los artículos encontrados
    3. Información sobre los proveedores si está disponible
    4. Sugerencias de análisis o próximos pasos`;

    const aiResponse = await getDeepSeekResponse(prompt, context);
    return aiResponse || formatBasicResponse(dbData, contextType);
  }

  const prompt = `El usuario preguntó: "${userMessage}" y se encontró el siguiente artículo: ${JSON.stringify(dbData)}.
  Por favor, proporciona una respuesta natural y profesional que:
  1. Describa el artículo de manera clara y detallada
  2. Mencione su código, descripción y código de barras si está disponible
  3. Indique quién es el proveedor si está disponible
  4. Proporcione información sobre el porcentaje de germinación si está disponible
  5. Sugiera posibles próximos pasos o información relacionada`;

  const aiResponse = await getDeepSeekResponse(prompt, dbData);
  return aiResponse || formatBasicResponse(dbData, contextType);
}

function formatBasicResponse(dbData, contextType) {
  if (Array.isArray(dbData)) {
    let response = `Se encontraron ${dbData.length} artículos:\n\n`;
    dbData.slice(0, 5).forEach(art => {
      response += `- ${art.AR_DENO} (Código: ${art.id})\n`;
      if (art.proveedor_nombre) {
        response += `  Proveedor: ${art.proveedor_nombre}\n`;
      }
    });
    if (dbData.length > 5) {
      response += `\nY ${dbData.length - 5} artículos más...`;
    }
    return response;
  } else {
    return `Artículo:
Código: ${dbData.id}
Descripción: ${dbData.AR_DENO}
${dbData.AR_BAR ? `Código de barras: ${dbData.AR_BAR}\n` : ''}
${dbData.proveedor_nombre ? `Proveedor: ${dbData.proveedor_nombre}\n` : ''}
${dbData.AR_PGE ? `% Germinación: ${dbData.AR_PGE}%\n` : ''}`;
  }
}

async function processArticulosMessage(message) {
  const messageLower = message.toLowerCase();
  let dbData = null;
  let contextType = null;

  // Detectar consultas específicas
  if (messageLower.includes('cuántos') || 
      messageLower.includes('cuantos') || 
      messageLower.includes('total')) {
    dbData = await queryTotalArticulos();
    contextType = 'total_articulos';
  } else if (messageLower.includes('código') || 
             messageLower.includes('codigo')) {
    const codigo = messageLower.match(/(?:código|codigo)\s+([a-z0-9]+)/i)?.[1];
    if (codigo) {
      dbData = await queryArticuloPorId(codigo);
      contextType = 'articulo_por_id';
    }
  } else if (messageLower.includes('proveedor') || 
             messageLower.includes('proveedores') ||
             messageLower.includes('quién provee') ||
             messageLower.includes('quien provee')) {
    // Extraer el nombre del artículo después de "proveedor" o "quién provee"
    const nombreArticulo = messageLower.replace(/(?:proveedor|proveedores|quién provee|quien provee)\s+/i, '').trim();
    if (nombreArticulo) {
      dbData = await queryArticulosPorNombre(nombreArticulo);
      contextType = 'articulos_por_nombre';
    }
  } else if (messageLower.includes('grupo') || 
             messageLower.includes('grupos')) {
    const grupo = messageLower.match(/(?:grupo|grupos)\s+([a-z0-9]+)/i)?.[1];
    if (grupo) {
      dbData = await queryArticulosPorGrupo(grupo);
      contextType = 'articulos_por_grupo';
    }
  } else if (messageLower.includes('ejemplo') || 
             messageLower.includes('muestra') ||
             messageLower.includes('muéstrame')) {
    dbData = await queryArticuloEjemplo();
    contextType = 'articulo_ejemplo';
  } else {
    // Búsqueda por nombre o descripción
    const palabrasClave = messageLower.split(' ').filter(p => p.length > 3);
    if (palabrasClave.length > 0) {
      dbData = await queryArticulosPorNombre(palabrasClave.join(' '));
      contextType = 'articulos_por_nombre';
    }
  }

  return {
    message: await formatArticuloResponse(dbData, contextType, message),
    contextType,
    data: dbData
  };
}

module.exports = {
  processArticulosMessage,
  queryTotalArticulos,
  queryArticuloPorId,
  queryArticulosPorNombre,
  queryArticulosPorProveedor,
  queryArticulosPorGrupo,
  queryArticuloEjemplo
};
