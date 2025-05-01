const db = require('../db');
const axios = require('axios');

// Configuración de la API de DeepSeek
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Prompt base para la IA
// Prompt base para la IA
const SYSTEM_PROMPT = `Eres un Asistente de IA para el sistema ERP DEITANA, especializado en proporcionar información verídica y detallada sobre las Acciones Comerciales.

Tu Objetivo Principal: Analizar la consulta del usuario, identificar qué información específica necesita, y ejecutar la consulta SQL correspondiente para obtener los datos exactos de la base de datos.

REGLA FUNDAMENTAL:
1. NUNCA inventes datos o respuestas
2. SIEMPRE consulta la base de datos para obtener información real
3. Proporciona respuestas precisas basadas en los datos reales

Estructura de la Base de Datos:
- acciones_com: Registro principal de acciones
  * id: Identificador único de la acción
  * ACCO_DENO: Tipo de acción (INCIDENCIA, VISITA, LLAMADA, etc.)
  * ACCO_CDCL: Código del cliente
  * ACCO_CDVD: ID del vendedor
  * ACCO_FEC: Fecha de la acción
  * ACCO_HOR: Hora de la acción

- acciones_com_acco_not: Notas detalladas
  * id: Referencia a acciones_com
  * id2: Orden de la nota
  * C0: Contenido de la nota

- vendedores: Información de vendedores
  * id: ID del vendedor
  * VD_DENO: Nombre del vendedor

- clientes: Información de clientes
  * id: ID del cliente
  * CL_DENO: Nombre del cliente

Proceso de Respuesta:
1. Analiza la consulta del usuario para entender qué información necesita
2. Identifica qué tablas y campos son relevantes
3. Ejecuta la consulta SQL apropiada
4. Procesa los resultados
5. Proporciona una respuesta clara y precisa

Ejemplos de Consultas y Respuestas:
- "¿Cuántas acciones comerciales existen en total?"
  * Consulta: SELECT COUNT(*) FROM acciones_com
  * Respuesta: "Existen X acciones comerciales en total"

- "¿Cuál fue la última incidencia registrada?"
  * Consulta: SELECT * FROM acciones_com WHERE ACCO_DENO = 'INCIDENCIA' ORDER BY ACCO_FEC DESC, ACCO_HOR DESC LIMIT 1
  * Respuesta: "La última incidencia fue [detalles]"

- "¿Cuántas acciones se realizaron en 2020?"
  * Consulta: SELECT COUNT(*) FROM acciones_com WHERE YEAR(ACCO_FEC) = 2020
  * Respuesta: "En 2020 se realizaron X acciones comerciales"

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
async function queryAccionesCom(limit = null, offset = 0) {
  const query = `
    SELECT 
      ac.id as accion_id,
      ac.ACCO_DENO as tipo_accion,
      DATE_FORMAT(ac.ACCO_FEC, '%d/%m/%Y') as fecha,
      TIME_FORMAT(ac.ACCO_HOR, '%H:%i') as hora,
      v.id as vendedor_id,
      v.VD_DENO as vendedor_nombre,
      c.id as cliente_id,
      c.CL_DENO as cliente_nombre,
      GROUP_CONCAT(acn.C0 ORDER BY acn.id2 SEPARATOR ' | ') as notas
    FROM acciones_com ac
    LEFT JOIN vendedores v ON ac.ACCO_CDVD = v.id
    LEFT JOIN clientes c ON ac.ACCO_CDCL = c.id
    LEFT JOIN acciones_com_acco_not acn ON ac.id = acn.id
    GROUP BY ac.id, v.id, c.id, ac.ACCO_DENO, ac.ACCO_FEC, ac.ACCO_HOR
    ORDER BY ac.ACCO_FEC DESC, ac.ACCO_HOR DESC
    ${limit ? 'LIMIT ? OFFSET ?' : ''}`;
  
  try {
    const [results] = await db.query(query, limit ? [limit, offset] : []);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryAccionesComercialesPorAnio(anio) {
  const query = `
    SELECT 
      ac.id as accion_id,
      ac.ACCO_DENO as tipo_accion,
      DATE_FORMAT(ac.ACCO_FEC, '%d/%m/%Y') as fecha,
      TIME_FORMAT(ac.ACCO_HOR, '%H:%i') as hora,
      v.id as vendedor_id,
      v.VD_DENO as vendedor_nombre,
      c.id as cliente_id,
      c.CL_DENO as cliente_nombre,
      GROUP_CONCAT(acn.C0 ORDER BY acn.id2 SEPARATOR ' | ') as notas
    FROM acciones_com ac
    LEFT JOIN vendedores v ON ac.ACCO_CDVD = v.id
    LEFT JOIN clientes c ON ac.ACCO_CDCL = c.id
    LEFT JOIN acciones_com_acco_not acn ON ac.id = acn.id
    WHERE YEAR(ac.ACCO_FEC) = ?
    GROUP BY ac.id, v.id, c.id, ac.ACCO_DENO, ac.ACCO_FEC, ac.ACCO_HOR
    ORDER BY ac.ACCO_FEC DESC, ac.ACCO_HOR DESC`;
  
  try {
    const [results] = await db.query(query, [anio]);
    return results;
  } catch (error) {
    console.error('Error al consultar acciones comerciales por año:', error);
    return null;
  }
}

async function queryAccionesComercialesPorTipo(tipo) {
  const query = `
    SELECT 
      ac.id as accion_id,
      ac.ACCO_DENO as tipo_accion,
      DATE_FORMAT(ac.ACCO_FEC, '%d/%m/%Y') as fecha,
      TIME_FORMAT(ac.ACCO_HOR, '%H:%i') as hora,
      v.id as vendedor_id,
      v.VD_DENO as vendedor_nombre,
      c.id as cliente_id,
      c.CL_DENO as cliente_nombre,
      GROUP_CONCAT(acn.C0 ORDER BY acn.id2 SEPARATOR ' | ') as notas
    FROM acciones_com ac
    LEFT JOIN vendedores v ON ac.ACCO_CDVD = v.id
    LEFT JOIN clientes c ON ac.ACCO_CDCL = c.id
    LEFT JOIN acciones_com_acco_not acn ON ac.id = acn.id
    WHERE ac.ACCO_DENO = ?
    GROUP BY ac.id, v.id, c.id, ac.ACCO_DENO, ac.ACCO_FEC, ac.ACCO_HOR
    ORDER BY ac.ACCO_FEC DESC, ac.ACCO_HOR DESC`;
  
  try {
    const [results] = await db.query(query, [tipo]);
    return results;
  } catch (error) {
    console.error('Error al consultar acciones comerciales por tipo:', error);
    return null;
  }
}

async function queryEstadisticasAccionesComerciales() {
  const query = `
    SELECT 
      YEAR(ac.ACCO_FEC) as anio,
      COUNT(DISTINCT ac.id) as total_acciones,
      ac.ACCO_DENO as tipo_accion,
      COUNT(DISTINCT ac.ACCO_CDCL) as total_clientes,
      COUNT(DISTINCT ac.ACCO_CDVD) as total_vendedores
    FROM acciones_com ac
    GROUP BY YEAR(ac.ACCO_FEC), ac.ACCO_DENO
    ORDER BY YEAR(ac.ACCO_FEC) DESC, COUNT(DISTINCT ac.id) DESC`;
  
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error al consultar estadísticas de acciones comerciales:', error);
    return null;
  }
}

async function queryAccionesComercialesPorPeriodo(fechaInicio, fechaFin) {
  const query = `
    SELECT 
      ac.id as accion_id,
      ac.ACCO_DENO as tipo_accion,
      DATE_FORMAT(ac.ACCO_FEC, '%d/%m/%Y') as fecha,
      TIME_FORMAT(ac.ACCO_HOR, '%H:%i') as hora,
      v.id as vendedor_id,
      v.VD_DENO as vendedor_nombre,
      c.id as cliente_id,
      c.CL_DENO as cliente_nombre,
      GROUP_CONCAT(acn.C0 ORDER BY acn.id2 SEPARATOR ' | ') as notas
    FROM acciones_com ac
    LEFT JOIN vendedores v ON ac.ACCO_CDVD = v.id
    LEFT JOIN clientes c ON ac.ACCO_CDCL = c.id
    LEFT JOIN acciones_com_acco_not acn ON ac.id = acn.id
    WHERE ac.ACCO_FEC BETWEEN ? AND ?
    GROUP BY ac.id, v.id, c.id, ac.ACCO_DENO, ac.ACCO_FEC, ac.ACCO_HOR
    ORDER BY ac.ACCO_FEC DESC, ac.ACCO_HOR DESC`;
  
  try {
    const [results] = await db.query(query, [fechaInicio, fechaFin]);
    return results;
  } catch (error) {
    console.error('Error al consultar acciones comerciales por período:', error);
    return null;
  }
}

async function queryAccionesComercialesPorVendedor(vendedorId) {
  const query = `
    SELECT 
      ac.id as accion_id,
      ac.ACCO_DENO as tipo_accion,
      DATE_FORMAT(ac.ACCO_FEC, '%d/%m/%Y') as fecha,
      TIME_FORMAT(ac.ACCO_HOR, '%H:%i') as hora,
      v.id as vendedor_id,
      v.VD_DENO as vendedor_nombre,
      c.id as cliente_id,
      c.CL_DENO as cliente_nombre,
      GROUP_CONCAT(acn.C0 ORDER BY acn.id2 SEPARATOR ' | ') as notas
    FROM acciones_com ac
    LEFT JOIN vendedores v ON ac.ACCO_CDVD = v.id
    LEFT JOIN clientes c ON ac.ACCO_CDCL = c.id
    LEFT JOIN acciones_com_acco_not acn ON ac.id = acn.id
    WHERE ac.ACCO_CDVD = ?
    GROUP BY ac.id, v.id, c.id, ac.ACCO_DENO, ac.ACCO_FEC, ac.ACCO_HOR
    ORDER BY ac.ACCO_FEC DESC, ac.ACCO_HOR DESC`;
  
  try {
    const [results] = await db.query(query, [vendedorId]);
    return results;
  } catch (error) {
    console.error('Error al consultar acciones comerciales por vendedor:', error);
    return null;
  }
}

async function queryAccionesComercialesPorCliente(clienteId) {
  const query = `
    SELECT 
      ac.id as accion_id,
      ac.ACCO_DENO as tipo_accion,
      DATE_FORMAT(ac.ACCO_FEC, '%d/%m/%Y') as fecha,
      TIME_FORMAT(ac.ACCO_HOR, '%H:%i') as hora,
      v.id as vendedor_id,
      v.VD_DENO as vendedor_nombre,
      c.id as cliente_id,
      c.CL_DENO as cliente_nombre,
      GROUP_CONCAT(acn.C0 ORDER BY acn.id2 SEPARATOR ' | ') as notas
    FROM acciones_com ac
    LEFT JOIN vendedores v ON ac.ACCO_CDVD = v.id
    LEFT JOIN clientes c ON ac.ACCO_CDCL = c.id
    LEFT JOIN acciones_com_acco_not acn ON ac.id = acn.id
    WHERE ac.ACCO_CDCL = ?
    GROUP BY ac.id, v.id, c.id, ac.ACCO_DENO, ac.ACCO_FEC, ac.ACCO_HOR
    ORDER BY ac.ACCO_FEC DESC, ac.ACCO_HOR DESC`;
  
  try {
    const [results] = await db.query(query, [clienteId]);
    return results;
  } catch (error) {
    console.error('Error al consultar acciones comerciales por cliente:', error);
    return null;
  }
}

async function queryUltimaAccionComercial(offset = 0) {
  const query = `
    SELECT 
      ac.id as accion_id,
      ac.ACCO_DENO as tipo_accion,
      DATE_FORMAT(ac.ACCO_FEC, '%d/%m/%Y') as fecha,
      TIME_FORMAT(ac.ACCO_HOR, '%H:%i') as hora,
      v.id as vendedor_id,
      v.VD_DENO as vendedor_nombre,
      c.id as cliente_id,
      c.CL_DENO as cliente_nombre,
      GROUP_CONCAT(acn.C0 ORDER BY acn.id2 SEPARATOR ' | ') as notas
    FROM acciones_com ac
    LEFT JOIN vendedores v ON ac.ACCO_CDVD = v.id
    LEFT JOIN clientes c ON ac.ACCO_CDCL = c.id
    LEFT JOIN acciones_com_acco_not acn ON ac.id = acn.id
    GROUP BY ac.id, v.id, c.id, ac.ACCO_DENO, ac.ACCO_FEC, ac.ACCO_HOR
    ORDER BY ac.ACCO_FEC DESC, ac.ACCO_HOR DESC
    LIMIT 1 OFFSET ?`;
  
  try {
    const [results] = await db.query(query, [offset]);
    return results[0] || null;
  } catch (error) {
    console.error('Error al consultar última acción comercial:', error);
    return null;
  }
}

async function formatAccionComercialResponse(dbData, contextType, userMessage, contexto = null) {
  if (!dbData) {
    const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron acciones comerciales en la base de datos. 
    Por favor, proporciona una respuesta amable y profesional explicando que no hay datos disponibles y sugiere algunas 
    alternativas de consulta que podrían ser útiles.`;
    
    const aiResponse = await getDeepSeekResponse(prompt, null);
    return aiResponse || "No se encontraron acciones comerciales registradas en la base de datos. ¿Te gustaría consultar sobre otro período o tipo de acción?";
  }

  if (Array.isArray(dbData)) {
    if (dbData.length === 0) {
      const prompt = `El usuario preguntó: "${userMessage}" pero no se encontraron acciones comerciales que coincidan con su búsqueda.
      Por favor, proporciona una respuesta amable y profesional sugiriendo alternativas de búsqueda o períodos diferentes.`;
      
      const aiResponse = await getDeepSeekResponse(prompt, null);
      return aiResponse || "No se encontraron acciones comerciales que coincidan con tu búsqueda. ¿Te gustaría intentar con otros criterios?";
    }

    let context = {
      tipo_consulta: contextType,
      total_resultados: dbData.length,
      datos: dbData.slice(0, 5)
    };

    // Agregar información del contexto si está disponible
    if (contexto) {
      const resumenContexto = contexto.obtenerResumenContexto();
      if (resumenContexto) {
        context.historial = resumenContexto.historial;
        context.ultima_consulta = resumenContexto.ultimaConsulta;
        context.ultimo_tipo_consulta = resumenContexto.ultimoTipoConsulta;
      }
    }

    let prompt = `El usuario preguntó: "${userMessage}" y se encontraron ${dbData.length} acciones comerciales. 
    Aquí están los datos relevantes: ${JSON.stringify(context)}.
    Por favor, proporciona una respuesta natural y profesional que incluya:
    1. Un resumen de los resultados encontrados
    2. Los detalles más relevantes de las acciones
    3. Sugerencias de análisis o próximos pasos
    4. Si hay más de 5 resultados, menciona que hay más disponibles`;

    if (contextType === 'estadisticas') {
      prompt = `El usuario preguntó: "${userMessage}" y se encontraron las siguientes estadísticas: ${JSON.stringify(context)}.
      Por favor, proporciona un análisis profesional de las estadísticas, destacando:
      1. Tendencias temporales
      2. Tipos de acciones más comunes
      3. Insights relevantes
      4. Recomendaciones basadas en los datos`;
    }

    const aiResponse = await getDeepSeekResponse(prompt, context);
    return aiResponse || formatBasicResponse(dbData, contextType);
  }

  const prompt = `El usuario preguntó: "${userMessage}" y se encontró la siguiente acción comercial: ${JSON.stringify(dbData)}.
  Por favor, proporciona una respuesta natural y profesional que:
  1. Describa la acción comercial de manera clara
  2. Destaque los aspectos más relevantes
  3. Proporcione contexto sobre su importancia
  4. Sugiera posibles próximos pasos o acciones relacionadas`;

  const aiResponse = await getDeepSeekResponse(prompt, dbData);
  return aiResponse || formatBasicResponse(dbData, contextType);
}

