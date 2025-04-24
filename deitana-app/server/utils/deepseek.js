const axios = require('axios');
const db = require('../db');

// Sistema de contexto para el asistente
const assistantContext = {
  currentTopic: null,
  lastQuery: null,
  lastResponse: null,
  conversationHistory: []
};

// Funciones auxiliares para consultas SQL
async function queryArticulos(limit = null) {
  const query = `
    SELECT 
      a.id as articulo_id,
      a.AR_DENO as denominacion,
      a.AR_BAR as codigo_barras,
      a.AR_TIVA as tipo_iva,
      a.AR_GRP as grupo,
      a.AR_FAM as familia,
      a.AR_PRV as proveedor_id,
      a.AR_PGE as porcentaje_germinacion,
      p.id as id_proveedor,
      p.PR_DENO as nombre_proveedor
    FROM articulos a
    LEFT JOIN proveedores p ON a.AR_PRV = p.id
    WHERE 1=1
    ${limit ? 'LIMIT ?' : ''}`;
  
  try {
    const [results] = await db.query(query, limit ? [limit] : []);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryProveedores() {
  const query = `
    SELECT 
      p.id as proveedor_id,
      p.PR_DENO as nombre_proveedor,
      COUNT(DISTINCT a.id) as total_articulos,
      GROUP_CONCAT(DISTINCT a.AR_DENO SEPARATOR ' | ') as algunos_articulos
    FROM proveedores p
    LEFT JOIN articulos a ON p.id = a.AR_PRV
    WHERE p.id IS NOT NULL
    GROUP BY p.id, p.PR_DENO
    ORDER BY COUNT(DISTINCT a.id) DESC`;
  
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function searchArticulosByName(nombre) {
  const query = `
    SELECT 
      a.id as articulo_id,
      a.AR_DENO as denominacion,
      a.AR_BAR as codigo_barras,
      a.AR_TIVA as tipo_iva,
      a.AR_GRP as grupo,
      a.AR_FAM as familia,
      a.AR_PRV as proveedor_id,
      a.AR_PGE as porcentaje_germinacion,
      p.id as id_proveedor,
      p.PR_DENO as nombre_proveedor
    FROM articulos a
    LEFT JOIN proveedores p ON a.AR_PRV = p.id
    WHERE a.AR_DENO LIKE ?`;
  
  try {
    const [results] = await db.query(query, [`%${nombre}%`]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryAccionesCom(limit = null) {
  const query = `
    SELECT 
      ac.id as accion_id,
      ac.ACCO_DENO,
      ac.ACCO_CDCL,
      ac.ACCO_CDVD,
      v.id as vendedor_id,
      v.VD_DENO as vendedor_nombre,
      ac.ACCO_FEC,
      ac.ACCO_HOR,
      GROUP_CONCAT(acn.C0 ORDER BY acn.id2 SEPARATOR ' | ') as notas
    FROM acciones_com ac
    INNER JOIN vendedores v ON ac.ACCO_CDVD = v.id
    LEFT JOIN acciones_com_acco_not acn ON ac.id = acn.id
    GROUP BY ac.id, v.id, ac.ACCO_DENO, ac.ACCO_CDCL, ac.ACCO_CDVD, ac.ACCO_FEC, ac.ACCO_HOR
    ORDER BY ac.ACCO_FEC DESC, ac.ACCO_HOR DESC
    ${limit ? 'LIMIT ?' : ''}`;
  
  try {
    const [results] = await db.query(query, limit ? [limit] : []);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryVendedores() {
  const query = `
    SELECT DISTINCT 
      v.id as vendedor_id,
      v.VD_DENO as vendedor_nombre,
      COUNT(DISTINCT ac.id) as total_acciones,
      GROUP_CONCAT(DISTINCT ac.ACCO_DENO) as tipos_acciones,
      MIN(ac.ACCO_FEC) as primera_accion,
      MAX(ac.ACCO_FEC) as ultima_accion
    FROM vendedores v
    INNER JOIN acciones_com ac ON v.id = ac.ACCO_CDVD
    GROUP BY v.id, v.VD_DENO
    ORDER BY COUNT(DISTINCT ac.id) DESC`;
  
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

function prepareDataForPrompt(data, type) {
  if (!data || data.length === 0) return 'No hay datos disponibles.';
  
  switch (type) {
    case 'proveedores':
      return data.slice(0, 3).map(p => 
        `- ${p.nombre_proveedor} (ID: ${p.proveedor_id}): ${p.total_articulos} artículos`
      ).join('\n');
    
    case 'articulos':
      return data.slice(0, 3).map(a => 
        `- ${a.denominacion} (ID: ${a.articulo_id})${a.nombre_proveedor ? `, proveedor: ${a.nombre_proveedor}` : ''}`
      ).join('\n');
    
    case 'acciones':
      return data.slice(0, 3).map(ac => 
        `- ${ac.ACCO_DENO} por ${ac.vendedor_nombre} el ${ac.ACCO_FEC}`
      ).join('\n');
    
    default:
      return JSON.stringify(data.slice(0, 2), null, 2);
  }
}

// Función principal para procesar mensajes
async function processMessage(userMessage) {
  try {
    console.log('Procesando mensaje en deepseek.js:', userMessage);

    // Obtener datos relevantes de la base de datos según el mensaje
    let dbData = null;
    let vendedoresData = null;
    const messageLower = userMessage.toLowerCase();
    
    if (messageLower.includes('vendedor') || messageLower.includes('vendedora') || 
        messageLower.includes('gestion') || messageLower.includes('gestiona')) {
      // Obtener TODOS los vendedores y sus acciones
      vendedoresData = await queryVendedores();
      // Obtener todas las acciones comerciales sin límite
      dbData = await queryAccionesCom();
    } else if (messageLower.includes('acciones comerciales') || messageLower.includes('acciones registradas')) {
      vendedoresData = await queryVendedores();
      dbData = await queryAccionesCom(10);
    } else if (messageLower.includes('incidencia')) {
      dbData = await queryAccionesPorTipo('INCIDENCIA');
    } else if (messageLower.includes('negociacion')) {
      dbData = await queryAccionesPorTipo('NEGOCIACION');
    }

    const messages = [
      {
        role: "system",
        content: `Eres un asistente experto del ERP DEITANA de Semilleros Deitana.

CONTEXTO IMPORTANTE:
- Semilleros Deitana utiliza un ERP de GsBase para gestionar información de artículos, clientes y acciones comerciales.
- Las acciones comerciales incluyen incidencias, visitas técnicas, llamadas y negociaciones.
- La información se almacena en tablas como acciones_com (para acciones comerciales) y acciones_com_acco_not (para notas detalladas).
- El sistema maneja un seguimiento detallado de clientes y sus interacciones.
- Existe una relación entre vendedores y acciones_com a través del campo ACCO_CDVD que corresponde al id del vendedor.
- Cada vendedor tiene un id único y un nombre (VD_DENO) en la tabla vendedores.

RELACIONES IMPORTANTES:
- vendedores → acciones_com
  * Tipo: Muchos a uno
  * Campo de enlace: ACCO_CDVD = id del vendedor
  * Cada acción comercial está asociada a un único vendedor responsable
  * Un vendedor puede tener múltiples acciones comerciales
  * SIEMPRE debes verificar el id del vendedor (ACCO_CDVD) con su nombre (VD_DENO)

DATOS DE VENDEDORES:
${vendedoresData ? JSON.stringify(vendedoresData, null, 2) : 'No hay datos específicos de vendedores.'}

DATOS DE ACCIONES COMERCIALES:
${dbData ? JSON.stringify(dbData, null, 2) : 'No hay datos específicos para esta consulta.'}

INSTRUCCIONES:
1. SIEMPRE usa los datos completos disponibles, no solo los primeros registros
2. Cuando menciones un vendedor, SIEMPRE incluye tanto su ID como su nombre
3. Si hay múltiples vendedores, MENCIÓNALOS A TODOS
4. Mantén un tono profesional pero conversacional
5. Si no entiendes algo, pide aclaraciones específicas
6. Usa el contexto del ERP cuando sea relevante
7. Responde en español
8. Formatea las fechas en formato dd/mm/yyyy
9. Si mencionas datos de la base de datos, sé específico y cita los ejemplos
10. NUNCA asumas que solo hay un vendedor sin verificar todos los datos disponibles`
      },
      ...assistantContext.conversationHistory,
      {
        role: "user",
        content: userMessage
      }
    ];

    // Llamada a la API
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: "deepseek-chat",
      messages: messages,
      temperature: 0.7,
      max_tokens: 500
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      }
    });

    const aiResponse = response.data.choices[0].message.content;
    
    // Actualizar contexto
    assistantContext.lastQuery = userMessage;
    assistantContext.lastResponse = aiResponse;
    assistantContext.conversationHistory.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: aiResponse }
    );

    // Mantener historial manejable
    if (assistantContext.conversationHistory.length > 6) {
      assistantContext.conversationHistory = assistantContext.conversationHistory.slice(-6);
    }

    return {
      message: aiResponse,
      context: assistantContext
    };

  } catch (error) {
    console.error('Error en processMessage:', error);
    return {
      message: "Lo siento, estoy teniendo problemas para procesar tu consulta en este momento. ¿Podrías intentarlo de nuevo?",
      context: assistantContext
    };
  }
}

module.exports = {
  processMessage
};