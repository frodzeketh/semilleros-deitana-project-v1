const db = require('../db');
const axios = require('axios');

// Configuración de la API de DeepSeek
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Prompt base para la IA
const SYSTEM_PROMPT = `Eres un asistente virtual de Semilleros Deitana S.L., especializado en proporcionar información detallada sobre los países registrados en el sistema y sus relaciones con otras entidades.

Tu Objetivo Principal: Analizar la consulta del usuario, identificar qué información específica necesita sobre países, y ejecutar la consulta SQL correspondiente para obtener los datos exactos de la base de datos.

REGLA FUNDAMENTAL:
1. NUNCA inventes datos o respuestas
2. SIEMPRE consulta la base de datos para obtener información real
3. Proporciona respuestas precisas basadas en los datos reales
4. Mantén el contexto de la conversación y relaciona información cuando sea relevante

Estructura de la Base de Datos:
- paises: Registro principal de países
  * id: Código único del país (ejemplo: '001')
  * PA_DENO: Denominación o nombre del país (ejemplo: 'FRANCIA')

Contexto de Uso:
Los países en el sistema están relacionados con:
- Origen y destino de productos agrícolas
- Ubicación de clientes internacionales
- Procedencia de proveedores extranjeros
- Referencias geográficas en otras entidades del sistema

Proceso de Respuesta:
1. Analiza la consulta del usuario para entender qué información necesita
2. Identifica si la consulta requiere:
   - Búsqueda directa de países
   - Análisis de relaciones con otras entidades
   - Verificación de existencia de un país específico
   - Información sobre códigos o denominaciones
3. Ejecuta la consulta SQL apropiada
4. Procesa los resultados considerando el contexto
5. Proporciona una respuesta clara, precisa y contextualizada

Ejemplos de Tipos de Consultas:
1. Consultas Directas:
   - "¿Qué países están registrados?"
   - "¿Cuál es el código de Francia?"
   - "¿Está Holanda en el sistema?"

2. Consultas de Análisis:
   - "¿Cuántos países europeos tenemos?"
   - "Muestra los países ordenados alfabéticamente"
   - "¿Qué países empiezan por 'E'?"

3. Consultas de Verificación:
   - "¿Existe el país con código '001'?"
   - "¿Tenemos registrado Marruecos?"

4. Consultas de Relación:
   - "¿Qué países están relacionados con exportaciones?"
   - "¿De qué países son nuestros proveedores?"

Recuerda:
- SIEMPRE consulta la base de datos para obtener información real
- Proporciona respuestas precisas y basadas en datos
- Si no hay datos, explica claramente y sugiere alternativas
- Mantén un tono profesional pero conversacional
- Considera el contexto completo de la conversación
- Sugiere consultas relacionadas cuando sea apropiado`;

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
async function queryTotalPaises() {
  const query = `SELECT COUNT(*) as total FROM paises`;
  try {
    const [results] = await db.query(query);
    return results[0].total;
  } catch (error) {
    console.error('Error al contar países:', error);
    return null;
  }
}

async function queryPaisPorId(id) {
  const query = `SELECT * FROM paises WHERE id = ?`;
  try {
    const [results] = await db.query(query, [id]);
    return results[0] || null;
  } catch (error) {
    console.error('Error al consultar país por ID:', error);
    return null;
  }
}

async function queryPaisPorNombre(nombre) {
  const query = `
    SELECT * FROM paises 
    WHERE UPPER(PA_DENO) = UPPER(?)`;
  try {
    const [results] = await db.query(query, [nombre]);
    return results[0] || null;
  } catch (error) {
    console.error('Error al consultar país por nombre:', error);
    return null;
  }
}

async function queryPaisesPorNombreParcial(nombre) {
  const query = `
    SELECT * FROM paises 
    WHERE UPPER(PA_DENO) LIKE UPPER(?)
    ORDER BY PA_DENO`;
  try {
    const [results] = await db.query(query, [`%${nombre}%`]);
    return results;
  } catch (error) {
    console.error('Error al consultar países por nombre parcial:', error);
    return null;
  }
}

async function queryTodosPaises() {
  const query = `SELECT * FROM paises ORDER BY PA_DENO`;
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error al consultar todos los países:', error);
    return null;
  }
}

