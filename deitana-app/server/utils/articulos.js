const db = require('../db');
const axios = require('axios');

// Configuración de la API de DeepSeek
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Prompt base para la IA
const SYSTEM_PROMPT = `Eres un asistente virtual especializado en el inventario de Semilleros Deitana S.L., con acceso a una base de datos de artículos que incluye semillas, plantones, herramientas y materiales.

Tu objetivo es mantener una conversación natural y útil con el usuario, entendiendo el contexto y el propósito de sus preguntas.

REGLA FUNDAMENTAL:
1. NUNCA inventes datos o respuestas
2. SIEMPRE consulta la base de datos para obtener información real
3. Proporciona respuestas precisas basadas SOLO en los datos reales
4. Si no tienes un dato específico, indícalo claramente con "No disponible" o "No especificado"
5. NUNCA generes códigos, descripciones o datos que no existan en la base de datos

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
2. Considera el contexto de la conversación anterior
3. Identifica qué tablas y campos son relevantes
4. Ejecuta la consulta SQL apropiada
5. Procesa los resultados
6. Proporciona una respuesta clara y precisa basada SOLO en los datos reales

Ejemplos de Consultas y Respuestas:
- "¿Cuántos artículos tenemos registrados?"
  * Consulta: SELECT COUNT(*) as total, COUNT(DISTINCT AR_GRP) as grupos, COUNT(DISTINCT AR_FAM) as familias FROM articulos
  * Respuesta: "En nuestro inventario tenemos X artículos registrados, distribuidos en Y grupos y Z familias. ¿Te gustaría ver más detalles sobre algún grupo específico?"

- "¿Qué tipos de tomates tenemos?"
  * Consulta: SELECT DISTINCT AR_DENO, id, AR_BAR FROM articulos WHERE UPPER(AR_DENO) LIKE '%TOMATE%' OR UPPER(AR_DENO) LIKE '%TOMATO%'
  * Respuesta: "Encontramos X variedades de tomates: [lista de variedades con códigos]. Si necesitas más detalles sobre alguna variedad específica, puedo proporcionártelos."

- "Muéstrame otro artículo"
  * Si el contexto anterior era una búsqueda específica, continuar con esa búsqueda
  * Si no, mostrar un artículo aleatorio diferente a los ya mostrados
  * Respuesta: "Aquí tienes otro artículo: [detalles]. ¿Te gustaría ver más detalles o buscar algo específico?"

- "Artículos que empiecen con B"
  * Consulta: SELECT * FROM articulos WHERE UPPER(AR_DENO) LIKE 'B%' OR UPPER(AR_DENO) LIKE 'B%'
  * Respuesta: "Encontramos X artículos que empiezan con B: [lista de artículos]. ¿Te gustaría ver más detalles sobre alguno en particular?"

Recuerda:
- SIEMPRE consulta la base de datos para obtener información real
- Proporciona respuestas precisas y basadas SOLO en datos reales
- Si no hay datos, indícalo claramente y sugiere alternativas
- Mantén un tono profesional pero amigable
- NUNCA inventes datos o respuestas
- Considera el contexto de la conversación anterior
- Si una búsqueda no da resultados, intenta variaciones o sugiere alternativas relacionadas
- Mantén una conversación natural y fluida
- Pide aclaraciones cuando la consulta sea ambigua
- Sugiere alternativas cuando no encuentres resultados exactos`;

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
  const query = `
    SELECT COUNT(*) as total, 
           COUNT(DISTINCT AR_GRP) as grupos,
           COUNT(DISTINCT AR_FAM) as familias
    FROM articulos`;
  try {
    const [results] = await db.query(query);
    return results[0];
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

async function queryArticulosPorTipo(tipo) {
  const query = `
    SELECT DISTINCT
      a.id,
      a.AR_DENO,
      a.AR_BAR,
      a.AR_PGE,
      p.PR_DENO as proveedor_nombre,
      a.AR_GRP,
      a.AR_FAM
    FROM articulos a
    LEFT JOIN proveedores p ON a.AR_PRV = p.id
    WHERE UPPER(a.AR_DENO) LIKE UPPER(?)
    OR UPPER(a.AR_DENO) LIKE UPPER(?)
    OR UPPER(a.AR_DENO) LIKE UPPER(?)
    ORDER BY a.AR_DENO`;
  
  try {
    const [results] = await db.query(query, [
      `%${tipo}%`,
      `%${tipo.replace(/[áéíóú]/g, c => ({'á':'a','é':'e','í':'i','ó':'o','ú':'u'}[c]))}%`,
      `%${tipo.replace(/[a-z]/g, c => ({'a':'á','e':'é','i':'í','o':'ó','u':'ú'}[c] || c))}%`
    ]);
    return results;
  } catch (error) {
    console.error('Error al consultar artículos por tipo:', error);
    return null;
  }
}

async function queryArticulosPorInicial(letra) {
  const query = `
    SELECT DISTINCT
      a.id,
      a.AR_DENO,
      a.AR_BAR,
      a.AR_PGE,
      p.PR_DENO as proveedor_nombre,
      a.AR_GRP,
      a.AR_FAM
    FROM articulos a
    LEFT JOIN proveedores p ON a.AR_PRV = p.id
    WHERE UPPER(a.AR_DENO) LIKE UPPER(?) OR UPPER(a.AR_DENO) LIKE UPPER(?)
    ORDER BY a.AR_DENO`;
  
  try {
    const [results] = await db.query(query, [
      `${letra}%`,
      `${letra.toUpperCase()}%`
    ]);
    return results;
  } catch (error) {
    console.error('Error al consultar artículos por inicial:', error);
    return null;
  }
}

async function formatArticuloResponse(dbData, contextType, userMessage, contexto = null) {
  if (!dbData) {
    const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron artículos en la base de datos. 
    Por favor, proporciona una respuesta amable y profesional explicando que no hay datos disponibles y sugiere algunas 
    alternativas de consulta que podrían ser útiles. Considera el contexto de la conversación anterior y mantén un tono conversacional.`;
    
    const aiResponse = await getDeepSeekResponse(prompt, null);
    return aiResponse || "Lo siento, no pude encontrar ningún artículo en este momento. ¿Te gustaría intentar con otros criterios de búsqueda?";
  }

  if (Array.isArray(dbData)) {
    if (dbData.length === 0) {
      const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron artículos que coincidan con su búsqueda.
      Por favor, proporciona una respuesta amable y profesional sugiriendo alternativas de búsqueda o criterios diferentes.
      Considera el contexto de la conversación anterior y sugiere búsquedas relacionadas. Mantén un tono conversacional.`;
      
      const aiResponse = await getDeepSeekResponse(prompt, null);
      return aiResponse || "No encontré artículos que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios o ver un artículo de ejemplo?";
    }

    let context = {
      tipo_consulta: contextType,
      total_resultados: dbData.length,
      datos: dbData.slice(0, 5),
      contexto_anterior: contexto ? contexto.obtenerResumenContexto() : null
    };

    let prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData.length} artículos. 
    Aquí están los datos relevantes: ${JSON.stringify(context)}.
    Por favor, proporciona una respuesta natural y conversacional que incluya:
    1. Un resumen de los resultados encontrados
    2. Los detalles más relevantes de los artículos encontrados
    3. Información sobre los proveedores si está disponible
    4. Si hay más de 5 resultados, menciona que hay más disponibles y que el usuario puede pedir más detalles
    5. Considera el contexto de la conversación anterior
    6. Mantén un tono conversacional y natural
    7. NO inventes datos que no estén en los resultados`;

    const aiResponse = await getDeepSeekResponse(prompt, context);
    return aiResponse || formatBasicResponse(dbData, contextType);
  }

  // Si es un solo artículo
  const prompt = `El usuario preguntó: "${userMessage}" y se encontró el siguiente artículo: ${JSON.stringify(dbData)}.
  Por favor, proporciona una respuesta natural y conversacional que:
  1. Describa el artículo de manera clara y detallada
  2. Mencione su código, descripción y código de barras si está disponible
  3. Indique quién es el proveedor si está disponible
  4. Proporcione información sobre el porcentaje de germinación si está disponible
  5. Considere el contexto de la conversación anterior
  6. Mantenga un tono conversacional y natural
  7. Sugiera posibles próximos pasos o información relacionada`;

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

async function processArticulosMessage(message, contexto = null) {
  const messageLower = message.toLowerCase();
  let dbData = null;
  let contextType = null;
  let filtro = null;

  // Detectar solicitudes de "otro" o "más" artículos
  if (contexto && (messageLower.includes('otro') || messageLower.includes('siguiente') || 
      messageLower.includes('más') || messageLower.includes('mas'))) {
    const tipoConsultaAnterior = contexto.ultimoTipoConsulta;
    const filtroAnterior = contexto.ultimoFiltro;
    
    switch (tipoConsultaAnterior) {
      case 'articulos_por_nombre':
        if (filtroAnterior) {
          dbData = await queryArticulosPorNombre(filtroAnterior);
          contextType = 'articulos_por_nombre';
          filtro = filtroAnterior;
        }
        break;
      case 'articulos_por_proveedor':
        if (filtroAnterior) {
          dbData = await queryArticulosPorProveedor(filtroAnterior);
          contextType = 'articulos_por_proveedor';
          filtro = filtroAnterior;
        }
        break;
      case 'articulos_por_grupo':
        if (filtroAnterior) {
          dbData = await queryArticulosPorGrupo(filtroAnterior);
          contextType = 'articulos_por_grupo';
          filtro = filtroAnterior;
        }
        break;
      case 'articulos_por_tipo':
        if (filtroAnterior) {
          dbData = await queryArticulosPorTipo(filtroAnterior);
          contextType = 'articulos_por_tipo';
          filtro = filtroAnterior;
        }
        break;
      default:
        dbData = await queryArticuloEjemplo();
        contextType = 'articulo_ejemplo';
    }

    // Filtrar artículos ya mostrados
    if (dbData && contexto) {
      if (Array.isArray(dbData)) {
        dbData = contexto.obtenerArticulosNoMostrados(dbData);
        if (dbData.length === 0) {
          // Si no quedan artículos por mostrar, obtener uno nuevo
          dbData = await queryArticuloEjemplo();
          while (dbData && contexto.articulosMostrados.has(dbData.id)) {
            dbData = await queryArticuloEjemplo();
          }
        }
      } else {
        if (contexto.articulosMostrados.has(dbData.id)) {
          dbData = await queryArticuloEjemplo();
          while (dbData && contexto.articulosMostrados.has(dbData.id)) {
            dbData = await queryArticuloEjemplo();
          }
        }
      }
    }
  }
  // Detectar consultas generales sobre artículos
  else if (messageLower.includes('artículo') || messageLower.includes('articulo') || 
           messageLower.includes('producto') || messageLower.includes('inventario') ||
           messageLower.includes('muestra') || messageLower.includes('ejemplo')) {
    dbData = await queryArticuloEjemplo();
    contextType = 'articulo_ejemplo';
  }
  // Detectar consultas sobre tipos de artículos
  else if (messageLower.includes('tipos') || messageLower.includes('variedades') || 
           messageLower.includes('clases') || messageLower.includes('categorías')) {
    const tipo = messageLower.match(/(?:tipos|variedades|clases|categorías)\s+de\s+([a-záéíóúñ\s]+)/i)?.[1]?.trim();
    if (tipo) {
      dbData = await queryArticulosPorTipo(tipo);
      contextType = 'articulos_por_tipo';
      filtro = tipo;
    }
  }
  // Detectar consultas específicas
  else if (messageLower.includes('cuántos') || messageLower.includes('cuantos') || messageLower.includes('total')) {
    dbData = await queryTotalArticulos();
    contextType = 'total_articulos';
  }
  else if (messageLower.includes('código') || messageLower.includes('codigo')) {
    const codigo = messageLower.match(/(?:código|codigo)\s+([a-z0-9]+)/i)?.[1];
    if (codigo) {
      dbData = await queryArticuloPorId(codigo);
      contextType = 'articulo_por_id';
      filtro = codigo;
    }
  }
  else if (messageLower.includes('proveedor') || messageLower.includes('proveedores')) {
    const proveedorId = messageLower.match(/(?:proveedor|proveedores)\s+([a-z0-9]+)/i)?.[1];
    if (proveedorId) {
      dbData = await queryArticulosPorProveedor(proveedorId);
      contextType = 'articulos_por_proveedor';
      filtro = proveedorId;
    }
  }
  else if (messageLower.includes('grupo') || messageLower.includes('grupos')) {
    const grupo = messageLower.match(/(?:grupo|grupos)\s+([a-z0-9]+)/i)?.[1];
    if (grupo) {
      dbData = await queryArticulosPorGrupo(grupo);
      contextType = 'articulos_por_grupo';
      filtro = grupo;
    }
  }
  // Búsqueda por nombre o descripción
  else {
    const palabrasClave = messageLower.split(' ').filter(p => p.length > 3);
    if (palabrasClave.length > 0) {
      dbData = await queryArticulosPorNombre(palabrasClave.join(' '));
      contextType = 'articulos_por_nombre';
      filtro = palabrasClave.join(' ');
    }
  }

  // Si no se encontró ningún artículo específico y no es una consulta general, mostrar un ejemplo
  if (!dbData && !messageLower.includes('artículo') && !messageLower.includes('articulo') && 
      !messageLower.includes('producto') && !messageLower.includes('inventario')) {
    dbData = await queryArticuloEjemplo();
    contextType = 'articulo_ejemplo';
  }

  // Si hay contexto, actualizarlo con los nuevos artículos mostrados
  if (contexto) {
    if (Array.isArray(dbData)) {
      dbData.forEach(articulo => {
        contexto.agregarArticuloMostrado(articulo.id);
      });
    } else if (dbData) {
      contexto.agregarArticuloMostrado(dbData.id);
    }
  }

  const respuesta = await formatArticuloResponse(dbData, contextType, message, contexto);

  // Actualizar el contexto con la nueva interacción
  if (contexto) {
    contexto.agregarMensaje(message, respuesta, contextType, filtro);
  }

  return {
    message: respuesta,
    contextType,
    data: dbData
  };
}

class ConversacionContext {
  constructor() {
    this.historial = [];
    this.articulosMostrados = new Set();
    this.ultimaConsulta = null;
    this.ultimoTipoConsulta = null;
    this.ultimoFiltro = null;
  }

  agregarMensaje(mensaje, respuesta, tipoConsulta, filtro = null) {
    this.historial.push({
      mensaje,
      respuesta,
      tipoConsulta,
      filtro,
      timestamp: new Date()
    });
    this.ultimaConsulta = mensaje;
    this.ultimoTipoConsulta = tipoConsulta;
    this.ultimoFiltro = filtro;
  }

  agregarArticuloMostrado(articuloId) {
    this.articulosMostrados.add(articuloId);
  }

  obtenerArticulosNoMostrados(articulos) {
    return articulos.filter(articulo => !this.articulosMostrados.has(articulo.id));
  }

  obtenerResumenContexto() {
    if (this.historial.length === 0) return null;
    
    const ultimasInteracciones = this.historial.slice(-3);
    return {
      ultimaConsulta: this.ultimaConsulta,
      ultimoTipoConsulta: this.ultimoTipoConsulta,
      ultimoFiltro: this.ultimoFiltro,
      historial: ultimasInteracciones.map(h => ({
        mensaje: h.mensaje,
        tipoConsulta: h.tipoConsulta,
        filtro: h.filtro
      }))
    };
  }

  limpiarContexto() {
    this.historial = [];
    this.articulosMostrados.clear();
    this.ultimaConsulta = null;
    this.ultimoTipoConsulta = null;
    this.ultimoFiltro = null;
  }
}

module.exports = {
  processArticulosMessage,
  queryTotalArticulos,
  queryArticuloPorId,
  queryArticulosPorNombre,
  queryArticulosPorProveedor,
  queryArticulosPorGrupo,
  queryArticuloEjemplo,
  ConversacionContext
};
