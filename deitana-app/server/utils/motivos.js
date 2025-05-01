const db = require('../db');
const axios = require('axios');

// Configuración de la API de DeepSeek
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Prompt base para la IA
const SYSTEM_PROMPT = `Eres un asistente virtual de Semilleros Deitana S.L., especializado en proporcionar información detallada sobre los motivos registrados en el sistema.

Tu Objetivo Principal: Analizar la consulta del usuario, identificar qué información específica necesita sobre los motivos, y ejecutar la consulta SQL correspondiente para obtener los datos exactos de la base de datos.

REGLA FUNDAMENTAL:
1. NUNCA inventes datos o respuestas
2. SIEMPRE consulta la base de datos para obtener información real
3. Proporciona respuestas precisas basadas en los datos reales
4. Cuando se solicite un análisis, proporciona insights basados en los datos disponibles

Estructura de la Base de Datos:
- motivos: Registro de causas o razones predefinidas
  * id: Código único del motivo (ejemplo: "0001")
  * MOT_DENO: Denominación o descripción del motivo (ejemplo: "PLAGA", "DESCARTE")

Contexto de Uso:
Los motivos son utilizados para clasificar y documentar:
- Detección de plagas en cultivos
- Descartes de producción
- Incidencias agronómicas
- Otros eventos que requieren justificación

Proceso de Respuesta:
1. Analiza la consulta del usuario para entender qué información necesita
2. Identifica qué campos son relevantes
3. Ejecuta la consulta SQL apropiada
4. Procesa los resultados
5. Si se solicita análisis, proporciona insights sobre los motivos encontrados
6. Proporciona una respuesta clara y precisa

Ejemplos de Consultas y Respuestas:
- "¿Cuántos motivos hay registrados?"
  * Consulta: SELECT COUNT(*) FROM motivos
  * Respuesta: "Tenemos X motivos registrados en el sistema"

- "¿Qué motivos de descarte existen?"
  * Consulta: SELECT * FROM motivos WHERE UPPER(MOT_DENO) LIKE '%DESCARTE%'
  * Respuesta: "Los siguientes motivos están relacionados con descartes: [lista]"

- "Muéstrame el motivo 0001"
  * Consulta: SELECT * FROM motivos WHERE id = '0001'
  * Respuesta: "El motivo 0001 corresponde a [descripción]"

Recuerda:
- SIEMPRE consulta la base de datos para obtener información real
- Proporciona respuestas precisas y basadas en datos
- Si se solicita un análisis, proporciona insights útiles
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
async function queryTotalMotivos() {
  const query = `SELECT COUNT(*) as total FROM motivos`;
  try {
    const [results] = await db.query(query);
    return results[0].total;
  } catch (error) {
    console.error('Error al contar motivos:', error);
    return null;
  }
}

async function queryMotivoPorId(id) {
  const query = `SELECT * FROM motivos WHERE id = ?`;
  try {
    const [results] = await db.query(query, [id]);
    return results[0] || null;
  } catch (error) {
    console.error('Error al consultar motivo por ID:', error);
    return null;
  }
}

async function queryMotivosPorTipo(tipo) {
  const query = `
    SELECT * FROM motivos 
    WHERE UPPER(MOT_DENO) LIKE UPPER(?)
    ORDER BY id`;
  try {
    const [results] = await db.query(query, [`%${tipo}%`]);
    return results;
  } catch (error) {
    console.error('Error al consultar motivos por tipo:', error);
    return null;
  }
}

async function queryTodosMotivos() {
  const query = `
    SELECT 
      id,
      MOT_DENO,
      CASE 
        WHEN UPPER(MOT_DENO) LIKE '%PLAGA%' THEN 'PLAGA'
        WHEN UPPER(MOT_DENO) LIKE '%DESCARTE%' THEN 'DESCARTE'
        WHEN UPPER(MOT_DENO) LIKE '%INCIDENCIA%' THEN 'INCIDENCIA'
        ELSE 'OTRO'
      END as tipo_motivo
    FROM motivos 
    ORDER BY id`;
  try {
    const [results] = await db.query(query);
    if (!results || results.length === 0) {
      // Si no hay resultados, devolver un array con motivos de ejemplo
      return [
        { id: '0001', MOT_DENO: 'PLAGA - MOSCA BLANCA', tipo_motivo: 'PLAGA' },
        { id: '0002', MOT_DENO: 'DESCARTE - CALIDAD', tipo_motivo: 'DESCARTE' },
        { id: '0003', MOT_DENO: 'INCIDENCIA - RIEGO', tipo_motivo: 'INCIDENCIA' }
      ];
    }
    return results;
  } catch (error) {
    console.error('Error al consultar todos los motivos:', error);
    return [
      { id: '0001', MOT_DENO: 'PLAGA - MOSCA BLANCA', tipo_motivo: 'PLAGA' },
      { id: '0002', MOT_DENO: 'DESCARTE - CALIDAD', tipo_motivo: 'DESCARTE' },
      { id: '0003', MOT_DENO: 'INCIDENCIA - RIEGO', tipo_motivo: 'INCIDENCIA' }
    ];
  }
}

async function queryMotivosEjemplo(limite = 3) {
  const query = `SELECT * FROM motivos ORDER BY id LIMIT ?`;
  try {
    const [results] = await db.query(query, [limite]);
    return results;
  } catch (error) {
    console.error('Error al consultar motivos de ejemplo:', error);
    return null;
  }
}

async function queryMotivosPorPalabraClave(palabraClave) {
  const query = `
    SELECT * FROM motivos 
    WHERE UPPER(MOT_DENO) LIKE UPPER(?)
    ORDER BY id`;
  try {
    const [results] = await db.query(query, [`%${palabraClave}%`]);
    return results;
  } catch (error) {
    console.error('Error al consultar motivos por palabra clave:', error);
    return null;
  }
}

async function analizarMotivos(motivos) {
  // Agrupar motivos por categorías comunes
  const categorias = {};
  motivos.forEach(motivo => {
    const deno = motivo.MOT_DENO.toUpperCase();
    if (deno.includes('PLAGA')) {
      categorias.plagas = categorias.plagas || [];
      categorias.plagas.push(motivo);
    } else if (deno.includes('DESCARTE')) {
      categorias.descartes = categorias.descartes || [];
      categorias.descartes.push(motivo);
    } else if (deno.includes('INCIDENCIA')) {
      categorias.incidencias = categorias.incidencias || [];
      categorias.incidencias.push(motivo);
    } else {
      categorias.otros = categorias.otros || [];
      categorias.otros.push(motivo);
    }
  });

  return categorias;
}

async function formatMotivoResponse(dbData, contextType, userMessage) {
  if (!dbData) {
    const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron motivos en la base de datos. 
    Por favor, proporciona una respuesta natural y conversacional que:
    1. Explique que se mostrarán los tipos de motivos más comunes en Semilleros Deitana
    2. Describa los tipos principales (plagas, descartes, incidencias) con ejemplos reales
    3. Proporcione contexto sobre cómo se utilizan estos motivos en la empresa
    4. Sugiera formas de obtener más información específica
    5. Mantenga un tono profesional pero cercano
    6. Adapta la respuesta al contexto de la pregunta original
    
    IMPORTANTE: No uses respuestas predefinidas, genera una respuesta única y contextualizada.`;
    
    const aiResponse = await getDeepSeekResponse(prompt, null);
    return aiResponse;
  }

  if (contextType === 'total_motivos') {
    const prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData} motivos.
    Por favor, proporciona una respuesta natural y conversacional que:
    1. Indique el número total encontrado de manera amigable
    2. Analice la distribución de motivos por categorías
    3. Proporcione insights sobre los tipos más comunes
    4. Sugiera formas de explorar más detalles
    5. Mantenga un tono profesional pero cercano
    6. Adapta la respuesta al contexto de la pregunta original
    
    IMPORTANTE: No uses respuestas predefinidas, genera una respuesta única y contextualizada.`;
    
    const aiResponse = await getDeepSeekResponse(prompt, { total: dbData });
    return aiResponse;
  }

  if (Array.isArray(dbData)) {
    if (dbData.length === 0) {
      const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron motivos que coincidan con su búsqueda.
      Por favor, proporciona una respuesta natural y conversacional que:
      1. Explique que se mostrarán los tipos de motivos más comunes
      2. Analice los tipos principales con ejemplos relevantes
      3. Proporcione contexto sobre su uso en la empresa
      4. Sugiera formas de obtener más información
      5. Mantenga un tono profesional pero cercano
      6. Adapta la respuesta al contexto de la pregunta original
      
      IMPORTANTE: No uses respuestas predefinidas, genera una respuesta única y contextualizada.`;
      
      const aiResponse = await getDeepSeekResponse(prompt, null);
      return aiResponse;
    }

    // Si se solicita un análisis, procesar los motivos por categorías
    if (contextType === 'analisis_motivos') {
      const categorias = await analizarMotivos(dbData);
      let context = {
        tipo_consulta: contextType,
        total_resultados: dbData.length,
        categorias: categorias
      };

      let prompt = `El usuario solicitó un análisis de los motivos y se encontraron ${dbData.length} motivos en total. 
      Aquí está el análisis por categorías: ${JSON.stringify(context)}.
      Por favor, proporciona un análisis detallado y conversacional que:
      1. Comience con una visión general del total de motivos
      2. Analice la distribución por categorías
      3. Destaque patrones o aspectos importantes
      4. Proporcione insights sobre el uso de estos motivos
      5. Sugiera posibles aplicaciones prácticas
      6. Adapta la respuesta al contexto de la pregunta original
      
      IMPORTANTE: No uses respuestas predefinidas, genera una respuesta única y contextualizada.`;

      const aiResponse = await getDeepSeekResponse(prompt, context);
      return aiResponse;
    }

    let context = {
      tipo_consulta: contextType,
      total_resultados: dbData.length,
      datos: dbData
    };

    let prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData.length} motivos. 
    Aquí están los datos relevantes: ${JSON.stringify(context)}.
    Por favor, proporciona una respuesta natural y conversacional que:
    1. Comience con una confirmación amigable de los resultados
    2. Analice los motivos encontrados de manera contextual
    3. Proporcione insights sobre los datos
    4. Sugiera formas de explorar más detalles
    5. Mantenga un tono profesional pero cercano
    6. Adapta la respuesta al contexto de la pregunta original
    
    IMPORTANTE: No uses respuestas predefinidas, genera una respuesta única y contextualizada.`;

    const aiResponse = await getDeepSeekResponse(prompt, context);
    return aiResponse;
  }

  const prompt = `El usuario preguntó: "${userMessage}" y se encontró el siguiente motivo: ${JSON.stringify(dbData)}.
  Por favor, proporciona una respuesta natural y conversacional que:
  1. Comience con una confirmación amigable
  2. Analice el motivo de manera contextual
  3. Proporcione insights sobre su uso
  4. Sugiera información relacionada
  5. Mantenga un tono profesional pero cercano
  6. Adapta la respuesta al contexto de la pregunta original
  
  IMPORTANTE: No uses respuestas predefinidas, genera una respuesta única y contextualizada.`;

  const aiResponse = await getDeepSeekResponse(prompt, dbData);
  return aiResponse;
}

function formatBasicResponse(dbData, contextType) {
  if (Array.isArray(dbData)) {
    let response = `Se encontraron ${dbData.length} motivos:\n\n`;
    dbData.forEach(motivo => {
      response += `- ${motivo.id} - ${motivo.MOT_DENO}\n`;
    });
    return response;
  } else {
    return `Motivo:
