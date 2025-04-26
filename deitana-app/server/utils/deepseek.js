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

// Funciones auxiliares para consultas SQL - Clientes
async function queryClientesPorPais(pais, limit = 5) {
  const query = `
    SELECT 
      id,
      NULLIF(CL_DENO, '') as nombre,
      NULLIF(CL_DOM, '') as domicilio,
      NULLIF(CL_POB, '') as poblacion,
      NULLIF(CL_PROV, '') as provincia,
      NULLIF(CL_CDP, '') as codigo_postal,
      NULLIF(CL_TEL, '') as telefono,
      NULLIF(CL_FAX, '') as fax,
      NULLIF(CL_CIF, '') as cif,
      NULLIF(CL_EMA, '') as email,
      NULLIF(CL_WEB, '') as web,
      NULLIF(CL_PAIS, '') as pais
    FROM clientes
    WHERE LOWER(CL_PAIS) LIKE LOWER(?)
    ORDER BY CL_DENO
    LIMIT ?`;
  
  try {
    const [results] = await db.query(query, [`%${pais}%`, limit]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryClientesPorProvincia(provincia) {
  const query = `
    SELECT 
      COUNT(*) as total_clientes,
      NULLIF(CL_PROV, '') as provincia
    FROM clientes
    WHERE LOWER(CL_PROV) LIKE LOWER(?)
    GROUP BY CL_PROV`;
  
  try {
    const [results] = await db.query(query, [`%${provincia}%`]);
    return results[0];
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryClientesPorPoblacion(poblacion, limit = 3) {
  const query = `
    SELECT 
      id,
      NULLIF(CL_DENO, '') as nombre,
      NULLIF(CL_DOM, '') as domicilio,
      NULLIF(CL_POB, '') as poblacion,
      NULLIF(CL_PROV, '') as provincia,
      NULLIF(CL_CDP, '') as codigo_postal,
      NULLIF(CL_TEL, '') as telefono,
      NULLIF(CL_FAX, '') as fax,
      NULLIF(CL_CIF, '') as cif,
      NULLIF(CL_EMA, '') as email,
      NULLIF(CL_WEB, '') as web,
      NULLIF(CL_PAIS, '') as pais
    FROM clientes
    WHERE LOWER(CL_POB) LIKE LOWER(?)
    ORDER BY CL_DENO
    LIMIT ?`;
  
  try {
    const [results] = await db.query(query, [`%${poblacion}%`, limit]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryClientePorNombre(nombre) {
  const query = `
    SELECT 
      id,
      NULLIF(CL_DENO, '') as nombre,
      NULLIF(CL_DOM, '') as domicilio,
      NULLIF(CL_POB, '') as poblacion,
      NULLIF(CL_PROV, '') as provincia,
      NULLIF(CL_CDP, '') as codigo_postal,
      NULLIF(CL_TEL, '') as telefono,
      NULLIF(CL_FAX, '') as fax,
      NULLIF(CL_CIF, '') as cif,
      NULLIF(CL_EMA, '') as email,
      NULLIF(CL_WEB, '') as web,
      NULLIF(CL_PAIS, '') as pais
    FROM clientes
    WHERE LOWER(CL_DENO) LIKE LOWER(?)`;
  
  try {
    const [results] = await db.query(query, [`%${nombre}%`]);
    return results[0];
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryClientePorCIF(cif) {
  const query = `
    SELECT 
      id,
      NULLIF(CL_DENO, '') as nombre,
      NULLIF(CL_DOM, '') as domicilio,
      NULLIF(CL_POB, '') as poblacion,
      NULLIF(CL_PROV, '') as provincia,
      NULLIF(CL_CDP, '') as codigo_postal,
      NULLIF(CL_TEL, '') as telefono,
      NULLIF(CL_FAX, '') as fax,
      NULLIF(CL_CIF, '') as cif,
      NULLIF(CL_EMA, '') as email,
      NULLIF(CL_WEB, '') as web,
      NULLIF(CL_PAIS, '') as pais
    FROM clientes
    WHERE CL_CIF = ?`;
  
  try {
    const [results] = await db.query(query, [cif]);
    return results[0];
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryClientesOrdenados(limit = 10) {
  const query = `
    SELECT 
      id,
      NULLIF(CL_DENO, '') as nombre,
      NULLIF(CL_DOM, '') as domicilio,
      NULLIF(CL_POB, '') as poblacion,
      NULLIF(CL_PROV, '') as provincia,
      NULLIF(CL_CDP, '') as codigo_postal,
      NULLIF(CL_TEL, '') as telefono,
      NULLIF(CL_FAX, '') as fax,
      NULLIF(CL_CIF, '') as cif,
      NULLIF(CL_EMA, '') as email,
      NULLIF(CL_WEB, '') as web,
      NULLIF(CL_PAIS, '') as pais
    FROM clientes
    ORDER BY CL_DENO
    LIMIT ?`;
  
  try {
    const [results] = await db.query(query, [limit]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

// Funciones auxiliares para consultas SQL - Proveedores Detallados
async function queryProveedoresPorProvincia(provincia, limit = 5) {
  const query = `
    SELECT 
      id,
      NULLIF(PR_DENO, '') as denominacion,
      NULLIF(PR_DOM, '') as domicilio,
      NULLIF(PR_POB, '') as poblacion,
      NULLIF(PR_PROV, '') as provincia,
      NULLIF(PR_CDP, '') as codigo_postal,
      NULLIF(PR_TEL, '') as telefono,
      NULLIF(PR_FAX, '') as fax,
      NULLIF(PR_CIF, '') as cif,
      NULLIF(PR_EMA, '') as email,
      NULLIF(PR_WEB, '') as web,
      NULLIF(PR_DOMEN, '') as domicilio_envio
    FROM proveedores
    WHERE LOWER(PR_PROV) LIKE LOWER(?)
    ORDER BY PR_DENO
    LIMIT ?`;
  
  try {
    const [results] = await db.query(query, [`%${provincia}%`, limit]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryProveedoresPorPoblacion(poblacion) {
  const query = `
    SELECT 
      id,
      NULLIF(PR_DENO, '') as denominacion,
      NULLIF(PR_DOM, '') as domicilio,
      NULLIF(PR_POB, '') as poblacion,
      NULLIF(PR_PROV, '') as provincia,
      NULLIF(PR_CDP, '') as codigo_postal,
      NULLIF(PR_TEL, '') as telefono,
      NULLIF(PR_FAX, '') as fax,
      NULLIF(PR_CIF, '') as cif,
      NULLIF(PR_EMA, '') as email,
      NULLIF(PR_WEB, '') as web
    FROM proveedores
    WHERE LOWER(PR_POB) LIKE LOWER(?)`;
  
  try {
    const [results] = await db.query(query, [`%${poblacion}%`]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryProveedorPorNombre(nombre) {
  const query = `
    SELECT 
      id,
      NULLIF(PR_DENO, '') as denominacion,
      NULLIF(PR_DOM, '') as domicilio,
      NULLIF(PR_POB, '') as poblacion,
      NULLIF(PR_PROV, '') as provincia,
      NULLIF(PR_CDP, '') as codigo_postal,
      NULLIF(PR_TEL, '') as telefono,
      NULLIF(PR_FAX, '') as fax,
      NULLIF(PR_CIF, '') as cif,
      NULLIF(PR_EMA, '') as email,
      NULLIF(PR_WEB, '') as web,
      NULLIF(PR_DOMEN, '') as domicilio_envio
    FROM proveedores
    WHERE LOWER(PR_DENO) LIKE LOWER(?)`;
  
  try {
    const [results] = await db.query(query, [`%${nombre}%`]);
    return results[0];
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryProveedorPorId(id) {
  const query = `
    SELECT 
      id,
      NULLIF(PR_DENO, '') as denominacion,
      NULLIF(PR_DOM, '') as domicilio,
      NULLIF(PR_POB, '') as poblacion,
      NULLIF(PR_PROV, '') as provincia,
      NULLIF(PR_CDP, '') as codigo_postal,
      NULLIF(PR_TEL, '') as telefono,
      NULLIF(PR_FAX, '') as fax,
      NULLIF(PR_CIF, '') as cif,
      NULLIF(PR_EMA, '') as email,
      NULLIF(PR_WEB, '') as web,
      NULLIF(PR_DOMEN, '') as domicilio_envio
    FROM proveedores
    WHERE id = ?`;
  
  try {
    const [results] = await db.query(query, [id]);
    return results[0];
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryProveedoresPorLetra(letra, limit = 10) {
  const query = `
    SELECT 
      id,
      NULLIF(PR_DENO, '') as denominacion,
      NULLIF(PR_POB, '') as poblacion,
      NULLIF(PR_PROV, '') as provincia
    FROM proveedores
    WHERE PR_DENO LIKE ?
    ORDER BY PR_DENO
    LIMIT ?`;
  
  try {
    const [results] = await db.query(query, [`${letra}%`, limit]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryProveedoresConWeb() {
  const query = `
    SELECT 
      id,
      NULLIF(PR_DENO, '') as denominacion,
      NULLIF(PR_EMA, '') as email,
      NULLIF(PR_WEB, '') as web
    FROM proveedores
    WHERE PR_WEB IS NOT NULL 
    AND PR_WEB != ''
    AND PR_EMA IS NOT NULL 
    AND PR_EMA != ''`;
  
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryProveedoresConTelefono(limit = 5) {
  const query = `
    SELECT 
      id,
      NULLIF(PR_DENO, '') as denominacion,
      NULLIF(PR_TEL, '') as telefono
    FROM proveedores
    WHERE PR_TEL IS NOT NULL 
    AND PR_TEL != ''
    ORDER BY PR_DENO
    LIMIT ?`;
  
  try {
    const [results] = await db.query(query, [limit]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryProveedoresPorTelefono(telefono) {
  const query = `
    SELECT 
      id,
      NULLIF(PR_DENO, '') as denominacion,
      NULLIF(PR_TEL, '') as telefono,
      NULLIF(PR_EMA, '') as email
    FROM proveedores
    WHERE PR_TEL LIKE ?`;
  
  try {
    const [results] = await db.query(query, [`%${telefono}%`]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryProveedoresConFax() {
  const query = `
    SELECT 
      id,
      NULLIF(PR_DENO, '') as denominacion,
      NULLIF(PR_FAX, '') as fax
    FROM proveedores
    WHERE PR_FAX IS NOT NULL 
    AND PR_FAX != ''
    ORDER BY PR_DENO`;
  
  try {
    const [results] = await db.query(query);
    return results;
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

    // Detección del tipo de consulta
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
    } else if (messageLower.includes('vendedor') || messageLower.includes('vendedora') || 
               messageLower.includes('gestion') || messageLower.includes('gestiona')) {
      vendedoresData = await queryVendedores();
      dbData = await queryAccionesCom();
      contextType = 'acciones_comerciales';
    } else if (messageLower.includes('acciones comerciales') || messageLower.includes('acciones registradas')) {
      vendedoresData = await queryVendedores();
      dbData = await queryAccionesCom(10);
      contextType = 'acciones_comerciales';
    } else if (messageLower.includes('clientes') || messageLower.includes('cliente')) {
      contextType = 'clientes';
      
      if (messageLower.includes('provincia')) {
        const provincia = messageLower.match(/provincia de ([a-zá-úñ\s]+)/i)?.[1];
        if (provincia) {
          dbData = await queryClientesPorProvincia(provincia);
          contextType = 'clientes_provincia';
        }
      } else if (messageLower.includes('población') || messageLower.includes('poblacion')) {
        const poblacion = messageLower.match(/población de ([a-zá-úñ\s]+)/i)?.[1] || 
                         messageLower.match(/poblacion de ([a-zá-úñ\s]+)/i)?.[1];
        if (poblacion) {
          dbData = await queryClientesPorPoblacion(poblacion);
          contextType = 'clientes_poblacion';
        }
      } else if (messageLower.includes('cif')) {
        const cif = messageLower.match(/cif ([a-z0-9]+)/i)?.[1];
        if (cif) {
          dbData = await queryClientePorCIF(cif);
          contextType = 'cliente_cif';
        }
      } else if (messageLower.includes('ordenados')) {
        dbData = await queryClientesOrdenados();
        contextType = 'clientes_ordenados';
      } else if (messageLower.includes('españa') || messageLower.includes('espana')) {
        dbData = await queryClientesPorPais('ESPAÑA');
        contextType = 'clientes_pais';
      } else if (messageLower.includes('información de') || messageLower.includes('informacion de')) {
        const nombre = messageLower.match(/información de "(.*?)"/i)?.[1] || 
                      messageLower.match(/informacion de "(.*?)"/i)?.[1];
        if (nombre) {
          dbData = await queryClientePorNombre(nombre);
          contextType = 'cliente_nombre';
        } else {
          dbData = await queryClientesOrdenados(5);
          contextType = 'clientes_info';
        }
      }
    } else if (messageLower.includes('proveedor') || messageLower.includes('proveedores')) {
      if (messageLower.includes('provincia')) {
        const provincia = messageLower.match(/provincia de ([a-zá-úñ\s]+)/i)?.[1];
        if (provincia) {
          dbData = await queryProveedoresPorProvincia(provincia);
          contextType = 'proveedores_provincia';
        }
      } else if (messageLower.includes('población') || messageLower.includes('poblacion')) {
        const poblacion = messageLower.match(/población de ([a-zá-úñ\s]+)/i)?.[1] || 
                         messageLower.match(/poblacion de ([a-zá-úñ\s]+)/i)?.[1];
        if (poblacion) {
          dbData = await queryProveedoresPorPoblacion(poblacion);
          contextType = 'proveedores_poblacion';
        }
      } else if (messageLower.includes('código') || messageLower.includes('codigo')) {
        const codigo = messageLower.match(/código (\d+)/i)?.[1] || 
                      messageLower.match(/codigo (\d+)/i)?.[1];
        if (codigo) {
          dbData = await queryProveedorPorId(codigo.padStart(5, '0'));
          contextType = 'proveedor_id';
        }
      } else if (messageLower.includes('empiecen con') || messageLower.includes('letra')) {
        const letra = messageLower.match(/letra ["']?([a-z])["']?/i)?.[1];
        if (letra) {
          dbData = await queryProveedoresPorLetra(letra);
          contextType = 'proveedores_letra';
        }
      } else if (messageLower.includes('web') || messageLower.includes('página web')) {
        dbData = await queryProveedoresConWeb();
        contextType = 'proveedores_web';
      } else if (messageLower.includes('teléfono') || messageLower.includes('telefono')) {
        if (messageLower.includes('número')) {
          const telefono = messageLower.match(/número[:\s]+([0-9\s]+)/i)?.[1];
          if (telefono) {
            dbData = await queryProveedoresPorTelefono(telefono.trim());
            contextType = 'proveedor_telefono';
          }
        } else {
          dbData = await queryProveedoresConTelefono();
          contextType = 'proveedores_con_telefono';
        }
      } else if (messageLower.includes('fax')) {
        dbData = await queryProveedoresConFax();
        contextType = 'proveedores_fax';
      } else if (messageLower.includes('información completa') || messageLower.includes('informacion completa')) {
        const nombre = messageLower.match(/["'](.*?)["']/)?.[1];
        if (nombre) {
          dbData = await queryProveedorPorNombre(nombre);
          contextType = 'proveedor_info_completa';
        }
      }
    } else {
      // Manejo de conversación general
      contextType = 'conversacion_general';
    }

    // Preparar el prompt según el tipo de consulta
    let systemContent = `Eres un asistente experto del ERP DEITANA de Semilleros Deitana.\n\n`;

    if (contextType === 'conversacion_general') {
      systemContent += `CONTEXTO IMPORTANTE:
- Eres un asistente amigable y profesional de Semilleros Deitana.
- Puedes ayudar con consultas sobre:
  * Artículos y proveedores
  * Acciones comerciales y vendedores
  * Información de clientes
  * Conversación general relacionada con el negocio

HISTORIAL DE CONVERSACIÓN:
${assistantContext.conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

INSTRUCCIONES:
1. Mantén un tono profesional pero amigable
2. Si el mensaje es general (saludos, agradecimientos, etc.), responde apropiadamente
3. Si no entiendes la consulta, pide aclaraciones
4. Sugiere tipos de consultas que puedes responder
5. Responde en español

EJEMPLOS DE CONSULTAS QUE PUEDO AYUDAR:
- Información sobre proveedores y sus productos
- Detalles de acciones comerciales y vendedores
- Datos de clientes y su información de contacto
- Consultas generales sobre el negocio`;
    } else if (contextType === 'acciones_comerciales') {
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
    } else if (contextType.startsWith('cliente')) {
      systemContent += `CONTEXTO IMPORTANTE:
- La información de clientes es sensible y debe manejarse con cuidado.
- Cada cliente tiene un ID único y puede tener diversos campos de información.
- Los campos vacíos o null indican que no hay información disponible.

DATOS DISPONIBLES:
${JSON.stringify(dbData || {}, null, 2)}

INSTRUCCIONES ESPECÍFICAS:
1. Para consultas sobre clientes:
   - Muestra SOLO la información disponible en la base de datos
   - Para campos vacíos, indica "No hay información disponible"
   - NO incluyas datos sensibles innecesarios
2. Para búsquedas específicas:
   - Usa EXACTAMENTE los datos encontrados
   - Respeta el formato y orden de los campos
   - Indica claramente cuando no se encuentran resultados
3. Para conteos y estadísticas:
   - Proporciona números exactos
   - Incluye el contexto relevante (provincia, población, etc.)

REGLAS ESTRICTAS:
1. NUNCA inventes datos de clientes
2. NUNCA modifiques la información existente
3. NUNCA asumas datos que no estén en la base
4. Protege la privacidad de los datos sensibles

FORMATO DE RESPUESTA:
- Estructura clara y organizada
- Indica campos faltantes como "No disponible"
- Usa formato legible para teléfonos y direcciones
- Responde en español`;
    } else if (contextType.startsWith('proveedor')) {
      systemContent += `CONTEXTO IMPORTANTE:
- La información de proveedores es sensible y debe manejarse con cuidado.
- Cada proveedor tiene un ID único y diversos campos de información.
- Los campos vacíos o null indican que no hay información disponible.

DATOS DISPONIBLES:
${JSON.stringify(dbData || {}, null, 2)}

INSTRUCCIONES ESPECÍFICAS:
1. Para consultas sobre proveedores:
   - Muestra SOLO la información disponible en la base de datos
   - Para campos vacíos, indica "No hay información disponible"
   - Formatea teléfonos y direcciones de manera legible
2. Para búsquedas específicas:
   - Usa EXACTAMENTE los datos encontrados
   - Respeta el formato original de los datos
   - Indica claramente cuando no se encuentran resultados
3. Para listados:
   - Organiza la información de manera clara
   - Incluye el ID y nombre siempre que estén disponibles
   - Agrupa información relacionada

REGLAS ESTRICTAS:
1. NUNCA inventes datos de proveedores
2. NUNCA modifiques la información existente
3. NUNCA asumas datos que no estén en la base
4. Protege la privacidad de los datos sensibles

FORMATO DE RESPUESTA:
- Estructura clara y organizada
- Indica campos faltantes como "No disponible"
- Usa formato legible para teléfonos y direcciones
- Responde en español`;
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
      temperature: contextType === 'conversacion_general' ? 0.8 : 0.7,
      max_tokens: 2000
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
      message: "Lo siento, estoy teniendo problemas para procesar tu consulta en este momento. Por favor, verifica que tu pregunta esté relacionada con artículos, proveedores, acciones comerciales o clientes, y vuelve a intentarlo.",
      context: assistantContext
    };
  }
}

module.exports = {
  processMessage
};