function formatBasicResponse(dbData, contextType) {
  if (contextType === 'estadisticas') {
    const anios = {};
    dbData.forEach(est => {
      if (!anios[est.anio]) {
        anios[est.anio] = {
          total_acciones: 0,
          tipos: {}
        };
      }
      anios[est.anio].total_acciones += est.total_acciones;
      anios[est.anio].tipos[est.tipo_accion] = est.total_acciones;
    });

    let response = "Estadísticas de acciones comerciales:\n\n";
    Object.keys(anios).sort().reverse().forEach(anio => {
      response += `Año ${anio}:\n`;
      response += `- Total de acciones: ${anios[anio].total_acciones}\n`;
      Object.entries(anios[anio].tipos).forEach(([tipo, cantidad]) => {
        response += `  - ${tipo}: ${cantidad} acciones\n`;
      });
      response += "\n";
    });
    return response;
  } else {
    return `Acción comercial:

Tipo: ${dbData.tipo_accion}
Fecha: ${dbData.fecha}
Hora: ${dbData.hora}
Vendedor: ${dbData.vendedor_nombre}
Cliente: ${dbData.cliente_nombre}
${dbData.notas ? `Notas: ${dbData.notas}` : ''}`;
  }
}

async function processAccionesComercialesMessage(message, contexto = null) {
  const messageLower = message.toLowerCase();
  let dbData = null;
  let contextType = null;
  let limit = 100000; // Límite por defecto
  let offset = 0;

  // Si hay contexto y el mensaje indica "otro" o similar
  if (contexto && (messageLower.includes('otro') || messageLower.includes('siguiente') || messageLower.includes('más'))) {
    // Obtener el tipo de consulta anterior
    const tipoConsultaAnterior = contexto.ultimoTipoConsulta;
    
    // Ajustar el offset basado en las acciones ya mostradas
    offset = contexto.accionesMostradas.size;
    
    // Reutilizar la misma consulta que la anterior
    switch (tipoConsultaAnterior) {
      case 'acciones_por_anio':
        const anio = messageLower.match(/(\d{4})/)?.[1];
        if (anio) {
          dbData = await queryAccionesComercialesPorAnio(anio);
          contextType = 'acciones_por_anio';
        }
        break;
      case 'acciones_por_tipo':
        const tipo = messageLower.match(/(?:tipo|de)\s+([a-záéíóúñ\s]+)\s+(?:acciones|acción)/i)?.[1]?.trim();
        if (tipo) {
          dbData = await queryAccionesComercialesPorTipo(tipo);
          contextType = 'acciones_por_tipo';
        }
        break;
      default:
        dbData = await queryAccionesCom(limit, offset);
        contextType = 'todas_acciones';
    }

    // Filtrar acciones ya mostradas
    if (dbData && contexto) {
      dbData = contexto.obtenerAccionesNoMostradas(dbData);
    }
  } else {
    // Lógica normal para nuevas consultas
    if (messageLower.match(/(?:año|año|en)\s+(\d{4})/)) {
      const year = parseInt(messageLower.match(/(?:año|año|en)\s+(\d{4})/)[1]);
      dbData = await queryAccionesComercialesPorAnio(year);
      contextType = 'acciones_por_anio';
    } else if (messageLower.includes('tipo') || messageLower.includes('tipos')) {
      const tipo = messageLower.match(/(?:tipo|de)\s+([a-záéíóúñ\s]+)\s+(?:acciones|acción)/i)?.[1]?.trim();
      if (tipo) {
        dbData = await queryAccionesComercialesPorTipo(tipo);
        contextType = 'acciones_por_tipo';
      }
    } else if (messageLower.includes('estadísticas') || messageLower.includes('estadisticas')) {
      dbData = await queryEstadisticasAccionesComerciales();
      contextType = 'estadisticas';
    } else {
      dbData = await queryAccionesCom(limit, offset);
      contextType = 'todas_acciones';
    }
  }

  // Si no hay datos, retornar mensaje apropiado
  if (!dbData || (Array.isArray(dbData) && dbData.length === 0)) {
    return {
      message: "No se encontraron más acciones comerciales que coincidan con tu búsqueda.",
      contextType,
      data: null
    };
  }

  // Si hay contexto, actualizarlo con las nuevas acciones mostradas
  if (contexto && Array.isArray(dbData)) {
    dbData.forEach(accion => {
      contexto.agregarAccionMostrada(accion.accion_id);
    });
  }

  const respuesta = await formatAccionComercialResponse(dbData, contextType, message, contexto);

  // Actualizar el contexto con la nueva interacción
  if (contexto) {
    contexto.agregarMensaje(message, respuesta, contextType);
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
    this.accionesMostradas = new Set();
    this.ultimaConsulta = null;
    this.ultimoTipoConsulta = null;
  }

  agregarMensaje(mensaje, respuesta, tipoConsulta) {
    this.historial.push({
      mensaje,
      respuesta,
      tipoConsulta,
      timestamp: new Date()
    });
    this.ultimaConsulta = mensaje;
    this.ultimoTipoConsulta = tipoConsulta;
  }

  agregarAccionMostrada(accionId) {
    this.accionesMostradas.add(accionId);
  }

  obtenerAccionesNoMostradas(acciones) {
    return acciones.filter(accion => !this.accionesMostradas.has(accion.accion_id));
  }

  obtenerResumenContexto() {
    if (this.historial.length === 0) return null;
    
    const ultimasInteracciones = this.historial.slice(-3);
    return {
      ultimaConsulta: this.ultimaConsulta,
      ultimoTipoConsulta: this.ultimoTipoConsulta,
      historial: ultimasInteracciones.map(h => ({
        mensaje: h.mensaje,
        tipoConsulta: h.tipoConsulta
      }))
    };
  }

  limpiarContexto() {
    this.historial = [];
    this.accionesMostradas.clear();
    this.ultimaConsulta = null;
    this.ultimoTipoConsulta = null;
  }
}

module.exports = {
  processAccionesComercialesMessage,
  queryAccionesCom,
  queryUltimaAccionComercial,
  queryAccionesComercialesPorAnio,
  queryAccionesComercialesPorTipo,
  queryEstadisticasAccionesComerciales,
  queryAccionesComercialesPorPeriodo,
  queryAccionesComercialesPorVendedor,
  queryAccionesComercialesPorCliente,
  ConversacionContext
};