async function queryPaisesPorInicial(letra) {
  const query = `
    SELECT * FROM paises 
    WHERE UPPER(PA_DENO) LIKE UPPER(?)
    ORDER BY PA_DENO`;
  try {
    const [results] = await db.query(query, [`${letra}%`]);
    return results;
  } catch (error) {
    console.error('Error al consultar países por inicial:', error);
    return null;
  }
}

async function queryPaisesConRelaciones() {
  // Esta consulta es un ejemplo y deberá adaptarse según las relaciones reales en la base de datos
  const query = `
    SELECT DISTINCT p.* 
    FROM paises p
    LEFT JOIN clientes c ON c.CL_PAIS = p.id
    LEFT JOIN proveedores pr ON pr.PR_PAIS = p.id
    WHERE c.id IS NOT NULL OR pr.id IS NOT NULL
    ORDER BY p.PA_DENO`;
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error al consultar países con relaciones:', error);
    return null;
  }
}

async function formatPaisResponse(dbData, contextType, userMessage) {
  const prompt = `El usuario preguntó: "${userMessage}"
  Datos obtenidos: ${JSON.stringify(dbData)}
  Tipo de consulta: ${contextType}
  
  Por favor, proporciona una respuesta natural y conversacional que:
  1. Analice los datos encontrados (o la falta de ellos)
  2. Proporcione información relevante y contextualizada
  3. Sugiera consultas relacionadas si es apropiado
  4. Mantenga un tono profesional pero cercano
  
  IMPORTANTE: Genera una respuesta única basada en los datos reales de la consulta.`;

  const aiResponse = await getDeepSeekResponse(prompt, {
    data: dbData,
    contextType,
    userMessage
  });
  return aiResponse;
}

async function processPaisesMessage(message) {
  const messageLower = message.toLowerCase();
  let dbData = null;
  let contextType = null;

  // Detectar consultas específicas
  if (messageLower.includes('cuántos') || 
      messageLower.includes('cuantos') || 
      messageLower.includes('total')) {
    dbData = await queryTotalPaises();
    contextType = 'total_paises';
  } else if (messageLower.includes('código') || 
             messageLower.includes('codigo')) {
    const codigo = messageLower.match(/(?:código|codigo)\s+([0-9]+)/i)?.[1];
    if (codigo) {
      dbData = await queryPaisPorId(codigo);
      contextType = 'pais_por_codigo';
    }
  } else if (messageLower.includes('existe') || 
             messageLower.includes('tenemos registrado')) {
    // Buscar nombre de país en la consulta
    const nombrePais = messageLower.replace(/(?:existe|tenemos registrado|el país|el pais)\s+/i, '').trim();
    if (nombrePais) {
      dbData = await queryPaisPorNombre(nombrePais);
      contextType = 'verificacion_pais';
    }
  } else if (messageLower.includes('empiezan') || 
             messageLower.includes('inicial') ||
             messageLower.includes('letra')) {
    const letra = messageLower.match(/(?:empiezan|inicial|letra)\s+([a-z])/i)?.[1];
    if (letra) {
      dbData = await queryPaisesPorInicial(letra);
      contextType = 'paises_por_inicial';
    }
  } else if (messageLower.includes('relaciones') || 
             messageLower.includes('relacionados') ||
             messageLower.includes('vinculados')) {
    dbData = await queryPaisesConRelaciones();
    contextType = 'paises_con_relaciones';
  } else if (messageLower.includes('todos') || 
             messageLower.includes('lista') ||
             messageLower.includes('listado') ||
             messageLower.includes('completa')) {
    dbData = await queryTodosPaises();
    contextType = 'todos_paises';
  } else {
    // Búsqueda por nombre o palabra clave
    const palabrasClave = messageLower.split(' ')
      .filter(p => p.length > 2)
      .filter(p => !['los', 'las', 'que', 'con', 'por', 'para'].includes(p));
    
    if (palabrasClave.length > 0) {
      dbData = await queryPaisesPorNombreParcial(palabrasClave.join(' '));
      contextType = 'busqueda_paises';
    }
  }

  return {
    message: await formatPaisResponse(dbData, contextType, message),
    contextType,
    data: dbData
  };
}

module.exports = {
  processPaisesMessage
};
