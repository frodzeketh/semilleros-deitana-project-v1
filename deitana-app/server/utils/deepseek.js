const axios = require('axios');
const db = require('../db');

// Sistema de contexto para el asistente
const assistantContext = {
  currentTopic: null,
  lastQuery: null,
  lastResponse: null,
  conversationHistory: [],
  lastIndex: null,
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

async function queryCreditosCaucion(options = {}) {
  const { id, clienteId, tipo, diasMinimos, limit, random } = options;

  let conditions = [];
  let params = [];
  
  if (id) {
    conditions.push('cc.id = ?');
    params.push(id);
  }
  
  if (clienteId) {
    conditions.push('cc.CAU_CCL = ?');
    params.push(clienteId);
  }
  
  if (tipo) {
    conditions.push('cc.CAU_TIPO = ?');
    params.push(tipo);
  }
  
  if (diasMinimos) {
    conditions.push('cc.CAU_DIAS >= ?');
    params.push(diasMinimos);
  }

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
    ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
    GROUP BY cc.id, cc.CAU_CCL, cc.CAU_DIAS, cc.CAU_TIPO, c.CL_DENO
    ${random ? 'ORDER BY RAND()' : 'ORDER BY cc.id DESC'}
    ${limit ? 'LIMIT ?' : ''}`;

  if (limit) params.push(limit);
  
  try {
    const [results] = await db.query(query, params);
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

async function queryTotalCreditosCaucion() {
  const query = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN CAU_TIPO = 'A' THEN 1 ELSE 0 END) as total_asegurados,
      SUM(CASE WHEN CAU_TIPO = 'N' THEN 1 ELSE 0 END) as total_no_asegurados
    FROM creditocau`;
  
  try {
    const [results] = await db.query(query);
    return results[0];
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

// Función principal para procesar mensajes
async function processMessage(userMessage) {
  try {
    console.log('Procesando mensaje en deepseek.js:', userMessage);

    // Primero, obtener los datos necesarios según el tipo de consulta
    let dbData = null;
    let contextType = null;
    const messageLower = userMessage.toLowerCase();

    // Consulta sobre proveedores con teléfono
    if (messageLower.includes('proveedor') && messageLower.includes('teléfono')) {
      dbData = await queryProveedoresConTelefono(5);
      contextType = 'proveedores_telefono';
    }
    // Consulta sobre bandejas
    else if (messageLower.includes('bandeja') || messageLower.includes('bandejas')) {
      dbData = await queryBandejas();
      contextType = 'tipos_bandejas';
    }
    // Consulta sobre créditos caución
    else if (messageLower.includes('credito') && messageLower.includes('caucion')) {
      if (messageLower.includes('cuantos') || messageLower.includes('total')) {
        dbData = await queryTotalCreditosCaucion();
        contextType = 'total_creditos_caucion';
      } else {
        dbData = await queryCreditosCaucion({ limit: 5 });
        contextType = 'lista_creditos_caucion';
      }
    }
    // ... otros tipos de consultas ...

    // Construir el prompt para la IA
    const systemPrompt = `Eres un asistente experto del ERP DEITANA de Semilleros Deitana.

CONTEXTO ACTUAL:
${contextType ? `Tipo de consulta: ${contextType}` : 'Consulta general'}

DATOS DISPONIBLES:
${JSON.stringify(dbData || {}, null, 2)}

INSTRUCCIONES:
1. Analiza la consulta del usuario y los datos disponibles
2. Proporciona una respuesta detallada y profesional
3. Si los datos están disponibles, úsalos para dar información específica
4. Si no hay datos suficientes, indica qué información adicional se necesita
5. Mantén un tono profesional pero conversacional
6. Responde SIEMPRE en español

REGLAS:
1. NUNCA inventes datos que no estén en la base de datos
2. Si no hay datos disponibles, indícalo claramente
3. Usa los datos EXACTAMENTE como aparecen en la base de datos
4. Si necesitas más información, pregunta al usuario
5. Mantén la privacidad de los datos sensibles

FORMATO DE RESPUESTA:
1. Primero, responde directamente a la pregunta
2. Luego, proporciona contexto adicional si es relevante
3. Si es apropiado, sugiere preguntas relacionadas`;

    // Llamada a la API de DeepSeek
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 2000
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      }
    });

    const aiResponse = response.data.choices[0].message.content;

    // Actualizar el contexto
    assistantContext.lastQuery = userMessage;
    assistantContext.lastResponse = aiResponse;
    assistantContext.conversationHistory.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: aiResponse }
    );

    // Mantener el historial manejable
    if (assistantContext.conversationHistory.length > 6) {
      assistantContext.conversationHistory = assistantContext.conversationHistory.slice(-6);
    }

    return {
      message: aiResponse,
      context: assistantContext
    };

  } catch (error) {
    console.error('Error en processMessage:', error);
    
    // En caso de error, también usamos la IA para dar una respuesta más natural
    try {
      const errorPrompt = `Eres un asistente experto del ERP DEITANA. 
      Ha ocurrido un error al procesar la consulta del usuario: "${userMessage}". 
      Por favor, genera una respuesta amable explicando que hubo un problema y sugiriendo alternativas.`;

      const errorResponse = await axios.post('https://api.deepseek.com/v1/chat/completions', {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: errorPrompt },
          { role: "user", content: "Genera una respuesta de error amable" }
        ],
        temperature: 0.7,
        max_tokens: 500
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        }
      });

      return {
        message: errorResponse.data.choices[0].message.content,
        context: assistantContext
      };
    } catch (secondaryError) {
      console.error('Error al generar mensaje de error:', secondaryError);
      return {
        message: "Lo siento, ha ocurrido un error inesperado. Por favor, intenta reformular tu pregunta o contacta con soporte técnico si el problema persiste.",
        context: assistantContext
      };
    }
  }
}