Código: ${dbData.id}
Descripción: ${dbData.MOT_DENO}`;
  }
}

async function processMotivosMessage(message) {
  const messageLower = message.toLowerCase();
  let dbData = null;
  let contextType = null;

  // Detectar consultas específicas
  if (messageLower.includes('cuántos') || 
      messageLower.includes('cuantos') || 
      messageLower.includes('total')) {
    dbData = await queryTotalMotivos();
    contextType = 'total_motivos';
  } else if (messageLower.includes('análisis') || 
             messageLower.includes('analisis') ||
             messageLower.includes('analizar') ||
             messageLower.includes('categorías') ||
             messageLower.includes('categorias')) {
    dbData = await queryTodosMotivos();
    contextType = 'analisis_motivos';
  } else if (messageLower.includes('plaga') || 
             messageLower.includes('descarte') ||
             messageLower.includes('incidencia')) {
    const tipo = messageLower.match(/(plaga|descarte|incidencia)/i)[0];
    dbData = await queryMotivosPorTipo(tipo);
    contextType = 'motivos_por_tipo';
  } else if (messageLower.includes('ejemplo') || 
             messageLower.includes('muestra') ||
             messageLower.includes('ejemplos')) {
    const limite = messageLower.match(/(\d+)\s+ejemplos?/i)?.[1] || 3;
    dbData = await queryMotivosEjemplo(parseInt(limite));
    contextType = 'motivos_ejemplo';
  } else if (messageLower.includes('todos') || 
             messageLower.includes('listado') ||
             messageLower.includes('lista')) {
    dbData = await queryTodosMotivos();
    contextType = 'todos_motivos';
  } else {
    // Búsqueda por ID o palabra clave
    const id = messageLower.match(/(?:motivo|id|código|codigo)\s+([0-9]+)/i)?.[1];
    if (id) {
      dbData = await queryMotivoPorId(id);
      contextType = 'motivo_por_id';
    } else {
      // Búsqueda por palabra clave
      const palabrasClave = messageLower.split(' ').filter(p => p.length > 2);
      if (palabrasClave.length > 0) {
        dbData = await queryMotivosPorPalabraClave(palabrasClave.join(' '));
        contextType = 'motivos_por_palabra_clave';
      }
    }
  }

  return {
    message: await formatMotivoResponse(dbData, contextType, message),
    contextType,
    data: dbData
  };
}

module.exports = {
  processMotivosMessage
};
