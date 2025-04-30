const axios = require('axios');
const db = require('../db');

// Sistema de contexto para el asistente
const assistantContext = {
  currentTopic: null,
  lastQuery: null,
  lastResponse: null,
  conversationHistory: [],
  lastIndex: 0,  // Índice para controlar qué acción mostrar
  lastCreditoCaucion: null
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

async function queryAccionesCom(limit = null, offset = 0) {
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
    ${limit ? 'LIMIT ? OFFSET ?' : ''}`;
  
  try {
    const [results] = await db.query(query, limit ? [limit, offset] : []);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryAccionesComerciales() {
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
    WHERE ac.ACCO_FEC >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
    GROUP BY ac.id, v.id, c.id, ac.ACCO_DENO, ac.ACCO_FEC, ac.ACCO_HOR
    ORDER BY ac.ACCO_FEC DESC, ac.ACCO_HOR DESC
    LIMIT 50`;
  
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error al consultar acciones comerciales:', error);
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

async function queryUltimaAccionComercial() {
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
    LIMIT 1`;
  
  try {
    const [results] = await db.query(query);
    return results[0] || null;
  } catch (error) {
    console.error('Error al consultar última acción comercial:', error);
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

async function queryVendedoresDetallado(limit = null, offset = 0) {
  const query = `
    SELECT 
      v.id,
      v.VD_DENO,
      NULLIF(v.VD_DOM, '') as VD_DOM,
      NULLIF(v.VD_POB, '') as VD_POB,
      NULLIF(v.VD_PROV, '') as VD_PROV,
      NULLIF(v.VD_PDA, '') as VD_PDA,
      t.TN_DENO as tecnico_nombre,
      t.TN_TEL as tecnico_telefono,
      t.TN_EMA as tecnico_email,
      t.TN_DOM as tecnico_domicilio,
      t.TN_POB as tecnico_poblacion,
      t.TN_PROV as tecnico_provincia,
      t.TN_CIF as tecnico_cif,
      GROUP_CONCAT(
        DISTINCT vo.C0 
        ORDER BY vo.id2 
        SEPARATOR '|||'
      ) as observaciones
    FROM vendedores v
    LEFT JOIN tecnicos t ON v.VD_PDA = t.id
    LEFT JOIN vendedores_vd_obs vo ON v.id = vo.id
    GROUP BY 
      v.id, v.VD_DENO, v.VD_DOM, v.VD_POB, v.VD_PROV, v.VD_PDA,
      t.TN_DENO, t.TN_TEL, t.TN_EMA, t.TN_DOM, t.TN_POB, t.TN_PROV, t.TN_CIF
    ORDER BY CAST(v.id AS SIGNED)
    LIMIT ? OFFSET ?`;
  
  try {
    const [results] = await db.query(query, [limit || 10, offset]);
    
    // Procesar los resultados según las reglas especificadas
    return results.map(r => ({
      id: r.id,
      nombre: r.VD_DENO,
      domicilio: r.VD_DOM || null,
      poblacion: r.VD_POB || null,
      provincia: r.VD_PROV || null,
      numero_tecnico: r.VD_PDA || null,
      // Información técnica si está disponible
      tecnico: r.VD_PDA ? {
        nombre: r.tecnico_nombre,
        telefono: r.tecnico_telefono,
        email: r.tecnico_email,
        domicilio: r.tecnico_domicilio,
        poblacion: r.tecnico_poblacion,
        provincia: r.tecnico_provincia,
        cif: r.tecnico_cif
      } : null,
      // Procesar observaciones
      observaciones: r.observaciones ? 
        r.observaciones.split('|||').filter(obs => obs.trim()) : 
        []
    }));
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryVendedorPorId(id) {
  const query = `
    SELECT 
      v.id as vendedor_id,
      v.VD_DENO as nombre_vendedor,
      NULLIF(v.VD_DOM, '') as domicilio,
      NULLIF(v.VD_POB, '') as poblacion,
      NULLIF(v.VD_PROV, '') as provincia,
      NULLIF(v.VD_PDA, '') as numero_tecnico,
      t.TN_DENO as nombre_tecnico,
      t.TN_TEL as telefono_tecnico,
      t.TN_EMA as email_tecnico,
      t.TN_DOM as domicilio_tecnico,
      t.TN_POB as poblacion_tecnico,
      t.TN_PROV as provincia_tecnico,
      t.TN_CIF as cif_tecnico,
      GROUP_CONCAT(DISTINCT vo.C0 ORDER BY vo.id2 SEPARATOR '|||') as observaciones
    FROM vendedores v
    LEFT JOIN tecnicos t ON v.VD_PDA = t.id
    LEFT JOIN vendedores_vd_obs vo ON v.id = vo.id
    WHERE v.id = ?
    GROUP BY v.id, v.VD_DENO, v.VD_DOM, v.VD_POB, v.VD_PROV, v.VD_PDA, 
             t.TN_DENO, t.TN_TEL, t.TN_EMA, t.TN_DOM, t.TN_POB, t.TN_PROV, t.TN_CIF`;

  try {
    const [results] = await db.query(query, [id]);
    if (results[0]) {
      return {
        ...results[0],
        observaciones: results[0].observaciones ? results[0].observaciones.split('|||').filter(obs => obs.trim()) : []
      };
    }
    return null;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryVendedorPorNombre(nombre) {
  const query = `
    SELECT 
      v.id as vendedor_id,
      v.VD_DENO as nombre_vendedor,
      NULLIF(v.VD_DOM, '') as domicilio,
      NULLIF(v.VD_POB, '') as poblacion,
      NULLIF(v.VD_PROV, '') as provincia,
      NULLIF(v.VD_PDA, '') as numero_tecnico,
      t.TN_DENO as nombre_tecnico,
      t.TN_TEL as telefono_tecnico,
      t.TN_EMA as email_tecnico,
      t.TN_DOM as domicilio_tecnico,
      t.TN_POB as poblacion_tecnico,
      t.TN_PROV as provincia_tecnico,
      t.TN_CIF as cif_tecnico,
      GROUP_CONCAT(DISTINCT vo.C0 ORDER BY vo.id2 SEPARATOR '|||') as observaciones
    FROM vendedores v
    LEFT JOIN tecnicos t ON v.VD_PDA = t.id
    LEFT JOIN vendedores_vd_obs vo ON v.id = vo.id
    WHERE LOWER(v.VD_DENO) LIKE LOWER(?)
    GROUP BY v.id, v.VD_DENO, v.VD_DOM, v.VD_POB, v.VD_PROV, v.VD_PDA, 
             t.TN_DENO, t.TN_TEL, t.TN_EMA, t.TN_DOM, t.TN_POB, t.TN_PROV, t.TN_CIF`;

  try {
    const [results] = await db.query(query, [`%${nombre}%`]);
    return results.map(r => ({
      ...r,
      observaciones: r.observaciones ? r.observaciones.split('|||').filter(obs => obs.trim()) : []
    }));
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryObservacionesVendedor(vendedorId) {
  const query = `
    SELECT 
      id,
      id2,
      C0 as observacion
    FROM vendedores_vd_obs
    WHERE id = ?
    ORDER BY id2`;

  try {
    const [results] = await db.query(query, [vendedorId]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryTodosVendedores(limit = null) {
  const query = `
    SELECT 
      v.id as vendedor_id,
      v.VD_DENO as nombre_vendedor,
      NULLIF(v.VD_DOM, '') as domicilio,
      NULLIF(v.VD_POB, '') as poblacion,
      NULLIF(v.VD_PROV, '') as provincia,
      NULLIF(v.VD_PDA, '') as numero_tecnico,
      t.TN_DENO as nombre_tecnico,
      GROUP_CONCAT(DISTINCT vo.C0 ORDER BY vo.id2 SEPARATOR '|||') as observaciones
    FROM vendedores v
    LEFT JOIN tecnicos t ON v.VD_PDA = t.id
    LEFT JOIN vendedores_vd_obs vo ON v.id = vo.id
    GROUP BY v.id, v.VD_DENO, v.VD_DOM, v.VD_POB, v.VD_PROV, v.VD_PDA, t.TN_DENO
    ORDER BY CAST(v.id AS SIGNED)
    ${limit ? 'LIMIT ?' : ''}`;

  try {
    const [results] = await db.query(query, limit ? [limit] : []);
    return results.map(r => ({
      ...r,
      observaciones: r.observaciones ? r.observaciones.split('|||').filter(obs => obs.trim()) : []
    }));
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryTotalVendedores() {
  const query = `SELECT COUNT(DISTINCT id) as total FROM vendedores`;
  
  try {
    const [results] = await db.query(query);
    return results[0]?.total || 0;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return 0;
  }
}

async function queryVendedorMasAcciones() {
  const query = `
    SELECT 
      v.id as vendedor_id,
      v.VD_DENO as nombre_vendedor,
      COUNT(DISTINCT ac.id) as total_acciones,
      GROUP_CONCAT(DISTINCT ac.ACCO_DENO) as tipos_acciones,
      MIN(ac.ACCO_FEC) as primera_accion,
      MAX(ac.ACCO_FEC) as ultima_accion
    FROM vendedores v
    INNER JOIN acciones_com ac ON v.id = ac.ACCO_CDVD
    GROUP BY v.id, v.VD_DENO
    ORDER BY COUNT(DISTINCT ac.id) DESC
    LIMIT 1`;
  
  try {
    const [results] = await db.query(query);
    return results[0];
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryBandejas(limit = null) {
  const query = `
    SELECT 
      id,
      BN_DENO as denominacion,
      BN_ALV as total_alveolos,
      BN_RET as retornable,
      BN_PVP as precio_venta,
      BN_COS as coste,
      BN_ALVC as alveolos_columna,
      BN_EM2 as metros_cuadrados,
      BN_ALVG as alveolos_grandes
    FROM bandejas
    ORDER BY CAST(BN_ALV AS SIGNED) DESC
    ${limit ? 'LIMIT ?' : ''}`;
  
  try {
    const [results] = await db.query(query, limit ? [limit] : []);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryBandejasConMasAlveolos(minAlveolos) {
  const query = `
    SELECT 
      id,
      BN_DENO as denominacion,
      BN_ALV as total_alveolos,
      BN_RET as retornable,
      BN_PVP as precio_venta,
      BN_ALVC as alveolos_columna,
      BN_EM2 as metros_cuadrados
    FROM bandejas
    WHERE BN_ALV >= ?
    ORDER BY BN_ALV DESC`;
  
  try {
    const [results] = await db.query(query, [minAlveolos]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryBandejaMasAlveolos() {
  const query = `
    SELECT 
      id,
      BN_DENO as denominacion,
      BN_ALV as total_alveolos,
      BN_RET as retornable,
      BN_PVP as precio_venta,
      BN_ALVC as alveolos_columna,
      BN_EM2 as metros_cuadrados
    FROM bandejas
    ORDER BY CAST(BN_ALV AS SIGNED) DESC
    LIMIT 1`;
  
  try {
    const [results] = await db.query(query);
    return results[0];
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryCasasComerciales(provincia = null, limit = null) {
  const query = `
    SELECT 
      id,
      NULLIF(CC_DENO, '') as denominacion,
      NULLIF(CC_NOM, '') as nombre_comercial,
      NULLIF(CC_DOM, '') as domicilio,
      NULLIF(CC_POB, '') as poblacion,
      NULLIF(CC_PROV, '') as provincia,
      NULLIF(CC_CDP, '') as codigo_postal,
      NULLIF(CC_TEL, '') as telefono,
      NULLIF(CC_FAX, '') as fax,
      NULLIF(CC_CIF, '') as cif,
      NULLIF(CC_EMA, '') as email,
      NULLIF(CC_WEB, '') as web,
      NULLIF(CC_PAIS, '') as pais
    FROM casas_com
    ${provincia ? 'WHERE LOWER(CC_PROV) LIKE LOWER(?)' : ''}
    ORDER BY CC_DENO
    ${limit ? 'LIMIT ?' : ''}`;
  
  try {
    const params = [];
    if (provincia) params.push(`%${provincia}%`);
    if (limit) params.push(limit);
    
    const [results] = await db.query(query, params);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryCasasComercialesTodas() {
  const query = `
    SELECT 
      id,
      NULLIF(CC_DENO, '') as denominacion,
      NULLIF(CC_POB, '') as poblacion,
      NULLIF(CC_PROV, '') as provincia
    FROM casas_com
    ORDER BY CC_DENO`;
  
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryCasasComercialConFiltros(options = {}) {
  const { provincia, codigoPostal, conTelefono, conEmail, conWeb } = options;
  
  let conditions = [];
  let params = [];
  
  if (provincia) {
    conditions.push('LOWER(CC_PROV) LIKE LOWER(?)');
    params.push(`%${provincia}%`);
  }
  
  if (codigoPostal) {
    conditions.push('CC_CDP = ?');
    params.push(codigoPostal);
  }
  
  if (conTelefono) {
    conditions.push('CC_TEL IS NOT NULL AND CC_TEL != ""');
  }
  
  if (conEmail) {
    conditions.push('CC_EMA IS NOT NULL AND CC_EMA != ""');
  }
  
  if (conWeb) {
    conditions.push('CC_WEB IS NOT NULL AND CC_WEB != ""');
  }
  
  const query = `
    SELECT 
      id,
      NULLIF(CC_DENO, '') as denominacion,
      NULLIF(CC_NOM, '') as nombre_comercial,
      NULLIF(CC_DOM, '') as domicilio,
      NULLIF(CC_POB, '') as poblacion,
      NULLIF(CC_PROV, '') as provincia,
      NULLIF(CC_CDP, '') as codigo_postal,
      NULLIF(CC_TEL, '') as telefono,
      NULLIF(CC_EMA, '') as email,
      NULLIF(CC_WEB, '') as web
    FROM casas_com
    ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
    ORDER BY CC_DENO
    ${options.limit ? 'LIMIT ?' : ''}`;
  
  if (options.limit) params.push(options.limit);
  
  try {
    const [results] = await db.query(query, params);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryCategorias() {
  const query = `
    SELECT 
      id,
      NULLIF(CG_DENO, '') as denominacion,
      CG_SALDIA as salario_diario,
      CG_COSHOR as coste_hora,
      CG_SDIA as coste_hora_extra
    FROM categorias
    ORDER BY CG_DENO`;
  
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryCategoriaPorNombre(nombre) {
  const query = `
    SELECT 
      id,
      NULLIF(CG_DENO, '') as denominacion,
      CG_SALDIA as salario_diario,
      CG_COSHOR as coste_hora,
      CG_SDIA as coste_hora_extra
    FROM categorias
    WHERE LOWER(CG_DENO) LIKE LOWER(?)`;
  
  try {
    const [results] = await db.query(query, [`%${nombre}%`]);
    return results[0];
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryCreditosCaucion(limit = null) {
  const query = `
    SELECT 
      cc.id,
      cc.CAU_CCL as cliente_id,
      cc.CAU_DIAS as dias_maximos,
      cc.CAU_TIPO as tipo,
      c.CL_DENO as nombre_cliente,
      GROUP_CONCAT(
        DISTINCT obs.C0 
        ORDER BY obs.id2 
        SEPARATOR '|||'
      ) as observaciones
    FROM creditocau cc
    LEFT JOIN clientes c ON cc.CAU_CCL = c.id
    LEFT JOIN creditocau_cau_obs obs ON cc.id = obs.id
    WHERE obs.id IS NOT NULL
    GROUP BY cc.id, cc.CAU_CCL, cc.CAU_DIAS, cc.CAU_TIPO, c.CL_DENO
    ORDER BY RAND()
    LIMIT 1`;
  
  try {
    const [results] = await db.query(query);
    if (!results || results.length === 0) {
      return null;
    }

    return results.map(r => ({
      ...r,
      observaciones: r.observaciones ? r.observaciones.split('|||').filter(obs => obs.trim()) : [],
      tipo_descripcion: r.tipo === 'A' ? 'Asegurado' : 'No Asegurado'
    }));
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryClientePorId(clienteId) {
  const query = `
    SELECT 
      id,
      CL_DENO as denominacion,
      CL_DOM as domicilio,
      CL_POB as poblacion,
      CL_PROV as provincia,
      CL_CDP as codigo_postal,
      CL_TEL as telefono,
      CL_FAX as fax,
      CL_CIF as cif,
      CL_EMA as email,
      CL_WEB as web,
      CL_PAIS as pais
    FROM clientes
    WHERE id = ?`;
  
  try {
    const [results] = await db.query(query, [clienteId]);
    return results[0] || null;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryTotalArticulos() {
  const query = `
    SELECT COUNT(*) as total
    FROM articulos`;
  
  try {
    const [results] = await db.query(query);
    return results[0]?.total || 0;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return 0;
  }
}

async function queryEjemplosArticulos(limit = 5) {
  const query = `
    SELECT 
      a.id,
      a.AR_DENO as denominacion,
      a.AR_BAR as codigo_barras,
      a.AR_TIVA as tipo_iva,
      a.AR_GRP as grupo,
      a.AR_FAM as familia,
      a.AR_PRV as proveedor_id,
      p.PR_DENO as nombre_proveedor
    FROM articulos a
    LEFT JOIN proveedores p ON a.AR_PRV = p.id
    ORDER BY RAND()
    LIMIT ?`;
  
  try {
    const [results] = await db.query(query, [limit]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryArticulosConCodigoBarras() {
  const query = `
    SELECT 
      a.id,
      a.AR_DENO as denominacion,
      a.AR_BAR as codigo_barras,
      p.PR_DENO as nombre_proveedor
    FROM articulos a
    LEFT JOIN proveedores p ON a.AR_PRV = p.id
    WHERE a.AR_BAR IS NOT NULL AND a.AR_BAR != ''
    ORDER BY a.AR_DENO`;
  
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryArticulosSinProveedor() {
  const query = `
    SELECT 
      a.id,
      a.AR_DENO as denominacion,
      a.AR_BAR as codigo_barras
    FROM articulos a
    WHERE a.AR_PRV IS NULL OR a.AR_PRV = ''
    ORDER BY a.AR_DENO`;
  
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryArticulosPorGrupo(grupo) {
  const query = `
    SELECT 
      a.id,
      a.AR_DENO as denominacion,
      a.AR_BAR as codigo_barras,
      a.AR_GRP as grupo,
      a.AR_FAM as familia,
      p.PR_DENO as nombre_proveedor
    FROM articulos a
    LEFT JOIN proveedores p ON a.AR_PRV = p.id
    WHERE a.AR_GRP = ?
    ORDER BY a.AR_DENO`;
  
  try {
    const [results] = await db.query(query, [grupo]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryArticulosPorTipo(tipo) {
  const query = `
    SELECT 
      a.id,
      a.AR_DENO as denominacion,
      a.AR_BAR as codigo_barras,
      p.PR_DENO as nombre_proveedor
    FROM articulos a
    LEFT JOIN proveedores p ON a.AR_PRV = p.id
    WHERE LOWER(a.AR_DENO) LIKE LOWER(?)
    ORDER BY a.AR_DENO`;
  
  try {
    const [results] = await db.query(query, [`%${tipo}%`]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryTiposProductoYProveedores(producto) {
  const query = `
    SELECT 
      a.id,
      a.AR_DENO as denominacion,
      a.AR_PRV as proveedor_id,
      p.PR_DENO as nombre_proveedor,
      COUNT(*) OVER (PARTITION BY a.AR_PRV) as total_por_proveedor
    FROM articulos a
    LEFT JOIN proveedores p ON a.AR_PRV = p.id
    WHERE LOWER(a.AR_DENO) LIKE LOWER(?)
    ORDER BY p.PR_DENO, a.AR_DENO`;
  
  try {
    const [results] = await db.query(query, [`%${producto}%`]);
    
    // Agrupar por proveedor
    const agrupadoPorProveedor = results.reduce((acc, item) => {
      if (!acc[item.nombre_proveedor || 'Sin proveedor']) {
        acc[item.nombre_proveedor || 'Sin proveedor'] = {
          proveedor: item.nombre_proveedor || 'Sin proveedor',
          total: item.total_por_proveedor,
          articulos: []
        };
      }
      acc[item.nombre_proveedor || 'Sin proveedor'].articulos.push(item.denominacion);
      return acc;
    }, {});

    return {
      total_tipos: results.length,
      por_proveedor: Object.values(agrupadoPorProveedor)
    };
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
    if (messageLower.includes('artículo') || messageLower.includes('articulo') || 
        messageLower.includes('artículos') || messageLower.includes('articulos') ||
        messageLower.includes('producto') || messageLower.includes('productos')) {
      
      if (messageLower.includes('ejemplo') || messageLower.includes('muestra') || 
          messageLower.includes('dime') || messageLower.includes('un')) {
        dbData = await queryEjemplosArticulos(1);
        contextType = 'ejemplo_articulo';
      } else if (messageLower.includes('cuántos') || messageLower.includes('cuantos') || 
                 messageLower.includes('total') || messageLower.includes('inventario')) {
        dbData = await queryTotalArticulos();
        contextType = 'total_articulos';
      } else if (messageLower.includes('código de barras') || messageLower.includes('codigo de barras')) {
        dbData = await queryArticulosConCodigoBarras();
        contextType = 'articulos_codigo_barras';
      } else if (messageLower.includes('sin proveedor') || messageLower.includes('no tiene proveedor')) {
        dbData = await queryArticulosSinProveedor();
        contextType = 'articulos_sin_proveedor';
      } else if (messageLower.includes('grupo')) {
        const grupoMatch = messageLower.match(/grupo (\d+)/);
        if (grupoMatch) {
          dbData = await queryArticulosPorGrupo(grupoMatch[1]);
          contextType = 'articulos_por_grupo';
        }
      } else if (messageLower.includes('tipo') || messageLower.includes('variedad')) {
        const tipoMatch = messageLower.match(/tipo de ([a-zá-úñ]+)/i) || 
                         messageLower.match(/variedad de ([a-zá-úñ]+)/i);
        if (tipoMatch) {
          dbData = await queryArticulosPorTipo(tipoMatch[1]);
          contextType = 'articulos_por_tipo';
        }
      } else {
        dbData = await queryEjemplosArticulos(10);
        contextType = 'articulos_general';
      }
    } else if (messageLower.includes('acciones comerciales') || 
               messageLower.includes('acciones realizadas') ||
               messageLower.includes('interacciones con clientes') ||
               messageLower.includes('gestiones comerciales')) {
      
      // Detectar consultas específicas sobre acciones comerciales
      if (messageLower.includes('última') || messageLower.includes('ultima')) {
        dbData = await queryUltimaAccionComercial();
        contextType = 'ultima_accion_comercial';
      } else if (messageLower.match(/\d{4}/)) {
        const anio = messageLower.match(/\d{4}/)[0];
        dbData = await queryAccionesComercialesPorAnio(anio);
        contextType = 'acciones_comerciales_anio';
      } else if (messageLower.includes('tipo') || messageLower.includes('tipos')) {
        const tipos = ['CAMPAÑA', 'COBROS', 'E-MAIL', 'INCIDENCIA', 'LLAMADA', 'NEGOCIACION', 'OTROS', 'TARJETA', 'VISITA'];
        dbData = tipos;
        contextType = 'tipos_acciones_comerciales';
      } else if (messageLower.includes('estadísticas') || messageLower.includes('estadisticas')) {
        dbData = await queryEstadisticasAccionesComerciales();
        contextType = 'estadisticas_acciones_comerciales';
      } else {
        dbData = await queryAccionesComerciales();
        contextType = 'acciones_comerciales';
      }
    } else if (messageLower.includes('vendedor') && 
               (messageLower.includes('más acciones') || 
                messageLower.includes('mas acciones') || 
                messageLower.includes('gestionó más') || 
                messageLower.includes('gestiono mas'))) {
      dbData = await queryVendedorMasAcciones();
      contextType = 'vendedor_mas_acciones';
    } else if (messageLower.includes('incidencia') || messageLower.includes('incidencias')) {
      dbData = await queryAccionesComercialesPorTipo('INCIDENCIA');
      contextType = 'incidencias';
    } else if (messageLower.includes('visita') || messageLower.includes('visitas')) {
      dbData = await queryAccionesComercialesPorTipo('VISITA');
      contextType = 'visitas';
    } else if (messageLower.includes('llamada') || messageLower.includes('llamadas')) {
      dbData = await queryAccionesComercialesPorTipo('LLAMADA');
      contextType = 'llamadas';
    } else if (messageLower.includes('email') || messageLower.includes('correo')) {
      dbData = await queryAccionesComercialesPorTipo('E-MAIL');
      contextType = 'emails';
    } else if (messageLower.includes('negociación') || messageLower.includes('negociacion')) {
      dbData = await queryAccionesComercialesPorTipo('NEGOCIACION');
      contextType = 'negociaciones';
    } else if (messageLower.includes('campaña') || messageLower.includes('campana')) {
      dbData = await queryAccionesComercialesPorTipo('CAMPAÑA');
      contextType = 'campanas';
    } else if (messageLower.includes('cobros')) {
      dbData = await queryAccionesComercialesPorTipo('COBROS');
      contextType = 'cobros';
    } else if (messageLower.includes('tarjeta')) {
      dbData = await queryAccionesComercialesPorTipo('TARJETA');
      contextType = 'tarjetas';
    } else if (messageLower.includes('otros')) {
      dbData = await queryAccionesComercialesPorTipo('OTROS');
      contextType = 'otros';
    } else if (messageLower.includes('proveedor') && messageLower.includes('más productos')) {
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
    } else if (messageLower.includes('empleados') || messageLower.includes('vendedor') || 
               messageLower.includes('vendedores') || messageLower.match(/dame \d+ vendedores?/)) {
      // Detectar si se solicita un número específico de vendedores
      const numMatch = messageLower.match(/dame (\d+) vendedores?/);
      const limit = numMatch ? parseInt(numMatch[1]) : null;
      
      dbData = await queryVendedoresDetallado(limit);
      contextType = 'empleados_lista';
    } else if (messageLower.includes('acciones comerciales') || 
               messageLower.includes('acciones registradas') ||
               messageLower.includes('que tipo de acciones') ||
               (messageLower.includes('accion') && messageLower.includes('comercial'))) {
      vendedoresData = await queryVendedores();
      const currentOffset = assistantContext.lastIndex || 0;
      dbData = await queryAccionesCom(1, currentOffset);
      contextType = 'acciones_comerciales';
      assistantContext.lastIndex = currentOffset + 1;
    } else if (messageLower.includes('gestion') || messageLower.includes('gestiona')) {
      vendedoresData = await queryVendedores();
      dbData = await queryAccionesCom();
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
    } else if (messageLower.includes('quien') && 
               (messageLower.includes('gestiono mas') || messageLower.includes('gestionó más')) && 
               messageLower.includes('acciones')) {
      dbData = await queryVendedorMasAcciones();
      contextType = 'vendedor_mas_acciones';
    } else if (messageLower.includes('bandeja') || messageLower.includes('bandejas')) {
      if (messageLower.includes('más alveolos') || messageLower.includes('mayor número')) {
        dbData = await queryBandejaMasAlveolos();
        contextType = 'bandeja_mas_alveolos';
      } else if (messageLower.match(/más de (\d+) alveolos/)) {
        const numAlveolos = parseInt(messageLower.match(/más de (\d+) alveolos/)[1]);
        dbData = await queryBandejasConMasAlveolos(numAlveolos);
        contextType = 'bandejas_filtradas';
      } else if (messageLower.includes('tipos de bandejas') || messageLower.includes('que bandejas')) {
        dbData = await queryBandejas();
        contextType = 'tipos_bandejas';
      } else if (messageLower.match(/dime (\d+) bandejas/)) {
        const numBandejas = parseInt(messageLower.match(/dime (\d+) bandejas/)[1]);
        dbData = await queryBandejas(numBandejas);
        contextType = 'lista_bandejas';
      } else {
        dbData = await queryBandejas(5);
        contextType = 'tipos_bandejas';
      }
    } else if (messageLower.includes('casa') && messageLower.includes('comercial')) {
      let options = {};
      
      // Detectar provincia
      const provinciaMatch = messageLower.match(/(?:en|de) ([a-zá-úñ]+)(?:\s|$)/i);
      if (provinciaMatch) {
        options.provincia = provinciaMatch[1];
      }
      
      // Detectar código postal
      const cpMatch = messageLower.match(/(?:postal|cp) (\d{5})/);
      if (cpMatch) {
        options.codigoPostal = cpMatch[1];
      }
      
      // Detectar filtros específicos
      if (messageLower.includes('teléfono') || messageLower.includes('telefono')) {
        options.conTelefono = true;
      }
      if (messageLower.includes('correo') || messageLower.includes('email')) {
        options.conEmail = true;
      }
      if (messageLower.includes('web') || messageLower.includes('página web')) {
        options.conWeb = true;
      }
      
      // Detectar límite
      const limitMatch = messageLower.match(/(?:muestra|dame|ver|lista|mostrar) (\d+)/);
      if (limitMatch) {
        options.limit = parseInt(limitMatch[1]);
      }
      
      if (Object.keys(options).length > 0) {
        dbData = await queryCasasComercialConFiltros(options);
        contextType = 'casas_comerciales_filtradas';
      } else {
        dbData = await queryCasasComercialesTodas();
        contextType = 'casas_comerciales_todas';
      }
    } else if (messageLower.includes('categorias') || messageLower.includes('categorías') || 
               (messageLower.match(/(encargado|conductor|produccion)/i) && 
                (messageLower.includes('cobra') || messageLower.includes('salario') || 
                 messageLower.includes('hora') || messageLower.includes('costo')))) {
      
      // Detectar tipo de consulta
      let tipoConsulta = null;
      if (messageLower.includes('hora extra')) {
        tipoConsulta = 'hora_extra';
      } else if (messageLower.includes('por hora')) {
        tipoConsulta = 'costo_hora';
      } else if (messageLower.includes('cobra') || messageLower.includes('salario') || messageLower.includes('por dia')) {
        tipoConsulta = 'salario';
      }

      // Detectar categoría
      const categoriaMatch = messageLower.match(/(encargado|conductor|produccion)/i);
      
      if (categoriaMatch) {
        dbData = await queryCategoriaPorNombre(categoriaMatch[1]);
        if (dbData) {
          dbData.tipoConsulta = tipoConsulta;
          contextType = 'categoria_especifica';
        }
      } else if (messageLower.includes('cuantas') || messageLower.includes('cuántas')) {
        dbData = await queryCategorias();
        contextType = 'total_categorias';
      } else {
        dbData = await queryCategorias();
        contextType = 'lista_categorias';
      }
    } else if (messageLower.includes('credito') && messageLower.includes('caucion')) {
      if (messageLower.includes('si') && assistantContext.lastCreditoCaucion) {
        // Si el usuario responde "sí" a ver la información del cliente
        const clienteInfo = await queryClientePorId(assistantContext.lastCreditoCaucion.cliente_id);
        dbData = {
          ...assistantContext.lastCreditoCaucion,
          clienteInfo
        };
        contextType = 'ejemplo_credito_caucion';
      } else if (messageLower.includes('ejemplo') || messageLower.match(/muestra(?:me)? (?:un|1)/)) {
        const data = await queryCreditosCaucion(1);
        if (data && data[0]) {
          // Guardar el crédito caución actual en el contexto
          assistantContext.lastCreditoCaucion = data[0];
        }
        dbData = data;
        contextType = 'ejemplo_credito_caucion';
      } else {
        dbData = await queryCreditosCaucion(5);
        contextType = 'lista_creditos_caucion';
      }
    } else {
      // Manejo de conversación general
      contextType = 'conversacion_general';
    }

    // Preparar el prompt según el tipo de consulta
    let systemContent = `Eres un asistente experto del ERP DEITANA de Semilleros Deitana.\n\n`;

    if (contextType === 'ejemplo_articulo') {
      systemContent += `CONTEXTO IMPORTANTE:
- Se está solicitando un ejemplo de artículo del inventario
- SOLO se deben mostrar datos reales de la base de datos
- NO se debe inventar información bajo ninguna circunstancia
- NO se deben sugerir ejemplos hipotéticos
- NO se deben incluir datos que no estén en la base de datos

DATOS DISPONIBLES:
${JSON.stringify(dbData || [], null, 2)}

REGLAS ESTRICTAS:
1. SOLO mostrar los datos que existen en la base de datos
2. NO inventar códigos, descripciones, precios o existencias
3. NO inventar proveedores o información adicional
4. Si no hay datos, indicar claramente "No se encontraron artículos en la base de datos"

FORMATO DE RESPUESTA:
1. Mostrar EXACTAMENTE los datos disponibles:
   - ID del artículo
   - Denominación exacta
   - Código de barras (si existe)
   - Proveedor (si está asignado)
2. NO agregar información adicional
3. NO sugerir ejemplos hipotéticos

RESPUESTA ESPECÍFICA:
${dbData && dbData.length > 0 ? `
Artículo encontrado:
- ID: ${dbData[0].id}
- Denominación: ${dbData[0].denominacion}
${dbData[0].codigo_barras ? `- Código de barras: ${dbData[0].codigo_barras}` : ''}
${dbData[0].nombre_proveedor ? `- Proveedor: ${dbData[0].nombre_proveedor}` : ''}` : 
'No se encontraron artículos en la base de datos'}`;

    } else if (contextType === 'total_articulos') {
      // ... existing code for other context types ...
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
      message: "Lo siento, estoy teniendo problemas para procesar tu consulta en este momento. Por favor, verifica que tu pregunta esté relacionada con artículos o acciones comerciales y vuelve a intentarlo.",
      context: assistantContext
    };
  }
}

async function processAccionesComercialesResponse(data) {
  if (!data || data.length === 0) {
    return "No se encontraron acciones comerciales registradas en los últimos 3 meses.";
  }

  // Preparar el prompt para la IA con restricciones estrictas
  const systemPrompt = `Eres un asistente experto del ERP DEITANA. Debes seguir estas reglas estrictamente:

1. SOLO usar los datos proporcionados en la base de datos
2. NUNCA inventar o sugerir datos ficticios
3. NUNCA proponer formatos o ejemplos hipotéticos
4. Si no hay datos, indicar claramente "No hay datos disponibles"
5. Respetar exactamente los nombres, fechas y notas como aparecen en la base de datos

DATOS DISPONIBLES:
${JSON.stringify(data, null, 2)}

INSTRUCCIONES:
1. Mostrar SOLO los datos reales de la base de datos
2. No sugerir ni proponer ejemplos hipotéticos
3. No inventar información bajo ninguna circunstancia
4. Si se solicita un ejemplo, mostrar SOLO los datos reales disponibles`;

  try {
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Muestra un ejemplo de acción comercial real de la base de datos" }
      ],
      temperature: 0.3, // Baja temperatura para reducir la creatividad
      max_tokens: 500
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error al procesar respuesta de IA:', error);
    // En caso de error, mostrar los datos directamente
    let response = "Acciones Comerciales Reales:\n\n";
    data.forEach((accion, index) => {
      response += `Acción #${index + 1}:\n`;
      response += `- Tipo: ${accion.tipo_accion || 'No especificado'}\n`;
      response += `- Fecha: ${accion.fecha}\n`;
      response += `- Hora: ${accion.hora}\n`;
      response += `- Vendedor: ${accion.vendedor_nombre || 'No especificado'}\n`;
      response += `- Cliente: ${accion.cliente_nombre || 'No especificado'}\n`;
      if (accion.notas) {
        response += `- Notas: ${accion.notas}\n`;
      }
      response += "\n";
    });
    return response;
  }
}

module.exports = {
  processMessage,
  processAccionesComercialesResponse
};