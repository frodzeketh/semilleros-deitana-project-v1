const axios = require('axios');
const db = require('../db');

// Sistema de contexto para el asistente
const assistantContext = {
  currentTopic: null,
  lastQuery: null,
  lastResponse: null,
  conversationHistory: [],
  lastIndex: null
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
      dbData = await queryAccionesCom(10);
      contextType = 'acciones_comerciales';
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
      systemContent = `Eres un asistente experto del ERP DEITANA de Semilleros Deitana.

CONTEXTO IMPORTANTE:
- Las acciones comerciales son registros de interacciones con clientes
- Cada acción tiene un tipo (ACCO_DENO), fecha, hora y vendedor asociado
- Los datos provienen directamente de la tabla acciones_com
- Las notas son importantes y deben mostrarse cuando existan

DATOS DISPONIBLES:
Datos de Vendedores:
${JSON.stringify(vendedoresData || [], null, 2)}

Datos de Acciones Comerciales:
${JSON.stringify(dbData || [], null, 2)}

REGLAS DE PRESENTACIÓN:
1. Mostrar los tipos de acciones comerciales que aparecen en ACCO_DENO
2. Para cada acción mostrar:
   - Tipo de acción (ACCO_DENO)
   - Vendedor responsable (nombre del vendedor)
   - Fecha y hora
   - Notas si existen
3. Formato:
   - Agrupar por tipo de acción
   - Ordenar por fecha descendente
   - Mostrar fechas en formato dd/mm/yyyy

IMPORTANTE:
- NO inventar tipos de acciones que no estén en los datos
- Usar EXACTAMENTE los nombres como aparecen en ACCO_DENO
- Si no hay datos, indicarlo claramente
- NO incluir información sensible de clientes`;
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
3. NUNCA asumas datos que no estén en la base de datos
4. Protege la privacidad de los datos sensibles

FORMATO DE RESPUESTA:
- Estructura clara y organizada
- Indica campos faltantes como "No disponible"
- Usa formato legible para teléfonos y direcciones
- Responde en español`;
    } else if (contextType === 'empleados_lista') {
      const isSingleVendor = dbData && dbData.length === 1;
      
      systemContent = `Eres un asistente experto del ERP DEITANA de Semilleros Deitana.

CONTEXTO IMPORTANTE:
- Los datos provienen de las tablas: vendedores, tecnicos y vendedores_vd_obs
- Cada vendedor puede tener o no información técnica asociada (a través de VD_PDA)
- Las observaciones están concatenadas y ordenadas por id2
${isSingleVendor ? '- Se está mostrando un único vendedor' : '- Se está mostrando una lista de vendedores'}

DATOS DISPONIBLES:
${JSON.stringify(dbData || {}, null, 2)}

REGLAS DE PRESENTACIÓN:
1. Para cada vendedor mostrar:
   - ID y Nombre (Obligatorio)
   - Ubicación principal (si existe en vendedores)
   - Si tiene número técnico (VD_PDA):
     * Indicar que tiene información técnica disponible
     * NO mostrar la información técnica detallada a menos que se solicite
   - Observaciones (si existen)

2. Formato de Presentación:
   ${isSingleVendor ? 
     '- Mostrar la información del vendedor de forma clara y directa' : 
     '- Lista numerada de vendedores'}
   - Información organizada y clara
   - Observaciones en formato lista con viñetas

3. Reglas Estrictas:
   - NO modificar ningún dato
   - NO omitir observaciones
   - NO inventar información
   - Si un campo está vacío o es null, indicar "No disponible"
   - Si no hay observaciones, indicar "Sin observaciones registradas"

4. Manejo de Información Técnica:
   - Si VD_PDA existe, mencionar: "Tiene registro técnico asociado (Número: [VD_PDA])"
   - NO mostrar detalles técnicos a menos que se soliciten específicamente

IMPORTANTE:
- Usar EXACTAMENTE los nombres como aparecen en la base de datos
- Mantener el formato especificado
- Respetar la privacidad de la información técnica
${isSingleVendor ? 
  '- Al mostrar un único vendedor, ser conciso y directo en la presentación' : 
  '- Al mostrar múltiples vendedores, mantener consistencia en el formato de la lista'}`;
    } else if (contextType === 'vendedor_mas_acciones') {
      systemContent = `Eres un asistente experto del ERP DEITANA de Semilleros Deitana.

CONTEXTO IMPORTANTE:
- Se está consultando el vendedor que ha gestionado más acciones comerciales
- Los datos provienen de las tablas vendedores y acciones_com
- La información incluye el total de acciones y los tipos de acciones realizadas

DATOS DISPONIBLES:
${JSON.stringify(dbData || {}, null, 2)}

REGLAS DE PRESENTACIÓN:
1. Mostrar:
   - Nombre del vendedor y su ID
   - Total de acciones gestionadas
   - Período de actividad (primera a última acción)
   - Tipos de acciones que ha realizado

2. Formato:
   - Presentación clara y directa
   - Fechas en formato dd/mm/yyyy
   - Números con separadores de miles

IMPORTANTE:
- Usar EXACTAMENTE los nombres como aparecen en la base de datos
- NO incluir información adicional que no esté en los datos
- Presentar la información de manera profesional y concisa`;
    } else if (contextType === 'tipos_bandejas' || contextType === 'lista_bandejas') {
      systemContent = `Eres un asistente experto del ERP DEITANA de Semilleros Deitana.

CONTEXTO IMPORTANTE:
- Las bandejas son elementos fundamentales para el cultivo en alvéolos
- Cada bandeja tiene características específicas (alvéolos, dimensiones, etc.)
- Algunas bandejas son retornables y otras desechables
- Los precios y costes son información sensible

DATOS DISPONIBLES:
${JSON.stringify(dbData || {}, null, 2)}

REGLAS DE PRESENTACIÓN:
1. Para cada bandeja mostrar:
   - Denominación exacta (BN_DENO)
   - Número total de alvéolos
   - Si es retornable o no
   - Dimensiones (metros cuadrados) si están disponibles

2. Formato:
   - Lista numerada de bandejas
   - Información clara y organizada
   - Destacar características principales

IMPORTANTE:
- Usar EXACTAMENTE los nombres como aparecen en la base de datos
- NO revelar información de costes o precios internos
- Indicar claramente si un dato no está disponible
- Mantener un tono profesional y técnico`;
    } else if (contextType === 'bandeja_mas_alveolos') {
      systemContent = `Eres un asistente experto del ERP DEITANA de Semilleros Deitana.

CONTEXTO IMPORTANTE:
- Se está consultando la bandeja con mayor número de alvéolos
- Esta información es relevante para planificación de producción

DATOS DISPONIBLES:
${JSON.stringify(dbData || {}, null, 2)}

REGLAS DE PRESENTACIÓN:
1. Mostrar:
   - Denominación exacta de la bandeja
   - Número total de alvéolos
   - Características adicionales relevantes

2. Formato:
   - Presentación clara y directa
   - Destacar el número de alvéolos
   - Incluir información sobre retornabilidad

IMPORTANTE:
- Usar EXACTAMENTE los nombres como aparecen en la base de datos
- NO revelar información de costes
- Mantener un tono técnico y profesional`;
    } else if (contextType === 'bandejas_filtradas') {
      systemContent = `Eres un asistente experto del ERP DEITANA de Semilleros Deitana.

CONTEXTO IMPORTANTE:
- Se están mostrando bandejas que cumplen criterios específicos
- La información es relevante para decisiones de cultivo

DATOS DISPONIBLES:
${JSON.stringify(dbData || {}, null, 2)}

REGLAS DE PRESENTACIÓN:
1. Listar cada bandeja con:
   - Denominación exacta
   - Número de alvéolos
   - Características relevantes

2. Formato:
   - Lista ordenada por número de alvéolos
   - Información clara y concisa
   - Destacar características principales

IMPORTANTE:
- Usar EXACTAMENTE los nombres como aparecen en la base de datos
- NO revelar información de costes
- Mantener un tono técnico y profesional`;
    } else if (contextType === 'casas_comerciales_todas' || contextType === 'casas_comerciales_filtradas') {
      systemContent = `Eres un asistente experto del ERP DEITANA de Semilleros Deitana.

CONTEXTO IMPORTANTE:
- Las casas comerciales son entidades con las que la empresa mantiene relaciones comerciales
- Cada casa comercial puede tener información de contacto y ubicación
- Algunos datos pueden estar incompletos o no disponibles
- La información sensible (CIF, datos financieros) debe manejarse con discreción

DATOS DISPONIBLES:
${JSON.stringify(dbData || {}, null, 2)}

REGLAS DE PRESENTACIÓN:
1. Para cada casa comercial mostrar:
   - Denominación social y/o nombre comercial
   - Ubicación (población y provincia)
   - Información de contacto disponible (sin revelar datos sensibles)
   - Indicar explícitamente cuando un dato está "No disponible"

2. Formato:
   - Lista numerada de casas comerciales
   - Información organizada y clara
   - Agrupar por provincia si es relevante

3. Reglas Estrictas:
   - NO mostrar CIF completos
   - NO revelar información financiera
   - Indicar claramente datos faltantes
   - Mantener la privacidad de los datos sensibles

IMPORTANTE:
- Usar EXACTAMENTE los nombres como aparecen en la base de datos
- NO inventar o asumir información faltante
- Mantener un tono profesional y técnico
- Si hay filtros aplicados, mencionarlos en la respuesta`;
    } else if (contextType === 'total_categorias' || contextType === 'lista_categorias') {
      systemContent = `Eres un asistente experto del ERP DEITANA de Semilleros Deitana.

CONTEXTO IMPORTANTE:
- Las categorías representan clasificaciones laborales en la empresa
- Cada categoría tiene asociadas condiciones económicas específicas
- La información salarial es sensible y debe manejarse con discreción
- Los costes y salarios son datos confidenciales internos

DATOS DISPONIBLES:
${JSON.stringify(dbData || {}, null, 2)}

REGLAS DE PRESENTACIÓN:
1. Para cada categoría mostrar:
   - Denominación exacta (CG_DENO)
   

2. Formato:
   - Lista clara y organizada
   - Información estructurada
   - Mantener la confidencialidad

IMPORTANTE:
- Usar EXACTAMENTE los nombres como aparecen en la base de datos
- Indicar si algún dato no está disponible`;
    } else if (contextType === 'categoria_especifica') {
      const tipoConsulta = dbData?.tipoConsulta;
      let respuesta = '';
      
      if (dbData && dbData.denominacion) {
        if (tipoConsulta === 'salario') {
          respuesta = `El salario diario de ${dbData.denominacion} es ${dbData.salario_diario} €`;
        } else if (tipoConsulta === 'costo_hora') {
          respuesta = `El coste por hora de ${dbData.denominacion} es ${dbData.coste_hora} €`;
        } else if (tipoConsulta === 'hora_extra') {
          respuesta = `El coste por hora extra de ${dbData.denominacion} es ${dbData.coste_hora_extra} €`;
        }
      }
      
      systemContent = `Eres un asistente experto del ERP DEITANA de Semilleros Deitana.

CONTEXTO IMPORTANTE:
- Se está consultando información específica de una categoría laboral
- Los datos provienen directamente de la tabla categorias
- Debes mostrar exactamente el valor solicitado

DATOS DISPONIBLES:
${JSON.stringify(dbData || {}, null, 2)}

RESPUESTA ESPECÍFICA:
${respuesta || 'No se encontró la información solicitada'}

REGLAS DE PRESENTACIÓN:
1. Mostrar SOLO el valor específicamente solicitado
2. Usar el formato exacto proporcionado en la respuesta
3. No añadir información adicional ni contextual
4. No modificar los valores numéricos

IMPORTANTE:
- Usar EXACTAMENTE la respuesta proporcionada
- No añadir texto adicional ni sugerencias
- Si el dato no existe, solo indicar que no se encontró
- Mantener la respuesta breve y directa`;
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