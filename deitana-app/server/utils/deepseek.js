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
      NULLIF(a.AR_BAR, '') as codigo_barras,
      a.AR_PRV as proveedor_id,
      p.PR_DENO as nombre_proveedor,
      a.AR_PGE as porcentaje_germinacion
    FROM articulos a
    LEFT JOIN proveedores p ON a.AR_PRV = p.id
    WHERE LOWER(a.AR_DENO) LIKE LOWER(?)`;
  
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

// Funciones auxiliares para consultas SQL - Artículos y Proveedores
async function queryProveedorConMasArticulos() {
  const query = `
    SELECT 
      p.id as proveedor_id,
      p.PR_DENO as nombre_proveedor,
      COUNT(DISTINCT a.id) as total_articulos,
      GROUP_CONCAT(
        JSON_OBJECT(
          'id', a.id,
          'denominacion', a.AR_DENO,
          'codigo_barras', NULLIF(a.AR_BAR, ''),
          'porcentaje_germinacion', a.AR_PGE
        )
        ORDER BY RAND()
        LIMIT 3
      ) as ejemplos_articulos
    FROM proveedores p
    INNER JOIN articulos a ON p.id = a.AR_PRV
    WHERE a.AR_PRV IS NOT NULL AND a.AR_PRV != ''
    GROUP BY p.id, p.PR_DENO
    ORDER BY COUNT(DISTINCT a.id) DESC
    LIMIT 1`;
  
  try {
    const [results] = await db.query(query);
    if (results[0]) {
      results[0].ejemplos_articulos = JSON.parse(`[${results[0].ejemplos_articulos}]`);
    }
    return results[0];
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryArticulosDeProveedor(proveedorId, limit = 3) {
  const query = `
    SELECT 
      a.id as articulo_id,
      a.AR_DENO as denominacion,
      NULLIF(a.AR_BAR, '') as codigo_barras,
      a.AR_PGE as porcentaje_germinacion
    FROM articulos a
    WHERE a.AR_PRV = ?
    AND a.AR_PRV IS NOT NULL 
    AND a.AR_PRV != ''
    ORDER BY RAND()
    LIMIT ?`;
  
  try {
    const [results] = await db.query(query, [proveedorId, limit]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryArticuloPorNombre(nombre) {
  const query = `
    SELECT 
      a.id as articulo_id,
      a.AR_DENO as denominacion,
      a.AR_PRV as proveedor_id,
      p.PR_DENO as nombre_proveedor,
      a.AR_BAR as codigo_barras,
      a.AR_PGE as porcentaje_germinacion
    FROM articulos a
    LEFT JOIN proveedores p ON a.AR_PRV = p.id
    WHERE a.AR_DENO LIKE ?`;
  
  try {
    const [results] = await db.query(query, [`%${nombre}%`]);
    return results[0];
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

// Función principal para procesar mensajes
async function processMessage(userMessage) {
  try {
    console.log('Procesando mensaje en deepseek.js:', userMessage);

    let dbData = null;
    let vendedoresData = null;
    let proveedoresData = null;
    let articulosData = null;
    let contextType = null;
    const messageLower = userMessage.toLowerCase();

    // Detección de consultas sobre artículos y proveedores
    if (messageLower.includes('proveedor') && messageLower.includes('más productos')) {
      proveedoresData = await queryProveedorConMasArticulos();
      if (proveedoresData) {
        articulosData = await queryArticulosDeProveedor(proveedoresData.proveedor_id);
      }
      contextType = 'proveedor_mas_articulos';
    } else if (messageLower.includes('productos de') || messageLower.includes('artículos de')) {
      const lastProvider = assistantContext.lastResponse ? 
        assistantContext.lastResponse.match(/ID: (\d+)/)?.[1] : null;
      if (lastProvider) {
        articulosData = await queryArticulosDeProveedor(lastProvider);
        proveedoresData = await queryProveedorConMasArticulos();
        contextType = 'articulos_proveedor';
      }
    } else if (messageLower.includes('quien provee') || messageLower.includes('proveedor de') || 
               messageLower.includes('que proveedor tiene')) {
      const searchTerms = messageLower.split(' ').filter(word => 
        word.length > 3 && 
        !['quien', 'provee', 'proveedor', 'de', 'el', 'la', 'los', 'las', 'tiene', 'que'].includes(word)
      );
      if (searchTerms.length > 0) {
        const results = await searchArticulosByName(searchTerms.join(' '));
        articulosData = results && results.length > 0 ? results[0] : null;
        contextType = 'busqueda_articulo';
      }
    }
    // Mantener la lógica existente de acciones comerciales
    else if (messageLower.includes('vendedor') || messageLower.includes('vendedora') || 
             messageLower.includes('gestion') || messageLower.includes('gestiona')) {
      vendedoresData = await queryVendedores();
      dbData = await queryAccionesCom();
      contextType = 'acciones_comerciales';
    } else if (messageLower.includes('acciones comerciales') || messageLower.includes('acciones registradas')) {
      vendedoresData = await queryVendedores();
      dbData = await queryAccionesCom(10);
      contextType = 'acciones_comerciales';
    }

    // Preparar el prompt según el tipo de consulta
    let systemContent = `Eres un asistente experto del ERP DEITANA de Semilleros Deitana.\n\n`;

    if (contextType === 'acciones_comerciales') {
      // Mantener el prompt existente para acciones comerciales
      systemContent += `CONTEXTO IMPORTANTE:
