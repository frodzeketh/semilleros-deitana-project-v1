const db = require('../db');

// Funciones para consultas de vendedores
async function queryVendedoresDetallado(limit = null) {
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
    ${limit ? 'LIMIT ?' : ''}`;
  
  try {
    const [results] = await db.query(query, limit ? [limit] : []);
    
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

// Función para procesar mensajes relacionados con vendedores
async function processVendedoresMessage(message) {
  const messageLower = message.toLowerCase();
  let dbData = null;
  let contextType = null;

  if (messageLower.includes('más acciones') || 
      messageLower.includes('mas acciones') || 
      messageLower.includes('gestionó más') || 
      messageLower.includes('gestiono mas')) {
    dbData = await queryVendedorMasAcciones();
    contextType = 'vendedor_mas_acciones';
  } else if (messageLower.match(/dame (\d+) vendedores?/)) {
    const numMatch = messageLower.match(/dame (\d+) vendedores?/);
    const limit = numMatch ? parseInt(numMatch[1]) : null;
    dbData = await queryVendedoresDetallado(limit);
    contextType = 'empleados_lista';
  } else if (messageLower.includes('vendedor') || messageLower.includes('vendedores')) {
    dbData = await queryVendedoresDetallado(5);
    contextType = 'empleados_lista';
  }

  return { dbData, contextType };
}

module.exports = {
  processVendedoresMessage,
  queryVendedoresDetallado,
  queryVendedorPorId,
  queryVendedorPorNombre,
  queryVendedorMasAcciones
}; 