function formatTotalCreditosCaucion(data) {
  const { total, asegurados, noAsegurados } = data;
  return `Hay un total de ${total} créditos caución registrados:
- ${asegurados} créditos asegurados
- ${noAsegurados} créditos no asegurados`;
}

function formatListaCreditosCaucion(data) {
  if (!data || data.length === 0) {
    return 'No se encontraron créditos caución que coincidan con los criterios especificados.';
  }

  let response = 'Aquí tienes los créditos caución encontrados:\n\n';
  data.forEach((credito, index) => {
    response += `${index + 1}. Cliente: ${credito.cliente_nombre}\n`;
    response += `   - Tipo: ${credito.tipo === 'A' ? 'Asegurado' : 'No asegurado'}\n`;
    response += `   - Días: ${credito.dias}\n`;
    if (credito.observaciones && credito.observaciones.length > 0) {
      response += '   - Observaciones:\n';
      credito.observaciones.forEach(obs => {
        response += `     * ${obs}\n`;
      });
    }
    response += '\n';
  });

  return response;
}

function formatEjemploCreditoCaucion(data) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return 'No se encontró el crédito caución solicitado.';
  }

  const credito = Array.isArray(data) ? data[0] : data;
  let response = 'Detalles del crédito caución:\n\n';
  response += `Cliente: ${credito.cliente_nombre}\n`;
  response += `Tipo: ${credito.tipo === 'A' ? 'Asegurado' : 'No asegurado'}\n`;
  response += `Días: ${credito.dias}\n`;
  
  if (credito.observaciones && credito.observaciones.length > 0) {
    response += 'Observaciones:\n';
    credito.observaciones.forEach(obs => {
      response += `- ${obs}\n`;
    });
  }

  if (credito.clienteInfo) {
    response += '\nInformación adicional del cliente:\n';
    response += `- Código: ${credito.clienteInfo.codigo}\n`;
    response += `- Razón social: ${credito.clienteInfo.razon_social}\n`;
    response += `- NIF: ${credito.clienteInfo.nif}\n`;
  } else {
    response += '\n¿Deseas ver más información sobre el cliente?';
  }

  return response;
}

function formatResponse(data, contextType) {
  switch (contextType) {
    // ... existing code ...
    case 'total_creditos_caucion':
      return formatTotalCreditosCaucion(data);
    case 'lista_creditos_caucion':
      return formatListaCreditosCaucion(data);
    case 'ejemplo_credito_caucion':
      return formatEjemploCreditoCaucion(data);
    // ... existing code ...
  }
}

module.exports = {
  processMessage,
  formatResponse
};