- Las acciones comerciales incluyen incidencias, visitas técnicas, llamadas y negociaciones.
- Existe una relación entre vendedores y acciones_com a través del campo ACCO_CDVD.
- Cada vendedor tiene un id único y un nombre (VD_DENO).

DATOS DE VENDEDORES:
${vendedoresData ? JSON.stringify(vendedoresData, null, 2) : 'No hay datos específicos de vendedores.'}

DATOS DE ACCIONES COMERCIALES:
${dbData ? JSON.stringify(dbData, null, 2) : 'No hay datos específicos para esta consulta.'}

INSTRUCCIONES:
1. SIEMPRE menciona tanto el ID como el nombre del vendedor
2. Si hay múltiples vendedores, menciónalos a todos
3. Formatea las fechas en dd/mm/yyyy`;
    } else {
      systemContent += `CONTEXTO IMPORTANTE:
- Los artículos pueden tener un proveedor asignado mediante AR_PRV.
- Si AR_PRV está vacío, null o no existe, el artículo no tiene proveedor asignado.
- Los códigos de barras (AR_BAR) deben mostrarse EXACTAMENTE como están en la base de datos.
- NUNCA inventes o modifiques ningún dato.

DATOS DISPONIBLES:
${JSON.stringify(proveedoresData || {}, null, 2)}
${JSON.stringify(articulosData || {}, null, 2)}

INSTRUCCIONES ESPECÍFICAS:
1. Para consultas sobre proveedor con más productos:
   - Usa EXACTAMENTE el ID y nombre del proveedor como aparece en la base de datos
   - Muestra el total de artículos sin modificar
   - Lista SOLO los artículos proporcionados en ejemplos_articulos
2. Para consultas sobre artículos de un proveedor:
   - Muestra SOLO los artículos retornados por la consulta
   - Incluye el código de barras SOLO si existe y EXACTAMENTE como está en AR_BAR
   - NO agregues ni inventes ningún dato adicional
3. Para búsquedas de proveedor de un artículo:
   - Si el artículo existe, usa EXACTAMENTE los datos encontrados
   - Si AR_PRV está vacío o es null, indica explícitamente que no tiene proveedor
   - Si el artículo no se encuentra, indícalo claramente

REGLAS ESTRICTAS:
1. NUNCA modifiques los códigos de barras
2. NUNCA inventes datos que no existan
3. NUNCA asumas relaciones que no estén en la base de datos
4. Usa SIEMPRE los datos EXACTOS de la base de datos

FORMATO DE RESPUESTA:
- Sé preciso y exacto
- Usa SOLO datos reales de la base de datos
- Si un dato no existe, indícalo explícitamente
- Responde en español`;
    }

    const messages = [
      {
        role: "system",
        content: systemContent
      },
      ...assistantContext.conversationHistory.slice(-4),
      { role: "user", content: userMessage }
    ];

    // Llamada a la API
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: "deepseek-chat",
      messages: messages,
      temperature: 0.7,
      max_tokens: 300
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